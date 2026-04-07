import { NextResponse } from "next/server";
import { searchTrains } from "@/lib/train-api";
import { getSettings, addLog } from "@/lib/redis";

export async function POST(request) {
  try {
    const body = await request.json();

    let settings = null;
    try {
      settings = await getSettings();
    } catch {}

    if (!settings?.cookie) {
      return NextResponse.json({
        error: "설정 페이지에서 네이버 쿠키를 먼저 입력하세요",
        trains: [],
      });
    }

    const { trains } = await searchTrains({
      ...body,
      cookie: settings.cookie,
    });

    try {
      await addLog({
        type: "info",
        message: `시간표 조회: ${trains.length}개 열차 (${body.departureDate})`,
      });
    } catch {}

    return NextResponse.json({ trains });
  } catch (e) {
    console.error("검색 오류:", e);
    return NextResponse.json({ error: e.message, trains: [] });
  }
}
