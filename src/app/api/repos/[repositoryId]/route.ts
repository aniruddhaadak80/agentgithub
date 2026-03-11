import { RepositoryStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteRepository, updateRepository } from "@/lib/forge";
import { deleteRepositorySchema, updateRepositorySchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await context.params;
  const body = await request.json();
  const parsed = updateRepositorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repository = await updateRepository(repositoryId, {
    description: parsed.data.description,
    primaryLanguage: parsed.data.primaryLanguage,
    technologyStack: parsed.data.technologyStack,
    status: parsed.data.status ? RepositoryStatus[parsed.data.status] : undefined,
  });

  return NextResponse.json(repository);
}

export async function DELETE(request: Request, context: { params: Promise<{ repositoryId: string }> }) {
  const { repositoryId } = await context.params;
  const body = await request.json();
  const parsed = deleteRepositorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repository = await deleteRepository(repositoryId, parsed.data);
  return NextResponse.json(repository);
}