import { NextResponse } from "next/server";
import { saveMonitor, saveSettings, getSettings, addLog } from "@/lib/redis";
import { getUserProfile } from "@/lib/train-api";

const PLACEHOLDER_PREFIX = "(저장됨";

function normalizeCookieFromBody(bodyCookie, prev) {
  if (bodyCookie === undefined) {
    return prev?.cookie || "";
  }
  let cookie = String(bodyCookie).trim();
  if (cookie.startsWith(PLACEHOLDER_PREFIX)) {
    return prev?.cookie || "";
  }
  if (!cookie && prev?.cookie) {
    return prev.cookie;
  }
  if (cookie && !cookie.includes("=")) {
    cookie = `NID_SES=${cookie}`;
  }
  return cookie;
}

export async function PUT(request) {
  try {
    const body = await request.json();

    if (body.action === "saveSettings") {
      const prev = await getSettings();
      const cookie = normalizeCookieFromBody(body.cookie, prev);
      const checkInterval = Math.min(
        300,
        Math.max(10, Number(body.checkInterval) || 60)
      );

      await saveSettings({
        cookie,
        ticketPassword: body.ticketPassword || "0000",
        discordWebhook: body.discordWebhook || "",
        telegramBotToken:
          body.telegramBotToken !== undefined
            ? String(body.telegramBotToken)
            : prev?.telegramBotToken || "",
        telegramChatId:
          body.telegramChatId !== undefined
            ? String(body.telegramChatId)
            : prev?.telegramChatId || "",
        checkInterval,
      });

      let profile = null;
      if (cookie) {
        try {
          profile = await getUserProfile(cookie);
        } catch (e) {
          console.warn("프로필 확인 실패:", e.message);
        }
      }

      try {
        await addLog({
          type: "info",
          message: `설정 저장 (쿠키: ${cookie ? "있음" : "없음"}, 체크 간격: ${checkInterval}초)`,
        });
      } catch {}

      return NextResponse.json({
        message: "설정 저장 완료",
        profile: profile?.res || profile?.data || profile,
      });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (e) {
    console.error("설정 저장 오류:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { train } = body;

    if (!train) {
      return NextResponse.json(
        { error: "열차 정보가 없습니다" },
        { status: 400 }
      );
    }

    const id = `${train.trainNumber || "train"}_${body.departureDate || "date"}_${Date.now()}`;

    const monitorData = {
      status: "watching",
      trainNumber: train.trainNumber || "",
      trainName:
        train.trainDetailName ||
        train.trainName ||
        train.trainGroupName ||
        train.trainTypeName ||
        "열차",
      trainGroupCode: train.trainGroupCode || body.trainGroupCode || "109",
      departureStopId: body.departureStopId || "",
      arrivalStopId: body.arrivalStopId || "",
      departureStopCode: train.departureStopCode || "",
      arrivalStopCode: train.arrivalStopCode || "",
      departureStopRunOrder: train.departureStopRunOrder || "",
      arrivalStopRunOrder:
        train.arrivalStopRunOrder ||
        train.arrivalStopConsistRunOrder ||
        "",
      departureStopName: body.departureStopName || "",
      arrivalStopName: body.arrivalStopName || "",
      departureDate: body.departureDate || "",
      departureTime: train.departureTime || "",
      arrivalTime: train.arrivalTime || "",
      seatAttrCode: body.seatAttrCode || "015",
      passengerCount: body.passengerCount || "1",
      railwayCompany: train.railwayCompany || "KORAIL",
      attempts: 0,
      lastChecked: null,
      createdAt: new Date().toISOString(),
      reserveId: null,
      paymentUrl: null,
      error: null,
    };

    await saveMonitor(id, monitorData);

    try {
      await addLog({
        type: "info",
        message: `감시 시작: ${monitorData.trainName} ${monitorData.trainNumber} (${body.departureStopName}→${body.arrivalStopName}) ${body.departureDate} ${train.departureTime || ""}`,
      });
    } catch {}

    const numLabel = String(monitorData.trainNumber || "").replace(
      /^0+/,
      ""
    );

    return NextResponse.json({
      message: `${monitorData.trainName} ${numLabel || monitorData.trainNumber}호 감시가 등록되었습니다`,
      id,
    });
  } catch (e) {
    console.error("감시 시작 오류:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
