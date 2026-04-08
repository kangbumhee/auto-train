import { NextResponse } from "next/server";
import {
  getActiveMonitors,
  getSettings,
  saveMonitor,
  addLog,
  getCronLastRunMs,
  setCronLastRunMs,
  getRedis,
} from "@/lib/redis";
import {
  searchTrains,
  createReservationId,
  reserveTicket,
  getReservationSummary,
  requestNaverPay,
  pickTotalAmount,
  pickPaymentUrl,
} from "@/lib/train-api";
import { sendNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isCookieAuthError(message) {
  const s = String(message || "");
  return /\b401\b/.test(s) || s.includes("05010000");
}

function humanizeReserveError(message) {
  return isCookieAuthError(message)
    ? "⚠️ 네이버 쿠키가 만료되었습니다. 설정 페이지에서 새 쿠키를 입력하세요."
    : String(message || "알 수 없는 오류");
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const fromDashboard = searchParams.get("from") === "dashboard";

  if (
    cronSecret &&
    !fromDashboard &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redisConfigured = !!(
      redisUrl &&
      redisToken &&
      redisUrl !== "여기에_Upstash_Redis_URL" &&
      !String(redisUrl).includes("여기에_Upstash") &&
      !String(redisToken).includes("여기에")
    );

    let monitors = [];
    let monitorError = null;
    try {
      monitors = await getActiveMonitors();
    } catch (e) {
      monitorError = e.message;
    }

    const memoryMode = getRedis() === null;

    if (monitors.length === 0) {
      return NextResponse.json({
        message: "감시 대상 없음",
        checked: 0,
        debug: {
          redisConfigured,
          memoryMode,
          redisUrl: redisUrl ? `${String(redisUrl).substring(0, 30)}...` : "미설정",
          monitorError,
          monitorsRaw: monitors,
        },
      });
    }

    let settings = null;
    try {
      settings = await getSettings();
    } catch {}

    if (!settings?.cookie) {
      return NextResponse.json({ error: "쿠키 미설정", checked: 0 });
    }

    if (!fromDashboard) {
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
    }

    const cookie = settings.cookie;
    const results = [];

    for (const monitor of monitors) {
      if (["reserved", "paid", "failed"].includes(monitor.status)) {
        results.push({ id: monitor.id, status: monitor.status, skipped: true });
        continue;
      }

      try {
        if (
          monitor.status === "watching" &&
          monitor.error &&
          (monitor.attempts || 0) >= 5
        ) {
          const stopMsg = `${monitor.error} (동일 오류가 5회 이상 반복되어 자동 중지했습니다. 쿠키를 갱신한 뒤 대시보드에서 🔄 재시도를 누르세요.)`;
          await saveMonitor(monitor.id, {
            ...monitor,
            status: "failed",
            error: stopMsg,
            lastChecked: new Date().toISOString(),
          });
          try {
            await addLog({
              type: "error",
              message: `자동 중지 [${monitor.trainName}]: 연속 오류 5회+`,
            });
          } catch {}
          results.push({
            id: monitor.id,
            status: "failed",
            error: "auto_stopped_repeat_errors",
          });
          continue;
        }

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
        const numShort = String(monitor.trainNumber || "").replace(
          /^0+/,
          ""
        );

        if (!target) {
          await saveMonitor(monitor.id, {
            ...monitor,
            attempts,
            lastChecked: new Date().toISOString(),
            error: `열차 ${monitor.trainNumber} 없음 (${trains.length}개 중)`,
          });
          results.push({ id: monitor.id, status: "not_found" });
          continue;
        }

        const seatStatus = (
          target.generalReserveName ||
          target.generalSeatStatus ||
          ""
        ).toString();

        const soldOut =
          target.generalReserveName === "매진" ||
          seatStatus.includes("매진") ||
          seatStatus.includes("Sold") ||
          target.seatAvailable === false;

        if (soldOut) {
          await saveMonitor(monitor.id, {
            ...monitor,
            attempts,
            lastChecked: new Date().toISOString(),
            status: "watching",
            error: null,
          });

          try {
            await addLog({
              type: "check",
              message: `[${monitor.trainName} ${numShort || monitor.trainNumber}] ${attempts}회 체크 - 매진`,
            });
          } catch {}

          results.push({ id: monitor.id, status: "sold_out", attempts });
          continue;
        }

        try {
          await addLog({
            type: "success",
            message: `🎉 좌석 발견! ${monitor.trainName} ${numShort || monitor.trainNumber} (${target.generalReserveName || ""})`,
          });
        } catch {}

        await sendNotification(
          `🎉 **좌석 발견!**\n${monitor.trainName} ${numShort || monitor.trainNumber}\n${monitor.departureStopName} → ${monitor.arrivalStopName}\n좌석: ${target.generalReserveName || "-"}\n⚡ 자동 예매 시작...`,
          settings
        );

        await saveMonitor(monitor.id, {
          ...monitor,
          status: "reserving",
          attempts,
          lastChecked: new Date().toISOString(),
        });

        const { reserveId } = await createReservationId(cookie);
        if (!reserveId) {
          throw new Error("예약 ID 생성 실패");
        }

        try {
          await addLog({
            type: "info",
            message: `예약ID: ${reserveId.substring(0, 16)}...`,
          });
        } catch {}

        await reserveTicket({
          reservationId: reserveId,
          runDate: target.runDate || monitor.departureDate,
          trainGroupCode:
            target.trainGroupCode || monitor.trainGroupCode || "100",
          trainNumber: String(monitor.trainNumber),
          departureStopCode:
            target.departureStopCode || monitor.departureStopCode || "",
          departureDate: target.departureDate || monitor.departureDate,
          departureTime: target.departureTime || monitor.departureTime || "",
          departureStopRunOrder:
            target.departureStopRunOrder ||
            monitor.departureStopRunOrder ||
            "000001",
          arrivalStopCode:
            target.arrivalStopCode || monitor.arrivalStopCode || "",
          arrivalStopConsistRunOrder:
            target.arrivalStopRunOrder ||
            monitor.arrivalStopRunOrder ||
            "000099",
          seatAttrCode: monitor.seatAttrCode || "015",
          adultCount: parseInt(monitor.passengerCount, 10) || 1,
          railwayCompany:
            target.railwayCompany || monitor.railwayCompany || "KORAIL",
          ticketPassword: "0000",
          cookie,
        });

        try {
          await addLog({ type: "success", message: "✅ 예매 성공!" });
        } catch {}

        let amount = 0;
        let paymentUrl = `https://pt.map.naver.com/end-train/bridges/payment/web/summary?reservationId=${reserveId}&from=payment&tripType=OW&lang=ko&userQuery=`;

        try {
          const summary = await getReservationSummary({
            reserveId,
            cookie,
          });
          amount = pickTotalAmount(summary);
          if (amount > 0) {
            const payResult = await requestNaverPay({
              reserveId,
              productAmount: amount,
              railwayCompany:
                target.railwayCompany || monitor.railwayCompany || "KORAIL",
              cookie,
            });
            paymentUrl = pickPaymentUrl(payResult) || paymentUrl;
          }
        } catch (payErr) {
          try {
            await addLog({
              type: "warn",
              message: `결제 요청 실패 (예매는 완료): ${payErr.message}`,
            });
          } catch {}
          if (isCookieAuthError(payErr.message)) {
            await saveMonitor(monitor.id, {
              ...monitor,
              status: "failed",
              error: humanizeReserveError(payErr.message),
              attempts,
              lastChecked: new Date().toISOString(),
              reserveId,
              paymentUrl,
              amount,
            });
            await sendNotification(
              `❌ **결제 단계 오류**\n${monitor.trainName}: ${humanizeReserveError(payErr.message)}`,
              settings
            );
            results.push({
              id: monitor.id,
              status: "failed",
              error: humanizeReserveError(payErr.message),
            });
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
        }

        await saveMonitor(monitor.id, {
          ...monitor,
          status: "reserved",
          reserveId,
          paymentUrl,
          amount,
          attempts,
          lastChecked: new Date().toISOString(),
          error: null,
        });

        await sendNotification(
          `✅ **예매 완료!**\n${monitor.trainName} ${numShort || monitor.trainNumber}\n${monitor.departureStopName} → ${monitor.arrivalStopName}\n💰 ${amount?.toLocaleString() || "?"}원\n💳 ${paymentUrl}`,
          settings
        );

        results.push({
          id: monitor.id,
          status: "reserved",
          reserveId,
        });
      } catch (err) {
        const displayError = humanizeReserveError(err.message);
        await saveMonitor(monitor.id, {
          ...monitor,
          status: "failed",
          error: displayError,
          attempts: (monitor.attempts || 0) + 1,
          lastChecked: new Date().toISOString(),
        });

        try {
          await addLog({
            type: "error",
            message: `❌ 실패 [${monitor.trainName}]: ${displayError}`,
          });
        } catch {}

        await sendNotification(
          `❌ **예매 실패**\n${monitor.trainName}: ${displayError}`,
          settings
        );

        results.push({
          id: monitor.id,
          status: "failed",
          error: displayError,
        });
      }

      await new Promise((r) => setTimeout(r, 800));
    }

    return NextResponse.json({
      message: `${monitors.length}개 체크 완료`,
      results,
      timestamp: new Date().toISOString(),
      fromDashboard,
      activeMonitorCount: monitors.length,
      monitorsSummary: monitors.map((m) => ({
        id: m.id,
        status: m.status,
        trainNumber: m.trainNumber,
      })),
    });
  } catch (e) {
    console.error("Cron 오류:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
