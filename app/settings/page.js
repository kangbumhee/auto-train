"use client";
import { useState, useEffect } from "react";

const COOKIE_PLACEHOLDER = "(저장됨 - 변경하려면 새로 입력)";

export default function SettingsPage() {
  const [cookie, setCookie] = useState("");
  const [ticketPw, setTicketPw] = useState("0000");
  const [discordUrl, setDiscordUrl] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [checkInterval, setCheckInterval] = useState(60);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    fetch("/api/monitor/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          if (d.settings.hasCookie) setCookie(COOKIE_PLACEHOLDER);
          else setCookie("");
          setTicketPw(d.settings.ticketPassword || "0000");
          setDiscordUrl(d.settings.discordWebhook || "");
          setTelegramBotToken(d.settings.telegramBotToken || "");
          setTelegramChatId(d.settings.telegramChatId || "");
          setCheckInterval(d.settings.checkInterval || 60);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const payload = {
        action: "saveSettings",
        ticketPassword: ticketPw,
        discordWebhook: discordUrl,
        telegramBotToken,
        telegramChatId,
        checkInterval: Number(checkInterval),
      };

      if (cookie && !cookie.startsWith("(저장됨")) {
        payload.cookie = cookie;
      }

      const res = await fetch("/api/monitor/start", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSaved(true);
        setProfile(data.profile || null);
        setCookie(COOKIE_PLACEHOLDER);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const testTelegram = async () => {
    if (!telegramBotToken || !telegramChatId) {
      setTestResult("❌ Bot Token과 Chat ID를 입력하세요");
      return;
    }
    setTestResult("전송 중...");
    try {
      const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: "🚆 기차 자동 예매 시스템 테스트 알림입니다.\n✅ 텔레그램 연결 성공!",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult("✅ 전송 성공! 텔레그램을 확인하세요.");
      } else {
        setTestResult(`❌ 실패: ${data.description || "알 수 없는 오류"}`);
      }
    } catch (e) {
      setTestResult(`❌ 오류: ${e.message}`);
    }
  };

  const INTERVAL_OPTIONS = [
    { label: "10초", value: 10 },
    { label: "20초", value: 20 },
    { label: "30초", value: 30 },
    { label: "1분", value: 60 },
    { label: "2분", value: 120 },
    { label: "3분", value: 180 },
    { label: "5분", value: 300 },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <h2 className="text-lg font-bold mb-4">⚙️ 기본 설정</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              네이버 로그인 쿠키 (NID_SES) *
            </label>
            <textarea
              className="input-field h-20 text-xs font-mono"
              placeholder="NID_SES=... 또는 값만 입력"
              value={cookie}
              onFocus={(e) => {
                if (e.target.value.startsWith("(저장됨")) setCookie("");
              }}
              onChange={(e) => setCookie(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              승차권 비밀번호 (4자리)
            </label>
            <input
              type="text"
              className="input-field w-32"
              maxLength={5}
              placeholder="0000"
              value={ticketPw}
              onChange={(e) => setTicketPw(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              🕐 자동 체크 간격
            </label>
            <select
              className="select-field w-48"
              value={checkInterval}
              onChange={(e) => setCheckInterval(Number(e.target.value))}
            >
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} 마다
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">
              외부 Cron이 자주 호출해도 여기 간격보다 짧으면 서버에서 건너뜁니다.
              권장: 30초~1분
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-4">🔔 알림 설정</h2>
        <div className="space-y-5">
          <div className="p-4 rounded-lg border border-[#252540] bg-[#0d0d18]">
            <h3 className="text-sm font-bold text-blue-400 mb-3">
              📱 텔레그램 알림
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Bot Token
                </label>
                <input
                  type="text"
                  className="input-field text-xs font-mono"
                  placeholder="123456789:ABCdefGHI..."
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Chat ID
                </label>
                <input
                  type="text"
                  className="input-field text-xs font-mono w-48"
                  placeholder="123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-all"
                onClick={testTelegram}
              >
                📤 테스트 전송
              </button>
              {testResult && (
                <p
                  className={`text-xs ${testResult.includes("✅") ? "text-emerald-400" : "text-red-400"}`}
                >
                  {testResult}
                </p>
              )}
            </div>
            <ol className="mt-3 text-xs text-gray-600 space-y-1 list-decimal ml-4">
              <li>
                Telegram에서 <strong>@BotFather</strong> → /newbot 으로 봇 생성 후
                Token 복사
              </li>
              <li>생성한 봇에게 아무 메시지나 한 번 보내기</li>
              <li>
                브라우저에서{" "}
                <code className="text-gray-400">
                  https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
                </code>{" "}
                열어 <code className="text-gray-400">chat.id</code> 확인
              </li>
            </ol>
          </div>

          <div className="p-4 rounded-lg border border-[#252540] bg-[#0d0d18]">
            <h3 className="text-sm font-bold text-purple-400 mb-3">
              💬 디스코드 알림
            </h3>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                웹훅 URL
              </label>
              <input
                type="url"
                className="input-field text-xs"
                placeholder="https://discord.com/api/webhooks/..."
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary w-full"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "⏳ 저장 중..." : "💾 모든 설정 저장"}
      </button>

      {saved && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-sm text-emerald-400">✅ 설정이 저장되었습니다!</p>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">❌ {error}</p>
        </div>
      )}
      {profile && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <p className="text-sm text-blue-400">
            👤 로그인 확인:{" "}
            {profile.name ||
              profile.nickname ||
              profile.id ||
              "확인됨"}
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-bold mb-3">📖 쿠키 가져오는 방법</h2>
        <ol className="text-sm text-gray-400 space-y-2 list-decimal ml-4">
          <li>
            <a
              href="https://pt.map.naver.com/end-train/bridges/schedule-board/web/home?ac=ticket"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              네이버 기차 예매
            </a>
            접속 (로그인 상태)
          </li>
          <li>
            <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">F12</kbd>{" "}
            → Application → Cookies → pt.map.naver.com → NID_SES
          </li>
        </ol>
        <p className="text-xs text-yellow-500 mt-3">
          ⚠️ 쿠키는 자주 만료됩니다. 실패 시 갱신하세요.
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-3">⏰ 외부 Cron 설정</h2>
        <p className="text-sm text-gray-400 mb-2">
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            cron-job.org
          </a>{" "}
          등에서:
        </p>
        <div className="bg-[#0a0a12] p-3 rounded-lg font-mono text-xs space-y-1 break-all">
          <p className="text-gray-500">URL</p>
          <p className="text-emerald-400">
            {origin ? `${origin}/api/cron` : "/api/cron"}
          </p>
          <p className="text-gray-500 mt-2">Header</p>
          <p className="text-yellow-400">
            Authorization: Bearer &lt;CRON_SECRET&gt;
          </p>
          <p className="text-gray-500 mt-2">주기</p>
          <p className="text-white">Every 1 minute (권장)</p>
        </div>
      </div>
    </div>
  );
}
