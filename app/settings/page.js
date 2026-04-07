"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [cookie, setCookie] = useState("");
  const [ticketPw, setTicketPw] = useState("0000");
  const [discordUrl, setDiscordUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(null);
  const [hasCookie, setHasCookie] = useState(false);

  useEffect(() => {
    fetch("/api/monitor/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setCookie("");
          setHasCookie(Boolean(d.settings.hasCookie));
          setTicketPw(d.settings.ticketPassword || "0000");
          setDiscordUrl(d.settings.discordWebhook || "");
        }
      });
  }, []);

  const handleSave = async () => {
    const res = await fetch("/api/monitor/start", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveSettings",
        cookie,
        ticketPassword: ticketPw,
        discordWebhook: discordUrl,
      }),
    });
    const data = await res.json();
    setSaved(true);
    setProfile(data.profile || null);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card">
        <h2 className="text-lg font-bold mb-4">⚙️ 설정</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              네이버 NID_SES 쿠키 *
            </label>
            <textarea
              className="input-field h-24 text-xs font-mono"
              placeholder="브라우저 개발자도구(F12) → Application → Cookies → NID_SES 값 복사"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
            />
            <p className="text-xs text-gray-600 mt-1">
              네이버 로그인 후 F12 → Application → Cookies →
              pt.map.naver.com → NID_SES 값을 복사하세요.
              전체 쿠키 문자열도 가능합니다.
              {hasCookie && (
                <span className="block text-emerald-500/90 mt-1">
                  저장된 쿠키가 있습니다. 바꿀 때만 다시 붙여넣으면 됩니다.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              승차권 비밀번호 (4자리)
            </label>
            <input
              type="text"
              className="input-field"
              maxLength={4}
              placeholder="0000"
              value={ticketPw}
              onChange={(e) => setTicketPw(e.target.value)}
            />
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

          <button className="btn-primary w-full" onClick={handleSave}>
            💾 설정 저장
          </button>

          {saved && (
            <p className="text-emerald-400 text-sm">✅ 저장 완료!</p>
          )}

          {profile && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-sm text-emerald-400">
                ✅ 로그인 확인: {profile.name || profile.nickname || "확인됨"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-3">📖 쿠키 가져오는 방법</h2>
        <ol className="text-sm text-gray-400 space-y-2 list-decimal ml-4">
          <li>
            <a
              href="https://pt.map.naver.com/end-train/bridges/schedule-board/web/home?ac=ticket"
              target="_blank"
              className="text-blue-400 underline"
            >
              네이버 기차 예매 페이지
            </a>
            에 접속 (로그인 상태)
          </li>
          <li>F12 키로 개발자 도구 열기</li>
          <li>Application 탭 클릭</li>
          <li>왼쪽 Cookies → pt.map.naver.com 클릭</li>
          <li>NID_SES 항목의 Value를 복사</li>
          <li>위 입력란에 붙여넣기</li>
        </ol>
        <p className="text-xs text-yellow-500 mt-3">
          ⚠️ 쿠키는 보통 1~2일이면 만료됩니다. 예매 실패 시 갱신하세요.
        </p>
      </div>
    </div>
  );
}
