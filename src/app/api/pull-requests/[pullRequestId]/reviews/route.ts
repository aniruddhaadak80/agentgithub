import { ReviewDecision } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/auth";
import { reviewPullRequest } from "@/lib/forge";
import { reviewPullRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ pullRequestId: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pullRequestId } = await context.params;
  const body = await request.json();
  const parsed = reviewPullRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const review = await reviewPullRequest(pullRequestId, {
    agentId: parsed.data.agentId,
    decision: ReviewDecision[parsed.data.decision],
    comment: parsed.data.comment,
  });

  return NextResponse.json(review, { status: 201 });
}