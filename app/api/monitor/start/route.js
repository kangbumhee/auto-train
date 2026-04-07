import { NextResponse } from "next/server";
import { saveMonitor, saveSettings, getSettings, addLog } from "@/lib/redis";
import { getUserProfile } from "@/lib/train-api";

// PUT: 설정 저장
export async function PUT(request) {
  try {
    const body = await request.json();

    if (body.action === "saveSettings") {
      const prev = await getSettings();
      let cookie = body.cookie || "";
      // NID_SES 값만 넣은 경우 쿠키 형식으로 변환
      if (cookie && !cookie.includes("NID_SES=") && !cookie.includes("=")) {
        cookie = `NID_SES=${cookie}`;
      }
      // 빈 문자열이면 기존 쿠키 유지
      if (!cookie && prev?.cookie) {
        cookie = prev.cookie;
      }

      await saveSettings({
        cookie,
        ticketPassword: body.ticketPassword || "0000",
        discordWebhook: body.discordWebhook || "",
      });

      let profile = null;
      try {
        if (cookie) {
          profile = await getUserProfile(cookie);
        }
      } catch (e) {}

      return NextResponse.json({
        message: "설정 저장 완료",
        profile: profile?.data || profile,
      });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 감시 시작
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

    const id = `${train.trainNumber}_${body.departureDate}_${Date.now()}`;

    const monitorData = {
      status: "watching",
      trainNumber: train.trainNumber,
      trainName: train.trainName || train.trainGroupName || "열차",
      trainGroupCode: train.trainGroupCode || body.trainGroupCode,
      departureStopId: body.departureStopId,
      arrivalStopId: body.arrivalStopId,
      departureStopCode: train.departureStopCode,
      arrivalStopCode: train.arrivalStopCode,
      departureStopRunOrder: train.departureStopRunOrder,
      arrivalStopRunOrder: train.arrivalStopRunOrder || train.arrivalStopConsistRunOrder,
      departureStopName: body.departureStopName,
      arrivalStopName: body.arrivalStopName,
      departureDate: body.departureDate,
      departureTime: train.departureTime,
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
    await addLog({
      type: "info",
      message: `감시 시작: ${monitorData.trainName} ${train.trainNumber} (${body.departureStopName}→${body.arrivalStopName}) ${body.departureDate} ${train.departureTime}`,
    });

    return NextResponse.json({
      message: "감시가 시작되었습니다",
      id,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
