import { NextResponse } from "next/server";
import {
  getActiveMonitors,
  getSettings,
  saveMonitor,
  addLog,
  getCronLastRunMs,
  setCronLastRunMs,
} from "@/lib/redis";
import {
  searchTrains,
  createReservationId,
  reserveTicket,
  getReservationSummary,
  requestNaverPay,
  pickReservationId,
  pickTotalAmount,
  pickPaymentUrl,
} from "@/lib/train-api";
import { sendDiscord } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    let monitors = [];
    try {
      monitors = await getActiveMonitors();
    } catch (e) {
      return NextResponse.json({
        error: "모니터 목록 로드 실패: " + e.message,
      });
    }

    if (monitors.length === 0) {
      return NextResponse.json({ message: "감시 대상 없음", checked: 0 });
    }

    let settings = null;
    try {
      settings = await getSettings();
    } catch {}

    if (!settings?.cookie) {
      return NextResponse.json({ error: "쿠키 미설정", checked: 0 });
    }

    const intervalSec = Math.min(
      300,
      Math.max(10, Number(settings.checkInterval) || 60)
    );
    const now = Date.now();
    const last = await getCronLastRunMs();
    if (last > 0 && now - last < intervalSec * 1000) {
      const nextInSec = Math.ceil(
        (intervalSec * 1000 - (now - last)) / 1000
      );
      return NextResponse.json({
        message: "skipped: checkInterval",
        checkIntervalSec: intervalSec,
        nextInSec,
      });
    }

    await setCronLastRunMs(now);

    const cookie = settings.cookie;
    const discordUrl = settings.discordWebhook || "";
    const results = [];

    for (const monitor of monitors) {
      if (["reserved", "paid"].includes(monitor.status)) {
        results.push({ id: monitor.id, status: monitor.status, skipped: true });
        continue;
      }

      try {
        const { trains } = await searchTrains({
          departureDate: monitor.departureDate,
          departureTime: "000000",
          departureStopCode: monitor.departureStopId,
          arrivalStopCode: monitor.arrivalStopId,
          trainGroupCode: monitor.trainGroupCode || "109",
          seatAttrCode: monitor.seatAttrCode || "015",
          passengerCount: monitor.passengerCount || "1",
          cookie,
        });

        const target = trains.find(
          (t) => String(t.trainNumber) === String(monitor.trainNumber)
        );

        const attempts = (monitor.attempts || 0) + 1;

        if (!target) {
          await saveMonitor(monitor.id, {
            ...monitor,
            attempts,
            lastChecked: new Date().toISOString(),
            error: `열차 ${monitor.trainNumber}을 찾을 수 없음 (${trains.length}개 조회됨)`,
          });
          results.push({ id: monitor.id, status: "not_found" });
          continue;
        }

        const seatStatus = (
          target.generalReserveName ||
          target.generalSeatStatus ||
          target.seatStatus ||
          target.reserveStatus ||
          ""
        ).toString();

        const soldOut =
          target.generalReserveName === "매진" ||
          seatStatus.includes("매진") ||
          seatStatus.includes("Sold") ||
          seatStatus.includes("sold") ||
          target.seatAvailable === false ||
          target.generalSeatAvailable === false;

        if (soldOut) {
          await saveMonitor(monitor.id, {
            ...monitor,
            attempts,
            lastChecked: new Date().toISOString(),
            status: "watching",
            error: null,
          });

          if (attempts % 10 === 0) {
            try {
              await addLog({
                type: "check",
                message: `[${monitor.trainName} ${monitor.trainNumber}] ${attempts}회 체크 - 매진`,
              });
            } catch {}
          }

          results.push({ id: monitor.id, status: "sold_out", attempts });
          continue;
        }

        try {
          await addLog({
            type: "success",
            message: `🎉 좌석 발견! ${monitor.trainName} ${monitor.trainNumber} (${monitor.departureStopName}→${monitor.arrivalStopName})`,
          });
        } catch {}

        await sendDiscord(
          `🎉 **좌석 발견!**\n${monitor.trainName} ${monitor.trainNumber}\n${monitor.departureStopName} → ${monitor.arrivalStopName}\n${monitor.departureDate} ${monitor.departureTime}\n⚡ 자동 예매 시작...`,
          discordUrl
        );

        await saveMonitor(monitor.id, {
          ...monitor,
          status: "reserving",
          attempts,
          lastChecked: new Date().toISOString(),
        });

        let reservationId;
        try {
          const idResult = await createReservationId(cookie);
          reservationId = pickReservationId(idResult);

          if (!reservationId) {
            throw new Error(
              "예약 ID 생성 실패: " +
                JSON.stringify(idResult).substring(0, 200)
            );
          }

          await reserveTicket({
            reservationId,
            runDate: target.runDate || monitor.departureDate,
            trainGroupCode:
              target.trainGroupCode || monitor.trainGroupCode || "100",
            trainNumber: String(monitor.trainNumber),
            departureStopCode:
              target.departureStopCode || monitor.departureStopCode || "",
            departureDate: target.departureDate || monitor.departureDate,
            departureTime:
              target.departureTime || monitor.departureTime || "",
            departureStopRunOrder:
              target.departureStopRunOrder ||
              monitor.departureStopRunOrder ||
              "000001",
            arrivalStopCode:
              target.arrivalStopCode || monitor.arrivalStopCode || "",
            arrivalStopConsistRunOrder:
              target.arrivalStopRunOrder ||
              target.arrivalStopConsistRunOrder ||
              monitor.arrivalStopRunOrder ||
              "000099",
            seatAttrCode: monitor.seatAttrCode || "015",
            adultCount: parseInt(monitor.passengerCount, 10) || 1,
            railwayCompany:
              target.railwayCompany || monitor.railwayCompany || "KORAIL",
            ticketPassword: settings.ticketPassword || "0000",
            cookie,
          });

          try {
            await addLog({
              type: "success",
              message: `✅ 예매 성공! 예약ID: ${reservationId.substring(0, 12)}...`,
            });
          } catch {}

          let summary = null;
          let amount = 0;
          try {
            summary = await getReservationSummary({
              reserveId: reservationId,
              cookie,
            });
            amount = pickTotalAmount(summary);
          } catch {}

          let paymentUrl = `https://pt.map.naver.com/end-train/bridges/payment/web/summary?reservationId=${reservationId}&from=payment&tripType=OW&lang=ko&userQuery=`;

          if (amount > 0) {
            try {
              const payResult = await requestNaverPay({
                reserveId: reservationId,
                productAmount: amount,
                railwayCompany:
                  target.railwayCompany || monitor.railwayCompany || "KORAIL",
                cookie,
              });

              paymentUrl = pickPaymentUrl(payResult) || paymentUrl;
            } catch {}
          }

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
            `✅ **예매 완료!**\n${monitor.trainName} ${monitor.trainNumber}\n${monitor.departureStopName} → ${monitor.arrivalStopName}\n💰 ${amount?.toLocaleString() || "?"}원\n\n💳 결제: ${paymentUrl}`,
            discordUrl
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

          try {
            await addLog({
              type: "error",
              message: `예매 실패 [${monitor.trainName} ${monitor.trainNumber}]: ${reserveErr.message}`,
            });
          } catch {}

          await sendDiscord(
            `❌ **예매 실패**\n${monitor.trainName} ${monitor.trainNumber}\n오류: ${reserveErr.message}`,
            discordUrl
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

      await new Promise((r) => setTimeout(r, 800));
    }

    return NextResponse.json({
      message: `${monitors.length}개 감시 체크 완료`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Cron 오류:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
