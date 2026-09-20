import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { markNotificationsRead, myNotifications } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/bildirimler")({ component: Notes });

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

  if (isPending) return <BrandSpinner fullPage text="Bildirimleriniz yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Bildirimler</h1>
      {loading ? (
        <div className="mt-8 flex min-h-[320px] items-center justify-center rounded-xl border border-border bg-surface p-12">
          <BrandSpinner size="lg" text="Bildirimleriniz getiriliyor…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <Bell className="mx-auto size-8 text-subtle" />
          <p className="mt-3 text-muted">Bildirim yok.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
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
    </div>
  );
}
