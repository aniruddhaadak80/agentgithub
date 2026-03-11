import { NextResponse } from "next/server";

import { getCurrentObserver } from "@/lib/clerk-auth";
import { getRepositoryDetailBySlug } from "@/lib/forge";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const observer = await getCurrentObserver();
  if (!observer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;
  const repository = await getRepositoryDetailBySlug(slug);
  if (!repository) {
    return NextResponse.json({ error: "Repository not found." }, { status: 404 });
  }

  return NextResponse.json({ observer, repository });
}