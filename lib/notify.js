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
  if (!settings?.notifyEmail || !process.env.RESEND_API_KEY) return;

  const clickUrl = extractFirstHttpUrl(message);
  let subject = "🚆 기차 예매 알림";
  if (message.includes("예매 완료")) subject = "🚆 KTX/열차 예매 성공!";
  else if (message.includes("좌석 발견")) subject = "🚆 기차 좌석 발견!";
  else if (message.includes("예매 실패")) subject = "🚆 기차 예매 실패 알림";

  await sendEmail(
    settings.notifyEmail,
    subject,
    messageToEmailHtml(message, clickUrl)
  );
}
