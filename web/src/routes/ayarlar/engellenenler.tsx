import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { listBlockedUsers } from "@/lib/server/chat";
import { unblockUser } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { Button } from "@/components/ui/button";
import { AccountShell, UserAvatar } from "@/components/account/AccountShell";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/ayarlar/engellenenler")({
  head: () => ({ meta: [{ title: "Engellenenler | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: BlockedUsers,
});

type Row = Awaited<ReturnType<typeof listBlockedUsers>>[number];

function BlockedUsers() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listBlockedUsers()
      .then(setRows)
      .catch(() => setRows([]));
  }, [user]);

  if (isPending || (user && !rows)) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user || !rows) return <RedirectToSignIn />;

  async function unblock(r: Row) {
    setBusy(r.id);
    try {
      await unblockUser({ data: { userId: r.id } });
      setRows((prev) => (prev ?? []).filter((x) => x.id !== r.id));
      toast.success(`${r.name} engeli kaldırıldı`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Engel kaldırılamadı");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AccountShell title="Engellenenler" description="Engellediğiniz kişiler size mesaj gönderemez, siz de onlara gönderemezsiniz.">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <Ban className="mx-auto size-8 text-subtle" />
          <p className="mt-3 text-sm text-muted">Engellediğiniz kimse yok.</p>
          <p className="mt-1 text-xs text-subtle">Bir sohbetteki ⋮ menüsünden kullanıcıları engelleyebilirsiniz.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar src={r.avatar} name={r.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted">{formatDate(r.since)} tarihinde engellendi</p>
              </div>
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void unblock(r)}>
                Engeli kaldır
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
