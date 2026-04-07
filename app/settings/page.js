"use client";
import { useState, useEffect } from "react";

const COOKIE_PLACEHOLDER = "(저장됨 - 변경하려면 새로 입력)";

export default function SettingsPage() {
  const [cookie, setCookie] = useState("");
  const [ticketPw, setTicketPw] = useState("0000");
  const [discordUrl, setDiscordUrl] = useState("");
  const [checkInterval, setCheckInterval] = useState(60);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
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
        <h2 className="text-lg font-bold mb-4">⚙️ 설정</h2>

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
                if (e.target.value.startsWith("(저장됨")) {
                  setCookie("");
                }
              }}
              onChange={(e) => setCookie(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              승차권 비밀번호 (4자리 숫자)
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
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} 마다 체크
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">
              외부 Cron이 매분 호출해도, 여기 간격보다 짧으면 서버에서 건너뜁니다.
              권장: 30초~1분
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              디스코드 웹훅 URL (선택)
            </label>
            <input
              type="url"
              className="input-field"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn-primary w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "⏳ 저장 중..." : "💾 설정 저장"}
          </button>

          {saved && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-sm text-emerald-400">✅ 저장 완료!</p>
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
                {profile.name || profile.nickname || profile.id || "확인됨"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-3">📖 쿠키 가져오는 방법</h2>
        <ol className="text-sm text-gray-400 space-y-3 list-decimal ml-4">
          <li>
            <a
              href="https://pt.map.naver.com/end-train/bridges/schedule-board/web/home?ac=ticket"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              네이버 기차 예매 페이지
            </a>
            에 접속 (로그인 상태)
          </li>
          <li>
            <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">F12</kbd>로
            개발자 도구 → Application → Cookies → pt.map.naver.com → NID_SES
            Value 복사
          </li>
        </ol>
        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-xs text-yellow-400">
            ⚠️ 쿠키는 자주 만료됩니다. 예매 실패 시 갱신하세요. 타인과 공유하지
            마세요.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-3">⏰ 외부 Cron (자동 감시)</h2>
        <p className="text-sm text-gray-400 mb-3">
          Vercel Hobby는 분 단격 Cron이 제한될 수 있습니다. cron-job.org 등에서
          아래처럼 호출하세요.
        </p>
        <div className="bg-[#0a0a12] p-3 rounded-lg font-mono text-xs space-y-1 break-all">
          <p className="text-gray-500">URL</p>
          <p className="text-emerald-400">
            {origin ? `${origin}/api/cron` : "/api/cron"}
          </p>
          <p className="text-gray-500 mt-2">Method</p>
          <p className="text-blue-400">GET</p>
          <p className="text-gray-500 mt-2">Header</p>
          <p className="text-yellow-400">
            Authorization: Bearer &lt;CRON_SECRET&gt;
          </p>
          <p className="text-gray-500 mt-2">권장</p>
          <p className="text-white">1분마다 호출 + 위 &quot;자동 체크 간격&quot;과 맞추기</p>
        </div>
      </div>
    </div>
  );
}
