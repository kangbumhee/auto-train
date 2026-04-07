import { NextResponse } from "next/server";
import { searchTrains } from "@/lib/train-api";
import { getSettings } from "@/lib/redis";

export async function POST(request) {
  try {
    const body = await request.json();
    const settings = await getSettings();

    if (!settings?.cookie) {
      return NextResponse.json(
        { error: "설정 페이지에서 네이버 쿠키를 먼저 입력하세요" },
        { status: 400 }
      );
    }

    // 쿠키 형식 맞추기
    let cookie = settings.cookie;
    if (!cookie.includes("NID_SES=") && !cookie.includes("=")) {
      cookie = `NID_SES=${cookie}`;
    }

    const result = await searchTrains({
      ...body,
      cookie,
    });

    // 응답에서 열차 목록 추출
    const trains = result?.data?.trains || result?.trains || result?.data || [];

    return NextResponse.json({ trains, raw: result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
