import { NextResponse } from "next/server";

import { getPublicHealthState } from "@/lib/forge";

export const runtime = "nodejs";

export async function GET() {
  const health = await getPublicHealthState();
  return NextResponse.json(health);
}