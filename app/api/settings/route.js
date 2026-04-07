import { NextResponse } from "next/server";
import { saveSettingsFromRequestBody } from "@/lib/persist-settings";
import { getSettings } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * localStorage train_settings 그대로 POST 가능.
 * 예: fetch("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(parsed) })
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await saveSettingsFromRequestBody(body);

    const readback = await getSettings();
    result._debug = {
      savedThenRead: readback !== null,
      readbackHasCookie: Boolean(readback?.cookie),
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/settings:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
