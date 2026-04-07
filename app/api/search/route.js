import { NextResponse } from "next/server";
import { searchTrains } from "@/lib/train-api";
import { getSettings, addLog } from "@/lib/redis";

function extractTrains(result) {
  if (result?.data?.schedules) return result.data.schedules;
  if (result?.data?.trains) return result.data.trains;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.schedules) return result.schedules;
  if (result?.trains) return result.trains;
  return [];
}

export async function POST(request) {
  try {
    const body = await request.json();

    let settings = null;
    try {
      settings = await getSettings();
    } catch (e) {
      console.warn("설정 불러오기 실패:", e.message);
    }

    if (!settings?.cookie) {
      return NextResponse.json(
        { error: "설정 페이지에서 네이버 쿠키를 먼저 입력하세요", trains: [] },
        { status: 200 }
      );
    }

    const result = await searchTrains({
      ...body,
      cookie: settings.cookie,
    });

    const trains = extractTrains(result);

    try {
      await addLog({
        type: "info",
        message: `시간표 조회: ${trains.length}개 열차 (${body.departureDate || ""})`,
      });
    } catch {}

    return NextResponse.json({ trains, raw: result });
  } catch (e) {
    console.error("검색 오류:", e);
    return NextResponse.json({ error: e.message, trains: [] }, { status: 200 });
  }
}
