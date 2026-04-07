"use client";
import { useState, useEffect, useCallback } from "react";
import { STATIONS, TRAIN_TYPES } from "@/lib/stations";

export default function Dashboard() {
  const [depStation, setDepStation] = useState("");
  const [arrStation, setArrStation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("000000");
  const [trainType, setTrainType] = useState("109");
  const [passengerCount, setPassengerCount] = useState("1");
  const [trains, setTrains] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [settingsOk, setSettingsOk] = useState(false);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.monitors) setMonitors(data.monitors);
      if (data.settings) setSettingsOk(Boolean(data.settings.hasCookie));
    } catch {}
  }, []);

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 5000);
    return () => clearInterval(interval);
  }, [fetchMonitors]);

  const handleSearch = async () => {
    if (!depStation || !arrStation || !date) {
      setMessage("출발역, 도착역, 날짜를 모두 선택하세요");
      return;
    }
    if (!settingsOk) {
      setMessage("⚠️ 먼저 설정 페이지에서 네이버 쿠키를 입력하세요!");
      return;
    }
    setSearching(true);
    setMessage("");
    setTrains([]);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departureDate: date.replace(/-/g, ""),
          departureTime: time,
          departureStopCode: depStation,
          arrivalStopCode: arrStation,
          trainGroupCode: trainType,
          passengerCount,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setMessage(`⚠️ ${data.error}`);
      } else if (data.trains && data.trains.length > 0) {
        setTrains(data.trains);
        setMessage(`✅ ${data.trains.length}개 열차 조회됨`);
      } else {
        setMessage("조회 결과가 없습니다. 날짜/역을 확인하세요.");
        if (data.raw) {
          console.log("API 원본 응답:", data.raw);
        }
      }
    } catch (e) {
      setMessage(`조회 실패: ${e.message}`);
    } finally {
      setSearching(false);
    }
  };

  const startMonitor = async (train) => {
    setLoading(true);
    try {
      const dep = STATIONS.find((s) => s.stopCode === depStation);
      const arr = STATIONS.find((s) => s.stopCode === arrStation);

      const res = await fetch("/api/monitor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train,
          departureStopId: depStation,
          arrivalStopId: arrStation,
          departureStopName: dep?.name || depStation,
          arrivalStopName: arr?.name || arrStation,
          departureDate: date.replace(/-/g, ""),
          trainGroupCode: trainType,
          seatAttrCode: "015",
          passengerCount,
        }),
      });
      const data = await res.json();
      setMessage(data.message || "감시가 시작되었습니다");
      fetchMonitors();
    } catch (e) {
      setMessage(`감시 시작 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const stopMonitor = async (id) => {
    try {
      await fetch("/api/monitor/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchMonitors();
    } catch {}
  };

  const statusLabel = (status) => {
    const map = {
      watching: ["🔄 감시중", "badge-watching"],
      found: ["🎉 좌석 발견!", "badge-found"],
      reserving: ["⚡ 예매 중...", "badge-found"],
      reserved: ["✅ 예매 완료!", "badge-reserved"],
      paying: ["💳 결제 요청중", "badge-paid"],
      paid: ["🎊 결제 완료!", "badge-paid"],
      failed: ["❌ 실패", "badge-failed"],
    };
    const [label, cls] = map[status] || [status, "badge-watching"];
    return <span className={cls}>{label}</span>;
  };

  const formatTime = (t) => {
    if (!t) return "--:--";
    const s = String(t).padStart(6, "0");
    return `${s.substring(0, 2)}:${s.substring(2, 4)}`;
  };

  const isSoldOut = (train) => {
    const status = (
      train.generalSeatStatus ||
      train.seatStatus ||
      train.reserveStatus ||
      ""
    ).toString();
    return (
      status.includes("매진") ||
      status.includes("Sold") ||
      train.seatAvailable === false ||
      train.generalSeatAvailable === false
    );
  };

  return (
    <div className="space-y-6">
      {!settingsOk && (
        <div className="card border-yellow-500/50 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">
            ⚠️ 네이버 쿠키가 설정되지 않았습니다.{" "}
            <a href="/settings" className="underline font-bold">
              설정 페이지
            </a>
            에서 먼저 쿠키를 입력하세요.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-bold mb-4">🔍 열차 검색</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">출발역</label>
            <select
              className="select-field"
              value={depStation}
              onChange={(e) => setDepStation(e.target.value)}
            >
              <option value="">선택</option>
              {STATIONS.map((s) => (
                <option key={s.stopId} value={s.stopCode}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">도착역</label>
            <select
              className="select-field"
              value={arrStation}
              onChange={(e) => setArrStation(e.target.value)}
            >
              <option value="">선택</option>
              {STATIONS.map((s) => (
                <option key={`a-${s.stopId}`} value={s.stopCode}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">날짜</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              출발시간 이후
            </label>
            <select
              className="select-field"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            >
              {Array.from({ length: 24 }, (_, i) => {
                const h = String(i).padStart(2, "0");
                return (
                  <option key={h} value={`${h}0000`}>
                    {h}시 이후
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              열차 종류
            </label>
            <select
              className="select-field"
              value={trainType}
              onChange={(e) => setTrainType(e.target.value)}
            >
              {TRAIN_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">인원</label>
            <select
              className="select-field"
              value={passengerCount}
              onChange={(e) => setPassengerCount(e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={String(n)}>
                  {n}명
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn-primary w-full mt-4"
          onClick={handleSearch}
          disabled={searching}
        >
          {searching ? "⏳ 조회 중..." : "🔍 시간표 조회"}
        </button>
        {message && (
          <p
            className={`mt-2 text-sm ${
              message.startsWith("✅")
                ? "text-emerald-400"
                : "text-yellow-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {trains.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold mb-4">
            🚆 열차 목록 ({trains.length}개)
          </h2>
          <div className="space-y-2">
            {trains.map((train, i) => {
              const soldOut = isSoldOut(train);
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    soldOut
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-emerald-500/30 bg-emerald-500/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-blue-400 text-sm">
                        {train.trainName ||
                          train.trainGroupName ||
                          train.trainTypeName ||
                          "열차"}
                      </span>
                      <span className="text-gray-500 text-xs">
                        #{train.trainNumber}
                      </span>
                    </div>
                    <div className="text-sm mt-1">
                      <span className="text-white font-mono font-semibold">
                        {formatTime(train.departureTime)}
                      </span>
                      <span className="text-gray-500 mx-1">→</span>
                      <span className="text-white font-mono font-semibold">
                        {formatTime(train.arrivalTime)}
                      </span>
                      {train.runTime && (
                        <span className="text-gray-600 ml-2 text-xs">
                          ({train.runTime})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      일반:{" "}
                      {train.generalSeatStatus ||
                        train.seatStatus ||
                        "정보없음"}{" "}
                      {train.specialSeatStatus &&
                        `| 특실: ${train.specialSeatStatus}`}
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    {soldOut ? (
                      <button
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                        onClick={() => startMonitor(train)}
                        disabled={loading}
                      >
                        ⚡ 자동예매
                      </button>
                    ) : (
                      <button
                        className="btn-success text-xs !px-3 !py-2"
                        onClick={() => startMonitor(train)}
                        disabled={loading}
                      >
                        🎫 바로예매
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            👁️ 감시 현황 ({monitors.length}개)
          </h2>
          {monitors.length > 0 && (
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-300"
              onClick={fetchMonitors}
            >
              🔄 새로고침
            </button>
          )}
        </div>
        {monitors.length === 0 ? (
          <p className="text-gray-500 text-sm">감시 중인 열차가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-lg border border-[#252540] bg-[#0d0d18]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {statusLabel(m.status)}
                      <span className="font-bold text-blue-400 text-sm">
                        {m.trainName}
                      </span>
                      <span className="text-gray-500 text-xs">
                        #{m.trainNumber}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {m.departureStopName} → {m.arrivalStopName}
                      <span className="mx-2">|</span>
                      {m.departureDate
                        ? `${m.departureDate.substring(0, 4)}-${m.departureDate.substring(4, 6)}-${m.departureDate.substring(6, 8)}`
                        : ""}{" "}
                      {formatTime(m.departureTime)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 space-x-3">
                      <span>시도: {m.attempts || 0}회</span>
                      <span>
                        마지막:{" "}
                        {m.lastChecked
                          ? new Date(m.lastChecked).toLocaleTimeString("ko-KR")
                          : "-"}
                      </span>
                    </div>
                    {m.reserveId && (
                      <div className="text-xs text-emerald-400 mt-1">
                        예약ID: {m.reserveId.substring(0, 16)}...
                      </div>
                    )}
                    {m.paymentUrl && (
                      <a
                        href={m.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-all"
                      >
                        💳 결제하기 →
                      </a>
                    )}
                    {m.error && (
                      <div className="text-xs text-red-400 mt-1">❌ {m.error}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-danger text-xs !px-3 !py-1.5 flex-shrink-0"
                    onClick={() => stopMonitor(m.id)}
                  >
                    중지
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
