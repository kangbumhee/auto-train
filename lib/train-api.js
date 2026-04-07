const BASE = "https://pt.map.naver.com/end-train/api";

async function api(path, { method = "POST", body, cookie }) {
  const isGet = method === "GET";

  const headers = {
    Accept: "application/json",
    Cookie: cookie || "",
    Referer: "https://pt.map.naver.com/end-train/bridges/schedule-board/web/home",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Origin: "https://pt.map.naver.com",
  };

  if (!isGet) {
    headers["Content-Type"] = "application/json";
  }

  const options = { method, headers };
  if (!isGet && body) {
    options.body = JSON.stringify(body);
  }

  const url = `${BASE}${path}`;

  let res;
  try {
    res = await fetch(url, options);
  } catch (fetchErr) {
    throw new Error(`네트워크 오류 (${path}): ${fetchErr.message}`);
  }

  let text;
  try {
    text = await res.text();
  } catch {
    text = "";
  }

  if (!res.ok) {
    throw new Error(`API ${path} [${res.status}]: ${text.substring(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function formatCookie(cookie) {
  if (!cookie) return "";
  let c = String(cookie).trim();
  if (!c.includes("=")) {
    return `NID_SES=${c}`;
  }
  return c;
}

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
      departureStopCode: String(departureStopCode),
      arrivalStopCode: String(arrivalStopCode),
      changeTrainDivisionCode: "1",
      trainGroupCode: String(trainGroupCode),
      seatAttrCode: String(seatAttrCode),
      passengerCount: String(passengerCount),
    },
    cookie: formatCookie(cookie),
  });
}

export async function createReservationId(cookie) {
  return api("/train-reservation-id", {
    body: {},
    cookie: formatCookie(cookie),
  });
}

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
    cookie: formatCookie(cookie),
  });
}

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
    cookie: formatCookie(cookie),
  });
}

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
      ticketPassword: String(ticketPassword),
      journeyList: [
        {
          journeySequenceNumber: "0001",
          runDate,
          trainGroupCode: String(trainGroupCode),
          trainNumber: String(trainNumber),
          stopLaborTrainCfCode: "00",
          departureStopCode: String(departureStopCode),
          departureDate,
          departureTime,
          departureStopRunOrder: String(departureStopRunOrder),
          arrivalStopCode: String(arrivalStopCode),
          arrivalStopConsistRunOrder: String(arrivalStopConsistRunOrder),
          scarNumber: "",
          seatNumber: "",
          passengerClassCode: "1",
        },
      ],
      railwayCompany,
    },
    cookie: formatCookie(cookie),
  });
}

export async function getReservationSummary({ reserveId, cookie }) {
  return api("/train-reservations-tickets-summaries", {
    body: { reserveId },
    cookie: formatCookie(cookie),
  });
}

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
    cookie: formatCookie(cookie),
  });
}

export async function getUserProfile(cookie) {
  return api(`/user-profile?ts=${Date.now()}`, {
    method: "GET",
    cookie: formatCookie(cookie),
  });
}

export async function getMyReservations(cookie) {
  return api("/train-my-reservations", {
    body: {},
    cookie: formatCookie(cookie),
  });
}
