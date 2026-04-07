const BASE = "https://pt.map.naver.com/end-train/api";

async function api(path, { method = "POST", body, cookie }) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Cookie: cookie,
    Referer: "https://pt.map.naver.com/end-train/bridges/schedule-board/web/home",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} 실패 [${res.status}]: ${text}`);
  }

  return res.json();
}

// 1. 시간표 조회
export async function searchTrains({
  departureDate,
  departureTime = "000000",
  departureStopCode,
  arrivalStopCode,
  trainGroupCode = "109",
  seatAttrCode = "015",
  passengerCount = "1",
  cookie,
}) {
  return api("/train-schedule", {
    body: {
      departureDate,
      departureTime,
      departureStopCode,
      arrivalStopCode,
      changeTrainDivisionCode: "1",
      trainGroupCode,
      seatAttrCode,
      passengerCount,
    },
    cookie,
  });
}

// 2. 예약 ID 생성
export async function createReservationId(cookie) {
  return api("/train-reservation-id", { body: {}, cookie });
}

// 3. 요금 조회
export async function getTrainFare({
  runDate,
  trainNumber,
  departureStopCode,
  arrivalStopCode,
  seatAttrCode = "015",
  railwayCompany = "KORAIL",
  cookie,
}) {
  return api("/train-fare", {
    body: {
      runDate,
      trainNumber,
      departureStopCode,
      arrivalStopCode,
      seatAttrCode,
      changeTrainDivisionCode: "1",
      railwayCompany,
    },
    cookie,
  });
}

// 4. 잔여석 조회
export async function getRestSeat({
  arrivalStopCode,
  arrivalStopRunOrder,
  departureDate,
  departureStopCode,
  departureStopRunOrder,
  departureTime,
  passengerRoomClassCode = "1",
  reqSeatCount = "0001",
  runDate,
  seatAttrCode = "015",
  trainGroupCode,
  trainNumber,
  railwayCompany = "KORAIL",
  cookie,
}) {
  return api("/train-rest-seat", {
    body: {
      arrivalStopCode,
      arrivalStopRunOrder,
      departureDate,
      departureStopCode,
      departureStopRunOrder,
      departureTime,
      passengerRoomClassCode,
      reqSeatCount,
      runDate,
      seatAttrCode,
      trainGroupCode,
      trainNumber,
      railwayCompany,
    },
    cookie,
  });
}

// 5. 예매 실행 (좌석 확보)
export async function reserveTicket({
  reservationId,
  runDate,
  trainGroupCode,
  trainNumber,
  departureStopCode,
  departureDate,
  departureTime,
  departureStopRunOrder,
  arrivalStopCode,
  arrivalStopConsistRunOrder,
  seatAttrCode = "015",
  adultCount = 1,
  railwayCompany = "KORAIL",
  ticketPassword = "0000",
  cookie,
}) {
  return api("/train-reservation-tickets", {
    body: {
      reservationId,
      tripType: "OW",
      controlDivisionCode: "1101",
      adultPassengerCount: adultCount,
      infantPassengerCount: 0,
      childPassengerCount: 0,
      passengerCount5: 0,
      passengerCount6: 0,
      seniorPassengerCount: 0,
      reqSeatAttrCode: seatAttrCode,
      directionSeatAttrCode: "",
      locationSeatAttrCode: "",
      email: "",
      noneMemberCustomerName: "",
      tel: "",
      ticketPassword,
      journeyList: [
        {
          journeySequenceNumber: "0001",
          runDate,
          trainGroupCode,
          trainNumber,
          stopLaborTrainCfCode: "00",
          departureStopCode,
          departureDate,
          departureTime,
          departureStopRunOrder,
          arrivalStopCode,
          arrivalStopConsistRunOrder,
          scarNumber: "",
          seatNumber: "",
          passengerClassCode: "1",
        },
      ],
      railwayCompany,
    },
    cookie,
  });
}

// 6. 예매 확인 (요약)
export async function getReservationSummary({ reserveId, cookie }) {
  return api("/train-reservations-tickets-summaries", {
    body: { reserveId },
    cookie,
  });
}

// 7. 네이버페이 결제 요청
export async function requestNaverPay({
  reserveId,
  productAmount,
  railwayCompany = "KORAIL",
  cookie,
}) {
  return api("/train-booking-naverpay-reservation", {
    body: {
      reserveId,
      tripType: "OW",
      enterPath: "",
      productAmount: String(productAmount),
      productCount: "1",
      returnUrl: `https://pt.map.naver.com/end-train/bridges/payment/web/summary?reservationId=${reserveId}&from=payment&tripType=OW&lang=ko&userQuery=`,
      railwayCompany,
    },
    cookie,
  });
}

// 8. 유저 프로필
export async function getUserProfile(cookie) {
  return api(`/user-profile?ts=${Date.now()}`, {
    method: "GET",
    cookie,
  });
}

// 9. 내 예약 목록
export async function getMyReservations(cookie) {
  return api("/train-my-reservations", { body: {}, cookie });
}
