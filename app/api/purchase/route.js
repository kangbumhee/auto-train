import { NextResponse } from "next/server";
import {
  createReservationId,
  reserveTicket,
  getReservationSummary,
  requestNaverPay,
} from "@/lib/train-api";
import { getSettings, addLog } from "@/lib/redis";

export async function POST(request) {
  try {
    const body = await request.json();

    let settings;
    try {
      settings = await getSettings();
    } catch {
      return NextResponse.json({ error: "설정 불러오기 실패" }, { status: 500 });
    }

    if (!settings?.cookie) {
      return NextResponse.json({ error: "쿠키 미설정" }, { status: 400 });
    }

    const cookie = settings.cookie;

    const idResult = await createReservationId(cookie);
    const reservationId =
      idResult?.data?.reservationId || idResult?.reservationId;

    if (!reservationId) {
      throw new Error(
        "예약 ID 생성 실패: " +
          JSON.stringify(idResult).substring(0, 200)
      );
    }

    try {
      await addLog({
        type: "info",
        message: `예약ID 생성: ${reservationId.substring(0, 12)}...`,
      });
    } catch {}

    await reserveTicket({
      reservationId,
      runDate: body.departureDate,
      trainGroupCode: body.trainGroupCode,
      trainNumber: body.trainNumber,
      departureStopCode: body.departureStopCode,
      departureDate: body.departureDate,
      departureTime: body.departureTime,
      departureStopRunOrder: body.departureStopRunOrder || "000001",
      arrivalStopCode: body.arrivalStopCode,
      arrivalStopConsistRunOrder: body.arrivalStopRunOrder || "000099",
      seatAttrCode: body.seatAttrCode || "015",
      adultCount: parseInt(body.passengerCount, 10) || 1,
      railwayCompany: body.railwayCompany || "KORAIL",
      ticketPassword: settings.ticketPassword || "0000",
      cookie,
    });

    try {
      await addLog({ type: "success", message: "예매 요청 완료" });
    } catch {}

    let summary = null;
    try {
      summary = await getReservationSummary({
        reserveId: reservationId,
        cookie,
      });
    } catch {}

    let paymentResult = null;
    try {
      const amount =
        summary?.data?.totalAmount ||
        summary?.data?.paymentAmount ||
        body.estimatedAmount ||
        0;

      if (amount > 0) {
        paymentResult = await requestNaverPay({
          reserveId: reservationId,
          productAmount: amount,
          railwayCompany: body.railwayCompany || "KORAIL",
          cookie,
        });
      }
    } catch (payErr) {
      try {
        await addLog({
          type: "warn",
          message: `결제 요청 실패 (예매는 완료됨): ${payErr.message}`,
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      reservationId,
      summary,
      paymentResult,
    });
  } catch (e) {
    try {
      await addLog({ type: "error", message: `예매 실패: ${e.message}` });
    } catch {}
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
