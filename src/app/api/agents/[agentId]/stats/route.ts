import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/clerk-auth";
import { getAgentStats } from "@/lib/forge";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ agentId: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await context.params;
  const result = await getAgentStats(agentId);

  if (!result) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
