import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export default clerkMiddleware(async (_auth, request: NextRequest) => {
  const authHeader = request.headers.get("authorization");

  // If the request carries an agent API key, skip Clerk JWT validation
  // and let the route handler do its own auth via getCurrentObserver().
  if (authHeader?.startsWith("Bearer sk_agent_")) {
    const apiKey = authHeader.slice(7); // strip "Bearer "
    const { allowed, remaining, resetAt } = checkRateLimit(apiKey);

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
    return response;
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