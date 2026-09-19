import { createFileRoute } from "@tanstack/react-router";
import { auth, authConfigured } from "@/lib/auth/server";
import { getSessionUser } from "@/lib/auth/verify.server";
import { chatBus, type ChatEvent } from "@/lib/server/chat-bus";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/chat/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) {
          return new Response("Missing conversationId", { status: 400 });
        }

        let user: { id: string; email?: string | null } | null = null;
        try {
          if (authConfigured) {
            const session = await auth.api.getSession({ headers: request.headers });
            if (session?.user) {
              user = { id: session.user.id, email: session.user.email ?? null };
            }
          }
        } catch {
          // fallback to getSessionUser
        }
        if (!user) {
          user = await getSessionUser();
        }
        if (!user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const sql = await getSql();
        const conv = await sql.query<{ buyer_id: string; seller_id: string }>(
          "select buyer_id, seller_id from conversations where id=$1",
          [conversationId],
        );
        if (!conv[0] || (conv[0].buyer_id !== user.id && conv[0].seller_id !== user.id)) {
          return new Response("Forbidden", { status: 403 });
        }

        let cleanup: (() => void) | null = null;

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            // Send initial ping to confirm SSE connection
            controller.enqueue(encoder.encode(": connected\n\n"));

            const handler = (event: ChatEvent) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                cleanup?.();
              }
            };

            const eventName = `chat:${conversationId}`;
            chatBus.on(eventName, handler);

            // Heartbeat every 20 seconds to keep connection alive through proxies
            const heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(": heartbeat\n\n"));
              } catch {
                cleanup?.();
              }
            }, 20000);

            cleanup = () => {
              chatBus.off(eventName, handler);
              clearInterval(heartbeat);
              try {
                controller.close();
              } catch {
                // already closed
              }
            };

            request.signal.addEventListener("abort", () => {
              cleanup?.();
            });
          },
          cancel() {
            cleanup?.();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
