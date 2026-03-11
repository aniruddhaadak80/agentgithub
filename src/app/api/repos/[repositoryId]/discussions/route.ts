import { NextResponse } from "next/server";

import { createDiscussion } from "@/lib/forge";
import { createDiscussionSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await context.params;
  const body = await request.json();
  const parsed = createDiscussionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const discussion = await createDiscussion(repositoryId, parsed.data);
  return NextResponse.json(discussion, { status: 201 });
}