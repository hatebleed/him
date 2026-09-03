import { authRoute } from "@/server/api/handler";
import { subscribe, isEventForUser, type DomainEvent } from "@/lib/realtime/bus";
import { db } from "@/lib/db/client";
import { channelMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/events/stream
 * Server-sent events for the signed-in user. The transport is pluggable:
 * the local event bus fans out in-process today, and a Redis/WebSocket
 * provider can replace it without touching publishers or subscribers.
 */
export const GET = authRoute(async (request, context) => {
  const memberships = await db.select({ channelId: channelMembers.channelId }).from(channelMembers).where(eq(channelMembers.userId, context.user.id));
  const channelIds = memberships.map((row) => row.channelId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("ready", { userId: context.user.id, at: new Date().toISOString() });

      const unsubscribe = subscribe((event: DomainEvent) => {
        if (!isEventForUser(event, context.user.id, channelIds)) return;
        send(event.type, event.payload);
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          /* stream closed */
        }
      }, 25_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
