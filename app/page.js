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

  // 오늘 날짜 기본값
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // 감시 상태 폴링
  const fetchMonitors = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/status");
      const data = await res.json();
      if (data.monitors) setMonitors(data.monitors);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 5000);
    return () => clearInterval(interval);
  }, [fetchMonitors]);

  // 시간표 조회
  const handleSearch = async () => {
    if (!depStation || !arrStation || !date) {
      setMessage("출발역, 도착역, 날짜를 모두 선택하세요");
      return;
    }
    setSearching(true);
    setMessage("");
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
        setMessage(`오류: ${data.error}`);
      } else {
        setTrains(data.trains || []);
        if (!data.trains?.length) setMessage("조회 결과가 없습니다");
      }
    } catch (e) {
      setMessage(`조회 실패: ${e.message}`);
    } finally {
      setSearching(false);
    }
  };

  // 감시 시작
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
          departureStopName: dep?.name || "",
          arrivalStopName: arr?.name || "",
          departureDate: date.replace(/-/g, ""),
          trainGroupCode: trainType,
          seatAttrCode: "015",
          passengerCount,
        }),
      });
      const data = await res.json();
      setMessage(data.message || "감시 시작됨");
      fetchMonitors();
    } catch (e) {
      setMessage(`감시 시작 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 감시 중지
  const stopMonitor = async (id) => {
    try {
      await fetch("/api/monitor/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchMonitors();
    } catch (e) {}
  };

  const statusLabel = (status) => {
    const map = {
      watching: ["감시중", "badge-watching"],
      found: ["좌석 발견!", "badge-found"],
      reserving: ["예매 중...", "badge-found"],
      reserved: ["예매 완료! ✅", "badge-reserved"],
      paying: ["결제 요청중", "badge-paid"],
      paid: ["결제 완료! 🎉", "badge-paid"],
      failed: ["실패 ❌", "badge-failed"],
    };
    const [label, cls] = map[status] || [status, "badge-watching"];
    return <span className={cls}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* 검색 카드 */}
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
                <option key={s.stopId} value={s.stopCode}>
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
          {searching ? "조회 중..." : "🔍 시간표 조회"}
        </button>
        {message && (
          <p className="mt-2 text-sm text-yellow-400">{message}</p>
        )}
      </div>

      {/* 열차 목록 */}
      {trains.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold mb-4">
            🚆 열차 목록 ({trains.length}개)
          </h2>
          <div className="space-y-2">
            {trains.map((train, i) => {
              const soldOut =
                train.generalSeatStatus === "매진" ||
                train.generalSeatStatus === "Sold Out" ||
                train.seatAvailable === false;

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    soldOut
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-emerald-500/30 bg-emerald-500/5"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-400">
                        {train.trainName || train.trainGroupName}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {train.trainNumber}
                      </span>
                    </div>
                    <div className="text-sm mt-1">
                      <span className="text-white font-semibold">
                        {train.departureTime?.substring(0, 2)}:
                        {train.departureTime?.substring(2, 4)}
                      </span>
                      <span className="text-gray-500 mx-2">→</span>
                      <span className="text-white font-semibold">
                        {train.arrivalTime?.substring(0, 2)}:
                        {train.arrivalTime?.substring(2, 4)}
                      </span>
                      <span className="text-gray-500 ml-3">
                        {train.runTime || ""}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-bold ${
                        soldOut ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {soldOut ? "매진" : "예매 가능"}
                    </div>
                    {soldOut ? (
                      <button
                        className="btn-primary text-xs mt-1 !px-3 !py-1.5"
                        onClick={() => startMonitor(train)}
                        disabled={loading}
                      >
                        ⚡ 자동 예매 걸기
                      </button>
                    ) : (
                      <button
                        className="btn-success text-xs mt-1 !px-3 !py-1.5"
                        onClick={() => startMonitor(train)}
                        disabled={loading}
                      >
                        🎫 바로 예매
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 감시 현황 */}
      <div className="card">
        <h2 className="text-lg font-bold mb-4">
          👁️ 감시 현황 ({monitors.length}개)
        </h2>
        {monitors.length === 0 ? (
          <p className="text-gray-500 text-sm">
            감시 중인 열차가 없습니다. 열차를 검색하고 "자동 예매 걸기"를
            클릭하세요.
          </p>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-4 rounded-lg border border-[#252540] bg-[#0d0d18]"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    {statusLabel(m.status)}
                    <span className="font-bold text-blue-400">
                      {m.trainName}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {m.trainNumber}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {m.departureStopName} → {m.arrivalStopName} |{" "}
                    {m.departureDate?.substring(0, 4)}-
                    {m.departureDate?.substring(4, 6)}-
                    {m.departureDate?.substring(6, 8)}{" "}
                    {m.departureTime?.substring(0, 2)}:
                    {m.departureTime?.substring(2, 4)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    시도: {m.attempts || 0}회 | 마지막 체크:{" "}
                    {m.lastChecked
                      ? new Date(m.lastChecked).toLocaleTimeString("ko-KR")
                      : "-"}
                    {m.reserveId && (
                      <span className="text-emerald-400 ml-2">
                        예약ID: {m.reserveId?.substring(0, 8)}...
                      </span>
                    )}
                    {m.paymentUrl && (
                      <a
                        href={m.paymentUrl}
                        target="_blank"
                        className="text-purple-400 ml-2 underline"
                      >
                        💳 결제하기
                      </a>
                    )}
                  </div>
                  {m.error && (
                    <div className="text-xs text-red-400 mt-1">
                      ❌ {m.error}
                    </div>
                  )}
                </div>
                <button
                  className="btn-danger text-xs !px-3 !py-1.5"
                  onClick={() => stopMonitor(m.id)}
                >
                  중지
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
