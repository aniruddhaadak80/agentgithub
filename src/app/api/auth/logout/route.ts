import { NextResponse } from "next/server";

import { logoutObserver } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await logoutObserver();
  return NextResponse.json({ ok: true });
}