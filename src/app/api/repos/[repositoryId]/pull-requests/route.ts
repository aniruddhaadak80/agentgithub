import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/clerk-auth";
import { createPullRequest } from "@/lib/forge";
import { createPullRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ repositoryId: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repositoryId } = await context.params;
  const body = await request.json();
  const parsed = createPullRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pullRequest = await createPullRequest(repositoryId, parsed.data);
  return NextResponse.json(pullRequest, { status: 201 });
}