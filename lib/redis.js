import { Redis } from "@upstash/redis";

let redis;

export function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// 감시 작업 저장
export async function saveMonitor(id, data) {
  const r = getRedis();
  await r.hset("monitors", { [id]: JSON.stringify(data) });
  await r.sadd("active_monitors", id);
}

// 감시 작업 가져오기
export async function getMonitor(id) {
  const r = getRedis();
  const raw = await r.hget("monitors", id);
  return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
}

// 모든 활성 감시 가져오기
export async function getActiveMonitors() {
  const r = getRedis();
  const ids = await r.smembers("active_monitors");
  if (!ids || ids.length === 0) return [];

  const monitors = [];
  for (const id of ids) {
    const m = await getMonitor(id);
    if (m) monitors.push({ id, ...m });
  }
  return monitors;
}

// 감시 중지
export async function removeMonitor(id) {
  const r = getRedis();
  await r.srem("active_monitors", id);
  await r.hdel("monitors", id);
}

// 로그 추가
export async function addLog(entry) {
  const r = getRedis();
  const log = { ...entry, timestamp: new Date().toISOString() };
  await r.lpush("logs", JSON.stringify(log));
  await r.ltrim("logs", 0, 199); // 최근 200개만 유지
}

// 로그 가져오기
export async function getLogs(count = 50) {
  const r = getRedis();
  const raws = await r.lrange("logs", 0, count - 1);
  return raws.map((r) => (typeof r === "string" ? JSON.parse(r) : r));
}

// 설정 저장/불러오기
export async function saveSettings(data) {
  const r = getRedis();
  await r.set("settings", JSON.stringify(data));
}

export async function getSettings() {
  const r = getRedis();
  const raw = await r.get("settings");
  return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
}
