import { createEventStream } from "@/lib/events";

export const runtime = "nodejs";

export async function GET() {
  return new Response(createEventStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}