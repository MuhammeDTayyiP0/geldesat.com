import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { MessageCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listConversations } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { formatPrice, timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/mesajlar")({ component: MessagesLayout });

type Conv = Awaited<ReturnType<typeof listConversations>>[number];

function MessagesLayout() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const activeId = useRouterState({
    select: (s) => {
      const m = s.matches.find((x) => x.routeId === "/mesajlar/$id");
      return (m?.params as { id?: string } | undefined)?.id;
    },
  });

  useEffect(() => {
    if (!user) return;
    let stop = false;
    async function load() {
      try {
        const next = await listConversations();
        if (stop) return;
        setRows(next);
        setErr("");
      } catch {
        if (!stop) setErr("Konuşmalar yüklenemedi.");
      } finally {
        if (!stop) setLoaded(true);
      }
    }
    void load();

    const on = (e: Event) => {
      const custom = e as CustomEvent<{
        type?: string;
        message?: { sender_id: string; content: string; created_at: string };
        conversationId?: string;
      }>;
      if (custom?.detail?.type === "new_message" && custom.detail.message && custom.detail.conversationId) {
        const { conversationId, message } = custom.detail;
        setRows((prev) => {
          const idx = prev.findIndex((c) => c.id === conversationId);
          if (idx !== -1) {
            const item = prev[idx];
            const updated: Conv = {
              ...item,
              last_content: message.content,
              last_sender_id: message.sender_id,
              updated_at: message.created_at,
              unread: item.id === activeId ? 0 : item.unread + 1,
            };
            return [updated, ...prev.filter((_, i) => i !== idx)];
          }
          return prev;
        });
      }
      void load();
    };

    window.addEventListener("geldesat:inbox", on);

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/chat/stream");
      es.onmessage = (e) => {
        if (stop) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === "new_message" || data.type === "read_update" || data.type === "inbox_ping") {
            on(new CustomEvent("geldesat:inbox", { detail: data }));
          }
        } catch {
          // ignore non-json
        }
      };
    } catch {
      // SSE fallback to polling
    }

    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 12000);

    return () => {
      stop = true;
      es?.close();
      window.removeEventListener("geldesat:inbox", on);
      window.clearInterval(tick);
    };
  }, [user, activeId]);

  const totalUnread = useMemo(() => rows.reduce((acc, c) => acc + (c.unread > 0 ? 1 : 0), 0), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "unread") {
      list = list.filter((c) => c.unread > 0);
    }
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return list;
    return list.filter(
      (c) =>
        c.other_name.toLocaleLowerCase("tr").includes(s) ||
        c.listing_title.toLocaleLowerCase("tr").includes(s) ||
        c.last_content.toLocaleLowerCase("tr").includes(s),
    );
  }, [rows, q, filter]);

  if (isPending) return <BrandSpinner fullPage text="Mesajlarınız yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  return (
    <div
      data-chat-pane={activeId ? "thread" : "list"}
      className="flex min-h-0 flex-1 overflow-hidden border-t border-border bg-bg"
    >
      <aside className="chat-list flex w-full shrink-0 flex-col border-r border-border bg-surface md:w-84 lg:w-92">
        <div className="border-b border-border p-3.5 pb-2.5">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight text-fg">Mesajlar</h1>
            <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-medium text-muted">
              {rows.length} sohbet
            </span>
          </div>

          {rows.length > 0 ? (
            <>
              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="İsim veya ilan ara"
                  aria-label="Konuşmalarda ara"
                  className="h-10 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm"
                />
              </div>

              <div className="mt-2.5 flex gap-1 border-b border-border/60 pb-1">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    filter === "all"
                      ? "bg-primary text-primary-fg shadow-2xs"
                      : "text-muted hover:bg-elevated hover:text-fg"
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    filter === "unread"
                      ? "bg-primary text-primary-fg shadow-2xs"
                      : "text-muted hover:bg-elevated hover:text-fg"
                  }`}
                >
                  <span>Okunmamış</span>
                  {totalUnread > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        filter === "unread" ? "bg-white text-primary" : "bg-primary text-primary-fg"
                      }`}
                    >
                      {totalUnread}
                    </span>
                  ) : null}
                </button>
              </div>
            </>
          ) : null}
        </div>

        {!loaded ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <BrandSpinner size="sm" text="Sohbetler yükleniyor…" />
          </div>
        ) : err ? (
          <p className="p-6 text-center text-sm text-danger">{err}</p>
        ) : rows.length === 0 ? (
          <div className="m-4 rounded-xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-elevated">
              <MessageCircle className="size-6 text-muted" />
            </div>
            <p className="mt-3 text-sm font-semibold text-fg">Henüz mesajınız yok</p>
            <p className="mt-1 text-xs text-muted">İlgilendiğiniz ilanların sayfalarından satıcılara soru sorabilirsiniz.</p>
            <Link to="/search" className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90">
              İlanlara göz atın
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-muted">Eşleşen konuşma bulunamadı.</p>
            {filter === "unread" ? (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Tüm konuşmaları göster
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-auto">
            {filtered.map((c) => {
              const on = c.id === activeId;
              const unread = on ? 0 : c.unread;
              const preview =
                c.last_sender_id === user.id && c.last_content
                  ? `Siz: ${c.last_content}`
                  : c.last_content || "Mesaj yok";
              return (
                <li key={c.id}>
                  <Link
                    to="/mesajlar/$id"
                    params={{ id: c.id }}
                    className={`flex items-center gap-3 px-3 py-3 transition-colors hover:bg-elevated/70 ${
                      on ? "border-l-3 border-l-primary bg-elevated font-medium" : ""
                    }`}
                  >
                    <div className="relative size-12 shrink-0">
                      {c.other_avatar ? (
                        <img
                          src={c.other_avatar}
                          alt=""
                          className="size-12 rounded-full object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-elevated to-border/80 text-sm font-bold text-fg ring-1 ring-border/50">
                          {c.other_name.slice(0, 1).toLocaleUpperCase("tr")}
                        </div>
                      )}
                      {c.listing_image ? (
                        <img
                          src={c.listing_image}
                          alt=""
                          className="absolute -bottom-1 -right-1 size-5 rounded-md border-2 border-surface object-cover shadow-xs"
                          title={c.listing_title}
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className={`truncate text-sm ${unread > 0 ? "font-bold text-fg" : "font-medium text-fg"}`}>
                          {c.other_name}
                        </p>
                        <span className="shrink-0 text-[11px] text-subtle">{timeAgo(c.updated_at)}</span>
                      </div>
                      <p className="truncate text-xs text-muted/90">{c.listing_title}</p>
                      <p className={`truncate text-xs ${unread > 0 ? "font-semibold text-fg" : "text-muted"}`}>
                        {preview}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5 pl-1">
                      {c.price > 0 ? (
                        <span className="text-xs font-semibold tabular-nums text-primary">
                          {formatPrice(c.price)}
                        </span>
                      ) : null}
                      {unread > 0 ? (
                        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-fg shadow-xs">
                          {unread}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <section className="chat-thread flex min-w-0 flex-1 flex-col">
        <Outlet />
      </section>
    </div>
  );
}
