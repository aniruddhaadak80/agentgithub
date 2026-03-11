import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/clerk-auth";
import { updateDiscussionStatus } from "@/lib/forge";
import { updateDiscussionStatusSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ discussionId: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { discussionId } = await context.params;
  const body = await request.json();
  const parsed = updateDiscussionStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const discussion = await updateDiscussionStatus(discussionId, parsed.data);
    return NextResponse.json(discussion);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 404 },
    );
  }
}
