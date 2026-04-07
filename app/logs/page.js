"use client";
import { useState, useEffect } from "react";

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/monitor/status?logs=1");
      if (!res.ok) return;
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const typeColor = (type) => {
    const map = {
      info: "text-blue-400",
      success: "text-emerald-400",
      error: "text-red-400",
      warn: "text-yellow-400",
      check: "text-gray-500",
    };
    return map[type] || "text-gray-400";
  };

  const typeIcon = (type) => {
    const map = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      warn: "⚠️",
      check: "🔄",
    };
    return map[type] || "📝";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📋 실행 로그</h1>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-500">
            {logs.length}개 · 5초마다 갱신
          </span>
          <button
            type="button"
            className="btn-primary text-xs !px-3 !py-1"
            onClick={fetchLogs}
          >
            🔄
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-gray-500 text-sm">로딩 중...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500 text-sm">
            아직 로그가 없습니다. 검색·감시를 실행하면 여기에 기록됩니다.
          </p>
        ) : (
          <div className="space-y-0.5 max-h-[75vh] overflow-y-auto">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-2 py-2 border-b border-[#1a1a2e] last:border-0"
              >
                <span className="text-[11px] text-gray-600 whitespace-nowrap mt-0.5 font-mono">
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : ""}
                </span>
                <span className="flex-shrink-0">{typeIcon(log.type)}</span>
                <span className={`text-sm ${typeColor(log.type)}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
