import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { MessageCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listConversations } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatPrice, timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/mesajlar")({ component: MessagesLayout });

type Conv = Awaited<ReturnType<typeof listConversations>>[number];

function MessagesLayout() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
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
    const on = () => void load();
    window.addEventListener("geldesat:inbox", on);
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 8000);
    return () => {
      stop = true;
      window.removeEventListener("geldesat:inbox", on);
      window.clearInterval(tick);
    };
  }, [user, activeId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("tr");
    if (!s) return rows;
    return rows.filter(
      (c) =>
        c.other_name.toLocaleLowerCase("tr").includes(s) ||
        c.listing_title.toLocaleLowerCase("tr").includes(s) ||
        c.last_content.toLocaleLowerCase("tr").includes(s),
    );
  }, [rows, q]);

  if (isPending) return <p className="p-10 text-center text-muted">Yükleniyor…</p>;
  if (!user) return <RedirectToSignIn />;

  return (
    <div
      data-chat-pane={activeId ? "thread" : "list"}
      className="flex min-h-0 flex-1 overflow-hidden border-t border-border bg-bg"
    >
      <aside className="chat-list flex w-full shrink-0 flex-col border-r border-border bg-surface md:w-80">
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">Mesajlar</h1>
          <p className="text-xs text-muted">{rows.length} konuşma</p>
          {rows.length > 0 ? (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="İsim veya ilan ara"
                aria-label="Konuşmalarda ara"
                className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          ) : null}
        </div>
        {!loaded ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="size-12 shrink-0 animate-pulse rounded-md bg-elevated" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-elevated" />
                  <div className="h-3 w-full animate-pulse rounded bg-elevated" />
                </div>
              </div>
            ))}
          </div>
        ) : err ? (
          <p className="p-6 text-center text-sm text-danger">{err}</p>
        ) : rows.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-border p-8 text-center">
            <MessageCircle className="mx-auto size-8 text-subtle" />
            <p className="mt-3 text-sm text-muted">Henüz konuşma yok.</p>
            <Link to="/search" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
              İlanlara göz atın
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Eşleşen konuşma yok.</p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-auto">
            {filtered.map((c) => {
              const on = c.id === activeId;
              const unread = on ? 0 : c.unread;
              const preview = c.last_sender_id === user.id && c.last_content ? `Siz: ${c.last_content}` : c.last_content || "Mesaj yok";
              return (
                <li key={c.id}>
                  <Link
                    to="/mesajlar/$id"
                    params={{ id: c.id }}
                    className={`flex gap-3 border-b border-border px-3 py-3 hover:bg-elevated ${on ? "border-l-2 border-l-primary bg-elevated" : ""}`}
                  >
                    {c.listing_image ? (
                      <img src={c.listing_image} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="grid size-12 shrink-0 place-items-center rounded-md bg-elevated text-sm font-semibold text-muted">
                        {c.other_name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}>{c.other_name}</p>
                        <span className="shrink-0 text-xs text-subtle">{timeAgo(c.updated_at)}</span>
                      </div>
                      <p className="truncate text-xs text-muted">{c.listing_title}</p>
                      <p className={`truncate text-sm ${unread ? "font-medium text-fg" : "text-muted"}`}>{preview}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs tabular-nums text-muted">{formatPrice(c.price)}</span>
                      {unread > 0 ? (
                        <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-medium text-primary-fg">
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
