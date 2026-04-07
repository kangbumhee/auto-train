import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const channel = body.channel;

    if (channel !== "email") {
      return NextResponse.json(
        { error: 'channel은 "email"만 지원합니다' },
        { status: 400 }
      );
    }

    const email = String(body.email || "").trim();
    if (!email) {
      return NextResponse.json({ error: "email 필요" }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "서버에 RESEND_API_KEY 미설정" },
        { status: 400 }
      );
    }

    await sendEmail(
      email,
      "🚆 기차 알림 테스트",
      "<p>기차 자동 예매 — <strong>Resend</strong> 이메일 테스트입니다.</p><p>이 메일이 보이면 정상입니다.</p>"
    );

    return NextResponse.json({ ok: true, message: "이메일 전송 시도 완료" });
  } catch (e) {
    console.error("notify/test:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
