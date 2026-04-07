import { NextResponse } from "next/server";
import {
  getActiveMonitors,
  getSettings,
  saveMonitor,
  addLog,
} from "@/lib/redis";
import {
  searchTrains,
  createReservationId,
  reserveTicket,
  getReservationSummary,
  requestNaverPay,
} from "@/lib/train-api";
import { sendDiscord } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(request) {
  // Vercel Cron 보안 검증
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    // 로컬 개발 시에는 통과
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const monitors = await getActiveMonitors();
    if (monitors.length === 0) {
      return NextResponse.json({ message: "감시 대상 없음", checked: 0 });
    }

    const settings = await getSettings();
    if (!settings?.cookie) {
      return NextResponse.json({ error: "쿠키 미설정" }, { status: 400 });
    }

    let cookie = settings.cookie;
    if (!cookie.includes("NID_SES=") && !cookie.includes("=")) {
      cookie = `NID_SES=${cookie}`;
    }

    const results = [];

    for (const monitor of monitors) {
      // 이미 완료된 건 건너뛰기
      if (["reserved", "paid"].includes(monitor.status)) {
        results.push({ id: monitor.id, status: monitor.status, skipped: true });
        continue;
      }

      try {
        // 시간표 조회
        const scheduleResult = await searchTrains({
          departureDate: monitor.departureDate,
          departureTime: "000000",
          departureStopCode: monitor.departureStopId,
          arrivalStopCode: monitor.arrivalStopId,
          trainGroupCode: monitor.trainGroupCode || "109",
          seatAttrCode: monitor.seatAttrCode || "015",
          passengerCount: monitor.passengerCount || "1",
          cookie,
        });

        const trains =
          scheduleResult?.data?.trains ||
          scheduleResult?.trains ||
          scheduleResult?.data ||
          [];

        // 해당 열차 찾기
        const target = trains.find(
          (t) => t.trainNumber === monitor.trainNumber
        );

        const attempts = (monitor.attempts || 0) + 1;

        if (!target) {
          await saveMonitor(monitor.id, {
            ...monitor,
            attempts,
            lastChecked: new Date().toISOString(),
            error: "열차를 찾을 수 없음",
          });
          results.push({ id: monitor.id, status: "not_found" });
          continue;
        }

        // 좌석 가능 여부 확인
        const soldOut =
          target.generalSeatStatus === "매진" ||
          target.generalSeatStatus === "Sold Out" ||
          target.seatAvailable === false;

        if (soldOut) {
          // 아직 매진 → 계속 감시
          await saveMonitor(monitor.id, {
            ...monitor,
            attempts,
            lastChecked: new Date().toISOString(),
            status: "watching",
            error: null,
          });

          // 10회마다 로그
          if (attempts % 10 === 0) {
            await addLog({
              type: "check",
              message: `[${monitor.trainName} ${monitor.trainNumber}] ${attempts}회 체크 - 아직 매진`,
            });
          }

          results.push({ id: monitor.id, status: "still_sold_out", attempts });
          continue;
        }

        // 🎉 좌석 발견!
        await addLog({
          type: "success",
          message: `🎉 좌석 발견! ${monitor.trainName} ${monitor.trainNumber} (${monitor.departureStopName}→${monitor.arrivalStopName})`,
        });

        await sendDiscord(
          `🎉 **좌석 발견!**\n${monitor.trainName} ${monitor.trainNumber}\n${monitor.departureStopName} → ${monitor.arrivalStopName}\n${monitor.departureDate} ${monitor.departureTime}\n\n⚡ 자동 예매를 시작합니다...`,
          settings.discordWebhook
        );

        await saveMonitor(monitor.id, {
          ...monitor,
          status: "found",
          attempts,
          lastChecked: new Date().toISOString(),
        });

        // === 자동 예매 프로세스 ===
        try {
          // 예약 ID 생성
          await saveMonitor(monitor.id, { ...monitor, status: "reserving" });

          const idResult = await createReservationId(cookie);
          const reservationId =
            idResult?.data?.reservationId || idResult?.reservationId;

          if (!reservationId) {
            throw new Error("예약 ID 생성 실패");
          }

          // 예매 실행
          const reserveResult = await reserveTicket({
            reservationId,
            runDate: monitor.departureDate,
            trainGroupCode: target.trainGroupCode || monitor.trainGroupCode,
            trainNumber: monitor.trainNumber,
            departureStopCode:
              target.departureStopCode || monitor.departureStopCode,
            departureDate: monitor.departureDate,
            departureTime: target.departureTime || monitor.departureTime,
            departureStopRunOrder:
              target.departureStopRunOrder ||
              monitor.departureStopRunOrder ||
              "000001",
            arrivalStopCode:
              target.arrivalStopCode || monitor.arrivalStopCode,
            arrivalStopConsistRunOrder:
              target.arrivalStopRunOrder ||
              target.arrivalStopConsistRunOrder ||
              monitor.arrivalStopRunOrder ||
              "000099",
            seatAttrCode: monitor.seatAttrCode || "015",
            adultCount: parseInt(monitor.passengerCount) || 1,
            railwayCompany: target.railwayCompany || monitor.railwayCompany || "KORAIL",
            ticketPassword: settings.ticketPassword || "0000",
            cookie,
          });

          await addLog({
            type: "success",
            message: `✅ 예매 성공! 예약ID: ${reservationId.substring(0, 12)}...`,
          });

          // 예매 확인
          const summary = await getReservationSummary({
            reserveId: reservationId,
            cookie,
          });

          const amount =
            summary?.data?.totalAmount ||
            summary?.data?.paymentAmount ||
            0;

          // 결제 요청
          let paymentUrl = null;
          if (amount > 0) {
            try {
              await saveMonitor(monitor.id, {
                ...monitor,
                status: "paying",
                reserveId: reservationId,
              });

              const payResult = await requestNaverPay({
                reserveId: reservationId,
                productAmount: amount,
                railwayCompany: target.railwayCompany || "KORAIL",
                cookie,
              });

              paymentUrl =
                payResult?.data?.paymentUrl ||
                payResult?.paymentUrl ||
                `https://pt.map.naver.com/end-train/bridges/payment/web/summary?reservationId=${reservationId}&from=payment&tripType=OW&lang=ko`;

              await addLog({
                type: "success",
                message: `💳 결제 요청 완료 (${amount.toLocaleString()}원)`,
              });
            } catch (payErr) {
              paymentUrl = `https://pt.map.naver.com/end-train/bridges/payment/web/summary?reservationId=${reservationId}&from=payment&tripType=OW&lang=ko`;
              await addLog({
                type: "warn",
                message: `결제 자동 진행 실패. 수동 결제 필요: ${payErr.message}`,
              });
            }
          }

          // 상태 업데이트
          await saveMonitor(monitor.id, {
            ...monitor,
            status: "reserved",
            reserveId: reservationId,
            paymentUrl,
            amount,
            attempts,
            lastChecked: new Date().toISOString(),
            error: null,
          });

          await sendDiscord(
            `✅ **예매 완료!**\n${monitor.trainName} ${monitor.trainNumber}\n${monitor.departureStopName} → ${monitor.arrivalStopName}\n금액: ${amount?.toLocaleString() || "확인필요"}원\n예약ID: ${reservationId}\n\n💳 결제 링크: ${paymentUrl || "대시보드에서 확인"}`,
            settings.discordWebhook
          );

          results.push({
            id: monitor.id,
            status: "reserved",
            reservationId,
          });
        } catch (reserveErr) {
          await saveMonitor(monitor.id, {
            ...monitor,
            status: "failed",
            error: reserveErr.message,
            attempts,
            lastChecked: new Date().toISOString(),
          });

          await addLog({
            type: "error",
            message: `예매 실패: ${reserveErr.message}`,
          });

          await sendDiscord(
            `❌ **예매 실패**\n${monitor.trainName} ${monitor.trainNumber}\n오류: ${reserveErr.message}`,
            settings.discordWebhook
          );

          results.push({
            id: monitor.id,
            status: "failed",
            error: reserveErr.message,
          });
        }
      } catch (err) {
        await saveMonitor(monitor.id, {
          ...monitor,
          attempts: (monitor.attempts || 0) + 1,
          lastChecked: new Date().toISOString(),
          error: err.message,
        });

        results.push({ id: monitor.id, error: err.message });
      }

      // API 호출 간 딜레이 (차단 방지)
      await new Promise((r) => setTimeout(r, 1000));
    }

    return NextResponse.json({
      message: `${monitors.length}개 감시 완료`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
