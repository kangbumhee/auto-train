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

  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
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
  const c = String(cookie).trim();
  if (!c.includes("=")) {
    return `NID_SES=${c}`;
  }
  return c;
}

function getSchedulesPayload(raw) {
  const resBlock = raw?.res ?? raw?.data?.res ?? raw?.data;
  const schedules = resBlock?.schedules ?? raw?.data?.schedules;
  return Array.isArray(schedules) ? schedules : null;
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
  const raw = await api("/train-schedule", {
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

  let trainList = [];
  try {
    const schedules = getSchedulesPayload(raw);
    if (schedules?.length > 0) {
      trainList = schedules[0].trainList || [];
    }
  } catch {
    trainList = [];
  }

  const trains = trainList.map((t) => ({
    _raw: t,
    trainNumber: t.trainNumber,
    trainGroupCode: t.trainGroupCode?.id || t.trainGroupCode || "",
    trainGroupName: t.trainGroupCode?.name || "",
    trainDetailName:
      t.stopLaborTrainCfCode?.name || t.trainGroupCode?.name || "",
    railwayCompany: t.railwayCompany || "KORAIL",
    departureDate: t.departureDate,
    departureTime: t.departureTime,
    arrivalDate: t.arrivalDate,
    arrivalTime: t.arrivalTime,
    runDate: t.runDate,
    runTime: t.runTime,
    departureStopCode: t.departureReserveStopCode,
    departureStopName: t.departureStopName,
    departureStopRunOrder: t.departureStopRunOrder,
    arrivalStopCode: t.arrivalReserveStopCode,
    arrivalStopName: t.arrivalStopName,
    arrivalStopRunOrder: t.arrivalStopRunOrder,
    generalReserveCode: t.generalRoomReserveCode,
    generalReserveName: t.generalRoomReserveName,
    specialReserveCode: t.specialRoomReserveCode,
    specialReserveName: t.specialRoomReserveName,
    specialRoomExist: t.specialRoomExistYn === "Y",
    generalSeatmapFlag: t.generalRoomSeatmapFlag,
    specialSeatmapFlag: t.specialRoomSeatmapFlag,
    changeTrainDivisionCode: t.changeTrainDivisionCode,
    seatAttrCode: t.seatAttrCode?.id || "015",
    generalSeatStatus: t.generalRoomReserveName,
    specialSeatStatus: t.specialRoomReserveName,
  }));

  return { trains, raw };
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

export async function getRestSeat(params) {
  return api("/train-rest-seat", {
    body: {
      arrivalStopCode: params.arrivalStopCode,
      arrivalStopRunOrder: params.arrivalStopRunOrder,
      departureDate: params.departureDate,
      departureStopCode: params.departureStopCode,
      departureStopRunOrder: params.departureStopRunOrder,
      departureTime: params.departureTime,
      passengerRoomClassCode: params.passengerRoomClassCode || "1",
      reqSeatCount: params.reqSeatCount || "0001",
      runDate: params.runDate,
      seatAttrCode: params.seatAttrCode || "015",
      trainGroupCode: params.trainGroupCode,
      trainNumber: params.trainNumber,
      railwayCompany: params.railwayCompany || "KORAIL",
    },
    cookie: formatCookie(params.cookie),
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

/** 응답에서 예약 ID 추출 (res / data 혼용 대비) */
export function pickReservationId(idResult) {
  return (
    idResult?.res?.reservationId ||
    idResult?.data?.reservationId ||
    idResult?.reservationId
  );
}

export function pickTotalAmount(summary) {
  return (
    summary?.res?.totalAmount ??
    summary?.res?.paymentAmount ??
    summary?.data?.totalAmount ??
    summary?.data?.paymentAmount ??
    0
  );
}

export function pickPaymentUrl(payResult) {
  return (
    payResult?.res?.paymentUrl ||
    payResult?.data?.paymentUrl ||
    payResult?.paymentUrl
  );
}
