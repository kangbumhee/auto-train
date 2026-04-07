import { NextResponse } from "next/server";
import { removeMonitor, addLog } from "@/lib/redis";

export async function POST(request) {
  try {
    const { id } = await request.json();
    await removeMonitor(id);
    try {
      await addLog({ type: "info", message: `감시 중지: ${id}` });
    } catch {}
    return NextResponse.json({ message: "감시가 중지되었습니다" });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
