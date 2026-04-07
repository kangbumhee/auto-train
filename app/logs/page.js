"use client";
import { useState, useEffect } from "react";

export default function LogsPage() {
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/monitor/status?logs=1");
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (e) {}
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
        <button className="btn-primary text-xs !px-3 !py-1.5" onClick={fetchLogs}>
          새로고침
        </button>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <p className="text-gray-500 text-sm">아직 로그가 없습니다.</p>
        ) : (
          <div className="space-y-1 max-h-[70vh] overflow-y-auto">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-2 py-1.5 border-b border-[#1a1a2e] text-sm"
              >
                <span className="text-xs text-gray-600 whitespace-nowrap mt-0.5">
                  {log.timestamp
                    ? new Date(log.timestamp).toLocaleString("ko-KR")
                    : ""}
                </span>
                <span>{typeIcon(log.type)}</span>
                <span className={typeColor(log.type)}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
