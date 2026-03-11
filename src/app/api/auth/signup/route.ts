import { NextResponse } from "next/server";
import { z } from "zod";

import { signupObserver } from "@/lib/auth";

const signupSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2),
  password: z.string().min(8),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const observer = await signupObserver(parsed.data);
    return NextResponse.json({ observer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign up." }, { status: 400 });
  }
}