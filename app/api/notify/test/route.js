import { NextResponse } from "next/server";
import {
  sendDiscord,
  sendTelegram,
  sendNtfy,
  sendEmail,
} from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const channel = body.channel;

    if (channel === "ntfy") {
      const topic = String(body.topic || "").trim();
      if (!topic) {
        return NextResponse.json({ error: "topic 필요" }, { status: 400 });
      }
      await sendNtfy(
        topic,
        "🚆 테스트 알림",
        "기차 자동 예매 — ntfy 연결 테스트입니다.\n✅ 푸시가 보이면 정상입니다.",
        undefined
      );
      return NextResponse.json({ ok: true, message: "ntfy 전송 시도 완료" });
    }

    if (channel === "email") {
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
    }

    if (channel === "discord") {
      const webhook = String(body.webhook || "").trim();
      if (!webhook) {
        return NextResponse.json({ error: "webhook 필요" }, { status: 400 });
      }
      await sendDiscord("🚆 기차 자동 예매 — 디스코드 테스트 알림", webhook);
      return NextResponse.json({ ok: true, message: "Discord 전송 시도 완료" });
    }

    if (channel === "telegram") {
      const botToken = String(body.botToken || "").trim();
      const chatId = String(body.chatId || "").trim();
      if (!botToken || !chatId) {
        return NextResponse.json(
          { error: "botToken, chatId 필요" },
          { status: 400 }
        );
      }
      await sendTelegram(
        "🚆 기차 자동 예매 — **텔레그램** 테스트입니다.",
        botToken,
        chatId
      );
      return NextResponse.json({ ok: true, message: "Telegram 전송 시도 완료" });
    }

    return NextResponse.json(
      { error: "channel은 ntfy | email | discord | telegram 중 하나" },
      { status: 400 }
    );
  } catch (e) {
    console.error("notify/test:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
