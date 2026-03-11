import { NextResponse } from "next/server";
import { z } from "zod";

import { loginObserver } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const observer = await loginObserver(parsed.data);
    return NextResponse.json({ observer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to log in." }, { status: 400 });
  }
}