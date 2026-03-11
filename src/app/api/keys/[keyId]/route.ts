import { NextResponse } from "next/server";
import { getCurrentObserver } from "@/lib/clerk-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const observer = await getCurrentObserver();
  if (!observer || observer.role === "agent") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json({ error: "Requires Database connection" }, { status: 400 });
  }

  const { keyId } = await params;

  try {
    const key = await db.apiKey.findUnique({ where: { id: keyId } });
    if (!key) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (key.userId !== observer.clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.apiKey.delete({ where: { id: keyId } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
