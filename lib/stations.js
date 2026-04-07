// 주요 기차역 데이터 (실제 API에서 확인된 코드)
export const STATIONS = [
  { name: "서울역", stopId: "3300128", stopCode: "0001", provider: "korail" },
  { name: "용산역", stopId: "3300129", stopCode: "0003", provider: "korail" },
  { name: "영등포역", stopId: "3300130", stopCode: "0004", provider: "korail" },
  { name: "수원역", stopId: "3300131", stopCode: "0010", provider: "korail" },
  { name: "천안아산역", stopId: "3300289", stopCode: "0502", provider: "korail" },
  { name: "대전역", stopId: "3300137", stopCode: "0030", provider: "korail" },
  { name: "동대구역", stopId: "3300145", stopCode: "0015", provider: "korail" },
  { name: "대구역", stopId: "3300326", stopCode: "0507", provider: "korail" },
  { name: "부산역", stopId: "3300152", stopCode: "0020", provider: "korail" },
  { name: "광주송정역", stopId: "3300161", stopCode: "0036", provider: "korail" },
  { name: "목포역", stopId: "3300165", stopCode: "0041", provider: "korail" },
  { name: "전주역", stopId: "3300173", stopCode: "0045", provider: "korail" },
  { name: "익산역", stopId: "3300172", stopCode: "0044", provider: "korail" },
  { name: "창원역", stopId: "3300245", stopCode: "0057", provider: "korail" },
  { name: "창원중앙역", stopId: "3300247", stopCode: "0802", provider: "korail" },
  { name: "마산역", stopId: "3300248", stopCode: "0059", provider: "korail" },
  { name: "진주역", stopId: "3300250", stopCode: "0063", provider: "korail" },
  { name: "포항역", stopId: "3300265", stopCode: "0515", provider: "korail" },
  { name: "강릉역", stopId: "3300280", stopCode: "0115", provider: "korail" },
  { name: "수서역", stopId: "3300286", stopCode: "0551", provider: "korail" },
  { name: "오송역", stopId: "3300290", stopCode: "0297", provider: "korail" },
  { name: "울산(통도사)역", stopId: "3300291", stopCode: "0509", provider: "korail" },
  { name: "김천구미역", stopId: "3300292", stopCode: "0507", provider: "korail" },
];

export const TRAIN_TYPES = [
  { name: "전체", code: "109" },
  { name: "KTX/KTX-산천", code: "100" },
  { name: "ITX-새마을", code: "101" },
  { name: "무궁화/누리로", code: "102" },
  { name: "ITX-청춘/마음", code: "104" },
  { name: "SRT", code: "400" },
];

export const SEAT_TYPES = [
  { name: "일반좌석", code: "015" },
  { name: "유아동반석", code: "019" },
  { name: "수동휠체어석", code: "021" },
  { name: "전동휠체어석", code: "028" },
];

export const ROOM_TYPES = [
  { name: "일반실", code: "1" },
  { name: "특실", code: "2" },
];
