import { NextResponse } from "next/server";

import { createRepository } from "@/lib/forge";
import { createRepositorySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createRepositorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repository = await createRepository(parsed.data);
  return NextResponse.json(repository, { status: 201 });
}