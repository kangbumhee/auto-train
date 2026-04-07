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
    console.error("Discord 알림 실패:", e);
  }
}
