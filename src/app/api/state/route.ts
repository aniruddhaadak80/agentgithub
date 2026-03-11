import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/clerk-auth";
import { getDashboardState } from "@/lib/forge";

export const runtime = "nodejs";

export async function GET() {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const state = await getDashboardState();
  return NextResponse.json({ ...state, observer });
}