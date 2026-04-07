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
    const settings = await getSettings();

    if (!settings?.cookie) {
      return NextResponse.json({ error: "쿠키 미설정" }, { status: 400 });
    }

    let cookie = settings.cookie;
    if (!cookie.includes("NID_SES=") && !cookie.includes("=")) {
      cookie = `NID_SES=${cookie}`;
    }

    // 1. 예약 ID 생성
    const idResult = await createReservationId(cookie);
    const reservationId =
      idResult?.data?.reservationId || idResult?.reservationId;

    if (!reservationId) {
      throw new Error("예약 ID 생성 실패: " + JSON.stringify(idResult));
    }

    await addLog({
      type: "info",
      message: `예약ID 생성: ${reservationId.substring(0, 12)}...`,
    });

    // 2. 예매 실행
    const reserveResult = await reserveTicket({
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
      adultCount: parseInt(body.passengerCount) || 1,
      railwayCompany: body.railwayCompany || "KORAIL",
      ticketPassword: settings.ticketPassword || "0000",
      cookie,
    });

    await addLog({
      type: "success",
      message: `예매 요청 완료: ${JSON.stringify(reserveResult?.data || reserveResult).substring(0, 200)}`,
    });

    // 3. 예매 확인
    const summary = await getReservationSummary({
      reserveId: reservationId,
      cookie,
    });

    // 4. 네이버페이 결제 요청
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

        await addLog({
          type: "success",
          message: `결제 요청 완료 (${amount}원)`,
        });
      }
    } catch (payErr) {
      await addLog({
        type: "warn",
        message: `결제 요청 실패 (예매는 완료): ${payErr.message}`,
      });
    }

    return NextResponse.json({
      success: true,
      reservationId,
      reserveResult,
      summary,
      paymentResult,
    });
  } catch (e) {
    await addLog({ type: "error", message: `예매 실패: ${e.message}` });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
