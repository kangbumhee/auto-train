import { saveSettings, getSettings, addLog } from "@/lib/redis";
import { getUserProfile } from "@/lib/train-api";

export function isPlaceholderCookie(cookie) {
  const s = String(cookie ?? "").trim();
  return s.startsWith("(저장됨") || s.startsWith("(서버에");
}

export function normalizeCookieFromBody(bodyCookie, prev) {
  if (bodyCookie === undefined) {
    return prev?.cookie || "";
  }
  let cookie = String(bodyCookie).trim();
  if (isPlaceholderCookie(cookie)) {
    return prev?.cookie || "";
  }
  if (!cookie && prev?.cookie) {
    return prev.cookie;
  }
  if (cookie && !cookie.includes("=")) {
    cookie = `NID_SES=${cookie}`;
  }
  return cookie;
}

/**
 * @param {object} body - train_settings 또는 saveSettings 페이로드 (savedAt 등 무시)
 */
export async function saveSettingsFromRequestBody(body) {
  const prev = await getSettings();
  const cookie = normalizeCookieFromBody(body.cookie, prev);
  const checkInterval = Math.min(
    300,
    Math.max(10, Number(body.checkInterval) || 60)
  );

  await saveSettings({
    cookie,
    checkInterval,
    notifyEmail:
      body.notifyEmail !== undefined
        ? String(body.notifyEmail).trim()
        : prev?.notifyEmail || "",
  });

  let profile = null;
  if (cookie) {
    try {
      profile = await getUserProfile(cookie);
    } catch (e) {
      console.warn("프로필 확인 실패:", e.message);
    }
  }

  try {
    await addLog({
      type: "info",
      message: `설정 저장 (쿠키: ${cookie ? "있음" : "없음"}, 체크 간격: ${checkInterval}초)`,
    });
  } catch {}

  return {
    message: "설정 저장 완료",
    profile: profile?.res || profile?.data || profile,
    hasCookie: Boolean(cookie),
  };
}
