import { NextResponse } from "next/server";
import { getActiveMonitors, getSettings, getLogs } from "@/lib/redis";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monitors = await getActiveMonitors();
    const full = await getSettings();

    const settings = full
      ? {
          hasCookie: Boolean(full.cookie),
          ticketPassword: full.ticketPassword,
          discordWebhook: full.discordWebhook,
        }
      : null;

    const result = { monitors, settings };

    if (searchParams.get("logs") === "1") {
      result.logs = await getLogs(100);
    }

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message, monitors: [] }, { status: 500 });
  }
}
