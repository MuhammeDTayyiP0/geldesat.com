import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { chatBus, registerUserStream, trackPresence, type ChatEvent, type UserInboxEvent } from "@/lib/server/chat-bus";
import { RateLimitError } from "@/lib/server/errors";
import { rateLimit } from "@/lib/server/helpers";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/chat/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");

        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        const user = session?.user ? { id: session.user.id, sessionId: session.session?.id } : null;
        if (!user) {
          return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
        }

        try {
          rateLimit(`sse:${user.id}`, 60, 60_000);
        } catch (err) {
          if (err instanceof RateLimitError) {
            return new Response(err.message, { status: 429, headers: { "Cache-Control": "private, no-store" } });
          }
          throw err;
        }

        const sql = await getSql();
        const prof = await sql.query<{ banned_at: unknown; deletion_requested_at: unknown }>(
          "select banned_at, deletion_requested_at from profiles where user_id=$1 limit 1",
          [user.id],
        );
        if (prof[0]?.banned_at != null || prof[0]?.deletion_requested_at != null) {
          return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
        }

        if (conversationId) {
          const conv = await sql.query<{ buyer_id: string; seller_id: string }>(
            "select buyer_id, seller_id from conversations where id=$1",
            [conversationId],
          );
          if (!conv[0] || (conv[0].buyer_id !== user.id && conv[0].seller_id !== user.id)) {
            return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
          }
        }

        let cleanup: (() => void) | null = null;
        const touchLastSeen = () =>
          void sql.query("update profiles set last_seen_at = now() where user_id = $1", [user.id]).catch(() => undefined);

        const stream = new ReadableStream({
          start(controller) {
            if (request.signal.aborted) {
              try {
                controller.close();
              } catch {
                // ignore
              }
              return;
            }
            const encoder = new TextEncoder();
            let closed = false;
            let unregisterStream: (() => void) | null = null;
            let untrack: (() => void) | null = null;

            const userEventName = `user:${user.id}`;
            const chatEventName = conversationId ? `chat:${conversationId}` : null;
            let heartbeat: ReturnType<typeof setInterval> | null = null;

            const sendData = (data: unknown) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              } catch {
                cleanup?.();
              }
            };

            const chatHandler = (event: ChatEvent) => sendData(event);
            const userHandler = (event: UserInboxEvent) => sendData(event);

            cleanup = () => {
              if (closed) return;
              closed = true;
              unregisterStream?.();
              unregisterStream = null;
              chatBus.off(userEventName, userHandler);
              if (chatEventName) chatBus.off(chatEventName, chatHandler);
              if (heartbeat) clearInterval(heartbeat);
              untrack?.();
              untrack = null;
              touchLastSeen();
              try {
                controller.close();
              } catch {
                // already closed
              }
            };

            unregisterStream = registerUserStream(user.id, cleanup);
            if (!unregisterStream) {
              closed = true;
              try {
                controller.close();
              } catch {
                // ignore
              }
              return;
            }

            untrack = trackPresence(user.id, conversationId);
            touchLastSeen();
            controller.enqueue(encoder.encode(": connected\n\n"));

            chatBus.on(userEventName, userHandler);
            if (chatEventName) chatBus.on(chatEventName, chatHandler);

            // Heartbeat every 20 seconds to keep connection alive through proxies
            let beats = 0;
            heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(": heartbeat\n\n"));
                if (++beats % 9 === 0) {
                  touchLastSeen(); // every ~3 minutes
                  if (user.sessionId) {
                    void sql
                      .query<{ ok: boolean }>(
                        `select exists (
                           select 1 from "session" s
                           join profiles p on p.user_id = s."userId"
                           where s.id = $1 and s."expiresAt" > now()
                             and p.banned_at is null and p.deletion_requested_at is null
                         ) as ok`,
                        [user.sessionId],
                      )
                      .then((rows) => {
                        if (!rows[0]?.ok) cleanup?.();
                      })
                      .catch(() => undefined);
                  }
                }
              } catch {
                cleanup?.();
              }
            }, 20000);

            request.signal.addEventListener("abort", () => {
              cleanup?.();
            }, { once: true });
          },
          cancel() {
            cleanup?.();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "private, no-cache, no-store, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
