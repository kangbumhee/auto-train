"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [cookie, setCookie] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [checkInterval, setCheckInterval] = useState(60);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [emailTestResult, setEmailTestResult] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  useEffect(() => {
    try {
      const local = localStorage.getItem("train_settings");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.cookie) setCookie(parsed.cookie);
        if (parsed.checkInterval) setCheckInterval(parsed.checkInterval);
        if (parsed.notifyEmail) setNotifyEmail(parsed.notifyEmail);
      }
    } catch {}

    fetch("/api/monitor/status")
      .then((r) => r.json())
      .then((d) => {
        let localCookie = "";
        try {
          const parsed = JSON.parse(
            localStorage.getItem("train_settings") || "{}"
          );
          localCookie = parsed.cookie || "";
        } catch {}

        if (d.settings) {
          if (d.settings.hasCookie && !localCookie) {
            setCookie("(서버에 저장됨)");
          }
          if (d.settings.checkInterval)
            setCheckInterval(d.settings.checkInterval);
          if (d.settings.notifyEmail !== undefined)
            setNotifyEmail(d.settings.notifyEmail);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      let cookieToSave = cookie;
      if (cookie.startsWith("(서버에") || cookie.startsWith("(저장됨")) {
        try {
          const local = JSON.parse(
            localStorage.getItem("train_settings") || "{}"
          );
          cookieToSave = local.cookie || "";
        } catch {
          cookieToSave = "";
        }
      }

      const payload = {
        cookie: cookieToSave,
        notifyEmail: notifyEmail.trim(),
        checkInterval: Number(checkInterval),
      };

      try {
        localStorage.setItem(
          "train_settings",
          JSON.stringify({
            cookie: cookieToSave,
            notifyEmail: notifyEmail.trim(),
            checkInterval: Number(checkInterval),
            savedAt: new Date().toISOString(),
          })
        );
      } catch {}

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSaved(true);
        setProfile(data.profile || null);
        if (cookieToSave) setCookie(cookieToSave);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const testEmailNotify = async () => {
    if (!notifyEmail.trim()) {
      setEmailTestResult("❌ 이메일을 입력하세요");
      return;
    }
    setEmailTestResult("전송 중...");
    try {
      const res = await fetch("/api/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          email: notifyEmail.trim(),
        }),
      });
      const data = await res.json();
      setEmailTestResult(
        res.ok && data.ok
          ? "✅ 전송 요청 완료. 메일함(스팸함)을 확인하세요."
          : `❌ ${data.error || "실패"}`
      );
    } catch (e) {
      setEmailTestResult(`❌ 오류: ${e.message}`);
    }
  };

  const INTERVAL_OPTIONS = [
    { label: "10초", value: 10 },
    { label: "20초", value: 20 },
    { label: "30초", value: 30 },
    { label: "1분", value: 60 },
    { label: "2분", value: 120 },
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
              {cookie && !cookie.startsWith("(") && (
                <span className="ml-2 text-emerald-400 text-xs">✅ 저장됨</span>
              )}
            </label>
            <textarea
              className="input-field h-20 text-xs font-mono"
              placeholder="NID_SES=AAABr... (값만 또는 전체 쿠키 문자열)"
              value={cookie.startsWith("(") ? "" : cookie}
              onFocus={() => {
                if (cookie.startsWith("(")) setCookie("");
              }}
              onChange={(e) => setCookie(e.target.value)}
            />
            {cookie.startsWith("(") && (
              <p className="text-xs text-emerald-400 mt-1">
                ✅ 쿠키가 이미 저장되어 있습니다. 변경하려면 새로 입력하세요.
              </p>
            )}
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
            <p className="text-xs text-gray-600 mt-1">권장: 30초~1분</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-4">✉️ 이메일 알림</h2>
        <div className="p-4 rounded-lg border border-[#252540] bg-[#0d0d18] space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              알림 받을 주소
            </label>
            <input
              type="email"
              className="input-field text-xs"
              placeholder="user@gmail.com"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg"
            onClick={testEmailNotify}
          >
            📤 테스트 전송
          </button>
          {emailTestResult && (
            <p
              className={`text-xs ${emailTestResult.includes("✅") ? "text-emerald-400" : "text-red-400"}`}
            >
              {emailTestResult}
            </p>
          )}
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
          <p className="text-sm text-emerald-400">
            ✅ 설정 저장 완료! (브라우저 + 서버 모두 저장됨)
          </p>
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
            {profile.name || profile.nickname || "확인됨"}
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
            </a>{" "}
            접속 (로그인)
          </li>
          <li>
            <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">F12</kbd>{" "}
            → Application → Cookies
          </li>
          <li>
            pt.map.naver.com → <strong>NID_SES</strong> 값 복사
          </li>
        </ol>
        <p className="text-xs text-yellow-500 mt-3">
          ⚠️ 쿠키는 1~2일이면 만료. 실패 시 갱신하세요.
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-3">⏰ 외부 Cron (선택)</h2>
        <p className="text-sm text-gray-400 mb-2">
          페이지를 닫아도 감시하려면{" "}
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            cron-job.org
          </a>
          에서:
        </p>
        <div className="bg-[#0a0a12] p-3 rounded-lg font-mono text-xs space-y-1">
          <p className="text-emerald-400 break-all">
            {origin ? `${origin}/api/cron` : "https://your-app.vercel.app/api/cron"}
          </p>
          <p className="text-yellow-400">Authorization: Bearer {"<CRON_SECRET>"}</p>
        </div>
      </div>
    </div>
  );
}
