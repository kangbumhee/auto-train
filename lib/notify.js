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

  await Promise.allSettled(promises);
}
