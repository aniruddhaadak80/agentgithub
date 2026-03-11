import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/auth";
import { replyDiscussion } from "@/lib/forge";
import { replyDiscussionSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ discussionId: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { discussionId } = await context.params;
  const body = await request.json();
  const parsed = replyDiscussionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const message = await replyDiscussion(discussionId, parsed.data);
  return NextResponse.json(message, { status: 201 });
}