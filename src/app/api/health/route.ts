import { NextResponse } from "next/server";

import { buildDiagnostics, collectRuntimeSnapshot } from "@/lib/diagnostics";
import { getPublicHealthState } from "@/lib/forge";

export const runtime = "nodejs";

export async function GET() {
  const health = await getPublicHealthState();
  const diagnostics = buildDiagnostics(health, collectRuntimeSnapshot());

  return NextResponse.json(
    { ...health, diagnostics },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
