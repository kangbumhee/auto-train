export async function sendDiscord(message, webhookUrl) {
  const url = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message,
        username: "🚆 기차예매봇",
      }),
    });
  } catch (e) {
    console.error("Discord 알림 실패:", e.message);
  }
}

export async function sendTelegram(message, botToken, chatId) {
  if (!botToken || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const text = message.replace(/\*\*(.+?)\*\*/g, "$1");
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
  } catch (e) {
    console.error("Telegram 알림 실패:", e.message);
  }
}

function extractFirstHttpUrl(text) {
  const m = String(text).match(/https?:\/\/[^\s<>\u0000-\u001f]+/);
  if (!m) return null;
  return m[0].replace(/[),.\]]+$/, "");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function messageToEmailHtml(message, paymentUrl) {
  const raw = escapeHtml(message);
  const withBold = raw
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
  let payBlock = "";
  if (paymentUrl) {
    const u = escapeHtml(paymentUrl);
    payBlock = `<p style="margin:20px 0;"><a href="${u}" style="display:inline-block;padding:12px 22px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">💳 결제하기</a></p>`;
  }
  return `<div style="font-family:system-ui,sans-serif;line-height:1.65;color:#111;max-width:560px;">
${withBold}
<p style="color:#b45309;font-weight:700;margin-top:18px;">⏰ 승차권은 약 <strong>20분 내</strong> 결제를 완료하세요. 미결제 시 예약이 취소될 수 있습니다.</p>
${payBlock}
</div>`;
}

export async function sendNtfy(topic, title, message, clickUrl) {
  const t = String(topic || "").trim();
  if (!t) return;

  try {
    const url = `https://ntfy.sh/${encodeURIComponent(t)}`;
    const headers = {
      Title: (title || "🚆 기차 예매").slice(0, 200),
      Priority: "urgent",
      Tags: "train,tada",
      Markdown: "yes",
    };
    if (clickUrl) headers.Click = clickUrl;

    await fetch(url, {
      method: "POST",
      headers,
      body: message,
      cache: "no-store",
    });
  } catch (e) {
    console.error("ntfy 알림 실패:", e.message);
  }
}

export async function sendEmail(to, subject, htmlBody) {
  const key = process.env.RESEND_API_KEY;
  const addr = String(to || "").trim();
  if (!addr || !key) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Train Alert <onboarding@resend.dev>",
        to: [addr],
        subject: subject.slice(0, 200),
        html: htmlBody,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend HTTP 실패:", res.status, errText.slice(0, 300));
    }
  } catch (e) {
    console.error("Resend 이메일 실패:", e.message);
  }
}

export async function sendNotification(message, settings) {
  if (!settings) return;

  const promises = [];

  if (settings.discordWebhook) {
    promises.push(sendDiscord(message, settings.discordWebhook));
  }

  if (settings.telegramBotToken && settings.telegramChatId) {
    promises.push(
      sendTelegram(
        message,
        settings.telegramBotToken,
        settings.telegramChatId
      )
    );
  }

  if (
    !settings.discordWebhook &&
    process.env.DISCORD_WEBHOOK_URL
  ) {
    promises.push(sendDiscord(message));
  }

  if (settings.ntfyTopic) {
    const clickUrl = extractFirstHttpUrl(message);
    const title =
      message.split("\n")[0]?.replace(/\*\*/g, "").trim().slice(0, 120) ||
      "🚆 기차 알림";
    promises.push(
      sendNtfy(
        settings.ntfyTopic,
        title,
        message,
        clickUrl || undefined
      )
    );
  }

  if (settings.notifyEmail && process.env.RESEND_API_KEY) {
    const clickUrl = extractFirstHttpUrl(message);
    let subject = "🚆 기차 예매 알림";
    if (message.includes("예매 완료")) subject = "🚆 KTX/열차 예매 성공!";
    else if (message.includes("좌석 발견")) subject = "🚆 기차 좌석 발견!";
    else if (message.includes("예매 실패")) subject = "🚆 기차 예매 실패 알림";

    promises.push(
      sendEmail(
        settings.notifyEmail,
        subject,
        messageToEmailHtml(message, clickUrl)
      )
    );
  }

  await Promise.allSettled(promises);
}
