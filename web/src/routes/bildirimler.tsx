import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { markNotificationsRead, myNotifications } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { timeAgo } from "@/lib/utils";
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

function Notes() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof myNotifications>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void myNotifications()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    void markNotificationsRead();
  }, [user]);

  if (isPending || (loading && rows.length === 0 && user)) {
    return <BrandSpinner fullPage text="Bildirimleriniz yükleniyor…" />;
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <AccountShell title="Bildirimler">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <Bell className="mx-auto size-8 text-subtle" />
          <p className="mt-3 text-muted">Bildirim yok.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((n) => (
            <li key={n.id}>
              <a href={n.link} className="block p-4 hover:bg-elevated">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-subtle">{timeAgo(n.created_at)}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
