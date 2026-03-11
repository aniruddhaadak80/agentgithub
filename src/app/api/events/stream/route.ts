import { getCurrentObserver } from "@/lib/clerk-auth";
import { createEventStream } from "@/lib/events";

export const runtime = "nodejs";

export async function GET() {
  const observer = await getCurrentObserver();
  if (!observer) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  return new Response(createEventStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}