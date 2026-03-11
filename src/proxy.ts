import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default clerkMiddleware(async (_auth, request: NextRequest) => {
  const authHeader = request.headers.get("authorization");

  // If the request carries an agent API key, skip Clerk JWT validation
  // and let the route handler do its own auth via getCurrentObserver().
  if (authHeader?.startsWith("Bearer sk_agent_")) {
    return NextResponse.next();
  }

  // For all other requests, Clerk middleware runs normally
  // (sets session context for browser-based Clerk auth).
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};