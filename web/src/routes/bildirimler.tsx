import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Clock, Heart, LayoutGrid, MessageCircle, Settings, Store, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { markNotificationsRead, myNotifications } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { cn, timeAgo } from "@/lib/utils";
import { setUnread } from "@/lib/unread-store";
import { AccountShell } from "@/components/account/AccountShell";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({
    meta: [
      { title: "Bildirimler | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Notes,
});

type Note = Awaited<ReturnType<typeof myNotifications>>[number];

const ICONS: Record<string, LucideIcon> = {
  message: MessageCircle,
  favorite: Heart,
  listing: LayoutGrid,
  expiry: Clock,
  credit: Wallet,
  system: Store,
};

function Notes() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Note[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void myNotifications()
      .then((list) => {
        if (!alive) return;
        // Show which ones are new on this visit, then count them as read.
        setRows(list);
        if (list.some((n) => !n.read)) {
          void markNotificationsRead().then(() => setUnread((prev) => ({ ...prev, notifications: 0 })));
        }
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [user]);

  if (isPending || (user && !rows)) return <BrandSpinner fullPage text="Bildirimleriniz yükleniyor…" />;
  if (!user || !rows) return <RedirectToSignIn />;

  function open(n: Note) {
    // Notification links are site paths; external ones (if any) open normally.
    if (n.link.startsWith("/")) void navigate({ to: n.link });
    else window.location.href = n.link;
  }

  return (
    <AccountShell
      title="Bildirimler"
      actions={
        <button
          type="button"
          onClick={() => void navigate({ to: "/ayarlar/bildirimler" })}
          className="grid size-10 place-items-center rounded-full hover:bg-elevated"
          aria-label="Bildirim tercihleri"
        >
          <Settings className="size-5 text-muted" />
        </button>
      }
    >
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <Bell className="mx-auto size-8 text-subtle" />
          <p className="mt-3 font-medium">Bildirim yok</p>
          <p className="mt-1 text-sm text-muted">Mesaj, favori ve ilan durumu bildirimleriniz burada görünür.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {rows.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn("flex w-full items-start gap-3 p-4 text-left hover:bg-elevated", !n.read && "bg-primary/6")}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", n.read ? "bg-elevated text-muted" : "bg-primary/12 text-primary")}>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                    {n.body ? <span className="block text-sm text-muted">{n.body}</span> : null}
                    <span className="mt-1 block text-xs text-subtle">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read ? <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Yeni" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
