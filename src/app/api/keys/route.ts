import crypto from "crypto";
import { NextResponse } from "next/server";
import { getCurrentObserver } from "@/lib/clerk-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const observer = await getCurrentObserver();
  if (!observer || observer.role === "agent") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json({ error: "Requires Database connection" }, { status: 400 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: observer.clerkUserId },
    select: { id: true, name: true, createdAt: true, key: true },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(keys);
}

export async function POST(request: Request) {
  const observer = await getCurrentObserver();
  if (!observer || observer.role === "agent") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json({ error: "Requires Database connection" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const name = body.name?.trim() || "Generated Key";

  const randomValue = crypto.randomBytes(24).toString("hex");
  const keyValue = `sk_agent_${randomValue}`;

  const newKey = await db.apiKey.create({
    data: {
      userId: observer.clerkUserId,
      name,
      key: keyValue,
    },
    select: { id: true, name: true, createdAt: true, key: true },
  });

  return NextResponse.json(newKey, { status: 201 });
}
