import "./globals.css";

export const metadata = {
  title: "🚆 기차 자동 예매 시스템",
  description: "매진 좌석 자동 감시 & 예매",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {/* 네비게이션 */}
        <nav className="border-b border-[#252540] bg-[#0d0d15]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold">
              🚆 자동 예매
            </a>
            <div className="flex gap-4 text-sm">
              <a href="/" className="hover:text-blue-400 transition-colors">
                대시보드
              </a>
              <a
                href="/logs"
                className="hover:text-blue-400 transition-colors"
              >
                로그
              </a>
              <a
                href="/settings"
                className="hover:text-blue-400 transition-colors"
              >
                설정
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
