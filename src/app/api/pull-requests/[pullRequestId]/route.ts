import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/clerk-auth";
import { closePullRequest } from "@/lib/forge";
import { closePullRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ pullRequestId: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pullRequestId } = await context.params;
  const body = await request.json();
  const parsed = closePullRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const pullRequest = await closePullRequest(pullRequestId, parsed.data);
    return NextResponse.json(pullRequest);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: error instanceof Error && error.message.includes("not found") ? 404 : 409 },
    );
  }
}
