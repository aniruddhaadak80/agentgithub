import { NextResponse } from "next/server";

import { getDashboardState } from "@/lib/forge";

export const runtime = "nodejs";

export async function GET() {
  const state = await getDashboardState();
  return NextResponse.json(state);
}