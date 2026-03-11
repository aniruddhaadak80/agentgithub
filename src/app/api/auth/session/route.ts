import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const observer = await getCurrentObserver();
  return NextResponse.json({ observer });
}