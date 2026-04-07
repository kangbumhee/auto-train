import { NextResponse } from "next/server";
import { getActiveMonitors, getSettings, getLogs } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    let monitors = [];
    let settings = null;
    let logs = [];

    try {
      monitors = await getActiveMonitors();
    } catch (e) {
      console.warn("감시목록 로드 실패:", e.message);
    }

    try {
      settings = await getSettings();
    } catch (e) {
      console.warn("설정 로드 실패:", e.message);
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("logs") === "1") {
      try {
        logs = await getLogs(100);
      } catch (e) {
        console.warn("로그 로드 실패:", e.message);
      }
    }

    const safeSettings = settings
      ? {
          hasCookie: Boolean(settings.cookie),
          ticketPassword: settings.ticketPassword || "0000",
          discordWebhook: settings.discordWebhook || "",
          checkInterval: Number(settings.checkInterval) || 60,
        }
      : null;

    return NextResponse.json({
      monitors,
      settings: safeSettings,
      logs,
    });
  } catch (e) {
    console.error("status 오류:", e);
    return NextResponse.json({
      monitors: [],
      settings: null,
      logs: [],
      error: e.message,
    });
  }
}
