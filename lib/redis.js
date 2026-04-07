// Redis 없이도 메모리로 동작. 설정된 경우 Upstash REST API 직접 호출.

let useMemory = false;
let redisConfig = null;

const memoryStore = {
  monitors: {},
  activeMonitorIds: new Set(),
  logs: [],
  settings: null,
  cronLastRunMs: 0,
};

const CRON_LAST_KEY = "cron_last_run_ms";
const PLACEHOLDER = "여기에_Upstash_Redis_URL";

function isValidRedisUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  if (u.includes(PLACEHOLDER)) return false;
  return true;
}

export function getRedis() {
  if (useMemory) return null;
  if (redisConfig) return redisConfig;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!isValidRedisUrl(url) || !token || token.includes("여기에")) {
    console.warn("⚠️ Redis 환경변수 미설정/무효 → 메모리 모드");
    useMemory = true;
    return null;
  }

  redisConfig = { url: url.trim().replace(/\/$/, ""), token: token.trim() };
  return redisConfig;
}

async function redisCommand(command) {
  const r = getRedis();
  if (!r) {
    console.warn("Redis 미연결 → 메모리 모드. 명령:", command[0]);
    return null;
  }

  try {
    const res = await fetch(r.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${r.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Redis 에러 [${res.status}]:`, text.substring(0, 200));
      throw new Error(`Redis ${res.status}: ${text.substring(0, 100)}`);
    }

    const data = await res.json();
    return data.result;
  } catch (e) {
    console.error("Redis 명령 실패:", command[0], e.message);
    return null;
  }
}

export async function saveMonitor(id, data) {
  const r = getRedis();
  if (!r) {
    memoryStore.monitors[id] = data;
    memoryStore.activeMonitorIds.add(id);
    return;
  }

  const payload = JSON.stringify(data);
  await redisCommand(["HSET", "monitors", id, payload]);
  await redisCommand(["SADD", "active_monitors", id]);
}

export async function getMonitor(id) {
  const r = getRedis();
  if (!r) {
    return memoryStore.monitors[id] || null;
  }

  const raw = await redisCommand(["HGET", "monitors", id]);
  if (raw == null || raw === "") return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function getActiveMonitors() {
  const r = getRedis();
  if (!r) {
    return [...memoryStore.activeMonitorIds].map((id) => ({
      id,
      ...(memoryStore.monitors[id] || {}),
    }));
  }

  try {
    let ids = await redisCommand(["SMEMBERS", "active_monitors"]);
    if (!ids) return [];
    if (!Array.isArray(ids)) ids = [ids];
    if (ids.length === 0) return [];

    const monitors = [];
    for (const id of ids) {
      const m = await getMonitor(id);
      if (m) monitors.push({ id: String(id), ...m });
    }
    return monitors;
  } catch (e) {
    console.error("getActiveMonitors 실패:", e.message);
    return [];
  }
}

export async function removeMonitor(id) {
  const r = getRedis();
  if (!r) {
    delete memoryStore.monitors[id];
    memoryStore.activeMonitorIds.delete(id);
    return;
  }

  await redisCommand(["SREM", "active_monitors", id]);
  await redisCommand(["HDEL", "monitors", id]);
}

export async function addLog(entry) {
  const log = { ...entry, timestamp: new Date().toISOString() };

  const r = getRedis();
  if (!r) {
    memoryStore.logs.unshift(log);
    if (memoryStore.logs.length > 200) memoryStore.logs.length = 200;
    return;
  }

  await redisCommand(["LPUSH", "logs", JSON.stringify(log)]);
  await redisCommand(["LTRIM", "logs", "0", "199"]);
}

export async function getLogs(count = 50) {
  const r = getRedis();
  if (!r) {
    return memoryStore.logs.slice(0, count);
  }

  try {
    let raws = await redisCommand(["LRANGE", "logs", "0", String(count - 1)]);
    if (!raws) return [];
    if (!Array.isArray(raws)) raws = [raws];
    return raws.map((item) => {
      try {
        return typeof item === "string" ? JSON.parse(item) : item;
      } catch {
        return { message: String(item), timestamp: "", type: "info" };
      }
    });
  } catch {
    return [];
  }
}

export async function saveSettings(data) {
  const r = getRedis();
  if (!r) {
    memoryStore.settings = data;
    return;
  }

  const json = JSON.stringify(data);
  const setResult = await redisCommand(["SET", "settings", json]);
  console.log("saveSettings SET result:", setResult);

  const verify = await redisCommand(["GET", "settings"]);
  if (verify != null && verify !== "") {
    console.log(
      "saveSettings 검증: OK (" + String(verify).length + "자)"
    );
  } else {
    console.error(
      "saveSettings 검증: NULL — SET 후 GET 실패 (Redis 응답·URL·토큰 확인)"
    );
    memoryStore.settings = data;
  }
}

export async function getSettings() {
  const r = getRedis();
  if (!r) {
    return memoryStore.settings;
  }

  try {
    const raw = await redisCommand(["GET", "settings"]);
    if (raw == null || raw === "") return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function getCronLastRunMs() {
  const r = getRedis();
  if (!r) {
    return memoryStore.cronLastRunMs || 0;
  }
  const raw = await redisCommand(["GET", CRON_LAST_KEY]);
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function setCronLastRunMs(ms) {
  const r = getRedis();
  if (!r) {
    memoryStore.cronLastRunMs = ms;
    return;
  }
  await redisCommand(["SET", CRON_LAST_KEY, String(ms)]);
}
