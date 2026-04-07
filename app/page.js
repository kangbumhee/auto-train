"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { STATIONS } from "@/lib/stations";

const TRAIN_FILTERS = [
  { name: "전체", code: "109" },
  { name: "KTX", code: "100" },
  { name: "SRT", code: "400" },
  { name: "새마을/ITX-마음", code: "101" },
  { name: "무궁화", code: "102" },
  { name: "ITX-청춘", code: "104" },
];

function Toast({ show, message, type, onClose }) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  const colors = {
    success: "bg-emerald-600 border-emerald-400",
    info: "bg-blue-600 border-blue-400",
    warn: "bg-orange-600 border-orange-400",
    error: "bg-red-600 border-red-400",
  };

  const icons = { success: "✅", info: "ℹ️", warn: "⚡", error: "❌" };

  return (
    <div className="fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4 pointer-events-none">
      <div
        className={`pointer-events-auto animate-bounce-in ${colors[type] || colors.info} border rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3 max-w-lg w-full sm:w-auto`}
      >
        <span className="text-xl">{icons[type] || "ℹ️"}</span>
        <span className="text-white text-sm font-medium flex-1">
          {message}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/60 hover:text-white shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function StationInput({ label, icon, value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selectedStation = STATIONS.find((s) => s.stopId === value);

  const filtered = query.trim()
    ? STATIONS.filter((s) => s.name.includes(query.trim()))
    : STATIONS;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (station) => {
    onChange(station.stopId);
    setQuery("");
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const q = query.trim();
  const safePattern = q ? new RegExp(`(${escapeRegExp(q)})`, "g") : null;

  return (
    <div ref={ref} className="relative">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <div
        className="input-field flex items-center gap-2 cursor-pointer"
        onClick={() => {
          setOpen(true);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <span className="text-lg">{icon}</span>
        {open ? (
          <input
            ref={inputRef}
            type="text"
            className="bg-transparent outline-none flex-1 text-white min-w-0"
            placeholder={placeholder || "역 이름 검색..."}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(-1);
            }}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className={selectedStation ? "text-white" : "text-gray-500"}>
            {selectedStation ? (
              <span className="flex items-center gap-1.5 flex-wrap">
                {selectedStation.name}
                {selectedStation.ktx && <span className="badge-ktx">KTX</span>}
                {selectedStation.srt && <span className="badge-srt">SRT</span>}
              </span>
            ) : (
              placeholder || "역 선택"
            )}
          </span>
        )}
      </div>

      {open && (
        <div className="autocomplete-dropdown">
          {q && (
            <div className="px-4 py-2 text-xs text-gray-500 border-b border-[#252540]">
              ℹ️ 기차역명을 검색하세요.
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">검색 결과 없음</div>
          ) : (
            filtered.slice(0, 20).map((s, i) => (
              <div
                key={s.stopId}
                role="option"
                className={`autocomplete-item ${i === highlighted ? "active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className="text-gray-500">📍</span>
                <span className="flex-1">
                  {safePattern ? (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: s.name.replace(
                          safePattern,
                          '<span class="text-blue-400 font-bold">$1</span>'
                        ),
                      }}
                    />
                  ) : (
                    s.name
                  )}
                </span>
                <span className="flex items-center gap-1">
                  {s.ktx && <span className="badge-ktx">KTX</span>}
                  {s.srt && <span className="badge-srt">SRT</span>}
                </span>
                <span className="text-xs text-gray-600">{s.region}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TrainBadge({ name }) {
  if (!name) return null;
  if (name.includes("KTX")) return <span className="badge-ktx">{name}</span>;
  if (name.includes("SRT")) return <span className="badge-srt">{name}</span>;
  if (name.includes("ITX") || name.includes("새마을"))
    return <span className="badge-itx">{name}</span>;
  return <span className="badge-mugung">{name}</span>;
}

function formatTime(t) {
  if (!t || String(t).length < 4) return "--:--";
  const s = String(t);
  return `${s.substring(0, 2)}:${s.substring(2, 4)}`;
}

function formatRunTime(t) {
  if (!t || String(t).length < 4) return "";
  const s = String(t);
  const h = parseInt(s.substring(0, 2), 10);
  const m = parseInt(s.substring(2, 4), 10);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export default function Dashboard() {
  const [depStation, setDepStation] = useState("");
  const [arrStation, setArrStation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("000000");
  const [trainFilter, setTrainFilter] = useState("109");
  const [passengerCount, setPassengerCount] = useState("1");
  const [trains, setTrains] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [settingsOk, setSettingsOk] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "info",
  });
  const monitorRef = useRef(null);

  const hideToast = useCallback(() => {
    setToast((t) => ({ ...t, show: false }));
  }, []);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ show: true, message: msg, type });
  }, []);

  useEffect(() => {
    const d = new Date();
    setDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
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
    const iv = setInterval(fetchMonitors, 5000);
    return () => clearInterval(iv);
  }, [fetchMonitors]);

  const swapStations = () => {
    const tmp = depStation;
    setDepStation(arrStation);
    setArrStation(tmp);
  };

  const runSearch = async (groupCodeOverride) => {
    const trainGroupCode =
      groupCodeOverride !== undefined ? groupCodeOverride : trainFilter;

    if (!depStation || !arrStation) {
      setMessage("출발역과 도착역을 선택하세요");
      return;
    }
    if (!date) {
      setMessage("날짜를 선택하세요");
      return;
    }
    if (!settingsOk) {
      setMessage("⚠️ 먼저 설정 페이지에서 네이버 쿠키를 입력하세요!");
      return;
    }

    const dep = STATIONS.find((s) => s.stopId === depStation);
    const arr = STATIONS.find((s) => s.stopId === arrStation);
    if (!dep?.stopCode || !arr?.stopCode) {
      setMessage("역 정보를 찾을 수 없습니다");
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
          departureStopCode: dep.stopCode,
          arrivalStopCode: arr.stopCode,
          trainGroupCode,
          passengerCount,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(`⚠️ ${data.error}`);
      } else if (data.trains?.length > 0) {
        setTrains(data.trains);
        setMessage("");
      } else {
        setMessage("조회 결과가 없습니다.");
      }
    } catch (e) {
      setMessage(`오류: ${e.message}`);
    } finally {
      setSearching(false);
    }
  };

  const startMonitor = async (train) => {
    setLoading(true);
    try {
      const dep = STATIONS.find((s) => s.stopId === depStation);
      const arr = STATIONS.find((s) => s.stopId === arrStation);
      const isSoldOut = train.generalReserveName === "매진";
      const num = train.trainNumber
        ? String(train.trainNumber).replace(/^0+/, "") || "0"
        : "";
      const label = train.trainDetailName || train.trainGroupName || "열차";

      const res = await fetch("/api/monitor/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train,
          departureStopId: dep?.stopCode || "",
          arrivalStopId: arr?.stopCode || "",
          departureStopName: dep?.name || "",
          arrivalStopName: arr?.name || "",
          departureDate: date.replace(/-/g, ""),
          trainGroupCode: train.trainGroupCode || trainFilter,
          seatAttrCode: "015",
          passengerCount,
        }),
      });
      const data = await res.json();

      if (data.error) {
        showToast(data.error, "error");
        return;
      }

      setMessage(data.message || "감시가 등록되었습니다");

      if (isSoldOut) {
        showToast(
          `⚡ ${label} ${num}호 자동 예매가 등록되었습니다. 아래 감시 현황에서 상태를 확인하세요.`,
          "warn"
        );
      } else {
        showToast(
          `🎫 ${label} ${num}호 감시·예매 흐름이 등록되었습니다. 감시 현황을 확인하세요.`,
          "success"
        );
      }

      fetchMonitors();
      setTimeout(() => {
        monitorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
    } catch (e) {
      showToast(`등록 실패: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const stopMonitor = async (id) => {
    await fetch("/api/monitor/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    showToast("감시가 중지되었습니다.", "info");
    fetchMonitors();
  };

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dateObj = date ? new Date(`${date}T00:00:00`) : null;
  const dateDisplay = dateObj
    ? `${String(dateObj.getFullYear()).slice(2)}.${String(dateObj.getMonth() + 1).padStart(2, "0")}.${String(dateObj.getDate()).padStart(2, "0")}.(${dayNames[dateObj.getDay()]})`
    : "";

  return (
    <div className="space-y-6">
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />

      {!settingsOk && (
        <div className="card border-yellow-500/50 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">
            ⚠️{" "}
            <a href="/settings" className="underline font-bold">
              설정 페이지
            </a>
            에서 네이버 쿠키를 먼저 입력하세요.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-bold mb-4">🔍 열차 검색</h2>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end mb-4">
          <StationInput
            label="출발역"
            icon="🔵"
            value={depStation}
            onChange={setDepStation}
            placeholder="출발 기차역"
          />
          <button
            type="button"
            onClick={swapStations}
            className="mb-0.5 p-2 hover:bg-[#252545] rounded-lg transition-colors text-gray-400 hover:text-white"
            title="출발↔도착 전환"
          >
            ⇄
          </button>
          <StationInput
            label="도착역"
            icon="🔴"
            value={arrStation}
            onChange={setArrStation}
            placeholder="도착 기차역"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
              출발시간
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
              value={trainFilter}
              onChange={(e) => setTrainFilter(e.target.value)}
            >
              {TRAIN_FILTERS.map((t) => (
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
                  어른 {n}명
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => runSearch()}
          disabled={searching}
        >
          {searching ? "⏳ 조회 중..." : "🔍 시간표 조회"}
        </button>
        {message && (
          <p
            className={`mt-2 text-sm ${
              message.startsWith("✅") ? "text-emerald-400" : "text-yellow-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {trains.length > 0 && (
        <div className="card !p-0">
          <div className="flex items-center justify-center py-3 border-b border-[#252540]">
            <span className="font-bold">{dateDisplay}</span>
          </div>

          <div className="flex gap-4 px-5 py-2 border-b border-[#252540] text-sm overflow-x-auto">
            {TRAIN_FILTERS.map((f) => (
              <button
                type="button"
                key={f.code}
                className={`whitespace-nowrap pb-1 transition-colors ${
                  trainFilter === f.code
                    ? "text-white font-bold border-b-2 border-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                onClick={() => {
                  setTrainFilter(f.code);
                  runSearch(f.code);
                }}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="divide-y divide-[#1e1e30]">
            {trains.map((train, i) => {
              const isSoldOutGeneral = train.generalReserveName === "매진";
              const isSoldOutSpecial = train.specialReserveName === "매진";
              const hasAvailable =
                !isSoldOutGeneral ||
                (train.specialRoomExist && !isSoldOutSpecial);

              const num = train.trainNumber
                ? String(train.trainNumber).replace(/^0+/, "") || "0"
                : "";

              return (
                <div
                  key={`${train.trainNumber}-${i}`}
                  className="px-5 py-4 hover:bg-[#1a1a2e] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrainBadge
                      name={
                        train.trainDetailName || train.trainGroupName
                      }
                    />
                    <span className="text-gray-400 text-sm">
                      {num} &gt;
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-white">
                        {formatTime(train.departureTime)}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="text-2xl font-bold text-white">
                        {formatTime(train.arrivalTime)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatRunTime(train.runTime)}
                      </span>
                    </div>

                    <div>
                      {hasAvailable ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 px-4 py-2 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition-all text-sm font-semibold"
                          onClick={() => startMonitor(train)}
                          disabled={loading}
                        >
                          🎫 예매
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="flex items-center gap-1 px-4 py-2 border border-orange-500 text-orange-400 rounded-lg hover:bg-orange-500/10 transition-all text-sm font-semibold animate-pulse"
                          onClick={() => startMonitor(train)}
                          disabled={loading}
                        >
                          ⚡ 자동예매
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-gray-500">일반</span>
                    {isSoldOutGeneral ? (
                      <span className="seat-soldout">매진</span>
                    ) : (
                      <span className="seat-available">
                        {train.generalReserveName || "예매가능"}
                      </span>
                    )}

                    {train.specialRoomExist && (
                      <>
                        <span className="text-xs text-gray-500">특실</span>
                        {isSoldOutSpecial ? (
                          <span className="seat-soldout">매진</span>
                        ) : (
                          <span className="seat-available">
                            {train.specialReserveName || "예매가능"}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div ref={monitorRef} className="card scroll-mt-4">
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
              🔄
            </button>
          )}
        </div>
        {monitors.length === 0 ? (
          <div className="text-gray-500 text-sm space-y-2">
            <p>
              매진된 열차에서{" "}
              <span className="text-orange-400 font-semibold">⚡ 자동예매</span>
              를 누르면 감시가 시작됩니다. 좌석이 열리면 자동 예매 후 알림을
              보냅니다.
            </p>
            <p className="text-gray-600 text-xs">
              텔레그램·디스코드 알림은{" "}
              <a href="/settings" className="text-blue-400 underline">
                설정
              </a>
              에서 연결하세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => {
              const statusMap = {
                watching: ["🔄 감시중", "badge-watching"],
                found: ["🎉 좌석 발견!", "badge-found"],
                reserving: ["⚡ 예매 중...", "badge-found"],
                reserved: ["✅ 예매 완료!", "badge-reserved"],
                paying: ["💳 결제중", "badge-paid"],
                paid: ["🎊 결제 완료!", "badge-paid"],
                failed: ["❌ 실패", "badge-failed"],
              };
              const [statusText, statusCls] =
                statusMap[m.status] || [m.status, "badge-watching"];

              return (
                <div
                  key={m.id}
                  className="p-4 rounded-lg border border-[#252540] bg-[#0d0d18]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={statusCls}>{statusText}</span>
                        <TrainBadge name={m.trainName} />
                        <span className="text-gray-500 text-xs">
                          #{m.trainNumber}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {m.departureStopName} → {m.arrivalStopName} |{" "}
                        {formatTime(m.departureTime)}
                        {m.departureDate && (
                          <span className="ml-2 text-gray-600">
                            {m.departureDate.substring(4, 6)}/
                            {m.departureDate.substring(6, 8)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        시도: {m.attempts || 0}회
                        {m.lastChecked &&
                          ` | ${new Date(m.lastChecked).toLocaleTimeString("ko-KR")}`}
                      </div>
                      {m.reserveId && (
                        <div className="text-xs text-emerald-400 mt-1">
                          예약: {m.reserveId.substring(0, 16)}...
                        </div>
                      )}
                      {m.paymentUrl && (
                        <a
                          href={m.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-1 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded"
                        >
                          💳 결제하기 →
                        </a>
                      )}
                      {m.error && (
                        <div className="text-xs text-red-400 mt-1">
                          ❌ {m.error}
                        </div>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}