import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { deleteListing, myListings, renewListing, setListingStatus } from "@/lib/server/account";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ListingCard } from "@/components/listing/ListingCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, listingStatusLabel } from "@/lib/utils";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { AccountShell } from "@/components/account/AccountShell";
import { toast } from "sonner";
import type { ListingCard as Listing } from "@/lib/server/helpers";

export const Route = createFileRoute("/ilanlarim")({
  head: () => ({
    meta: [
      { title: "İlanlarım | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Mine,
});

function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function Mine() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Listing[]>([]);
  const [pendingDel, setPendingDel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** Run an owner action, report the server's answer and refresh the list. */
  function act(run: () => Promise<unknown>, done: string) {
    run()
      .then(() => {
        toast.success(done);
        reload();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "İşlem başarısız oldu"));
  }

  function reload() {
    setLoading(true);
    myListings()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    if (user) reload();
  }, [user]);

  if (isPending || (loading && rows.length === 0 && user)) {
    return <BrandSpinner fullPage text="İlanlarınız yükleniyor…" />;
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <AccountShell
      title="İlanlarım"
      description="Yayındaki, onay bekleyen ve pasif ilanlarınızı yönetin."
      actions={
        <Link to="/ilan-ver">
          <Button size="sm">Yeni ilan</Button>
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-muted">Henüz ilanınız yok.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((l) => {
            const expired = isExpired(l.expires_at);
            return (
              <div key={l.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={l.status === "ACTIVE" && !expired ? "ok" : l.status === "PENDING" ? "warn" : "muted"}>
                    {listingStatusLabel(l.status, expired)}
                  </Badge>
                  {l.status === "PENDING" ? (
                    <span className="text-xs text-warn">İnceleme bitince yayına alınır.</span>
                  ) : null}
                  <span className="text-xs text-muted">{l.view_count} görüntülenme</span>
                  {l.expires_at ? (
                    <span className={`text-xs ${expired ? "text-warn" : "text-muted"}`}>
                      {expired ? "Bitti" : "Bitiş"}: {formatDate(l.expires_at)}
                    </span>
                  ) : null}
                </div>
                <ListingCard listing={l} variant="list" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link to="/ilan-ver" search={{ id: l.id }}>
                      <Button size="sm" variant="outline" className="min-h-9 font-medium">
                        Düzenle
                      </Button>
                    </Link>
                    {l.status === "ACTIVE" && !expired ? (
                      <Button size="sm" variant="outline" className="min-h-9 font-medium" onClick={() => act(() => setListingStatus({ data: { id: l.id, status: "SOLD" } }), "Satıldı olarak işaretlendi")}>
                        Satıldı
                      </Button>
                    ) : null}
                    {l.status === "ACTIVE" && !expired ? (
                      <Button size="sm" variant="outline" className="min-h-9 font-medium" onClick={() => act(() => setListingStatus({ data: { id: l.id, status: "INACTIVE" } }), "Yayından kaldırıldı")}>
                        Yayından kaldır
                      </Button>
                    ) : null}
                    {(l.status === "INACTIVE" || l.status === "SOLD") && !expired ? (
                      <Button size="sm" variant="outline" className="min-h-9 font-medium" onClick={() => act(() => setListingStatus({ data: { id: l.id, status: "ACTIVE" } }), "Tekrar yayında")}>
                        Yayına al
                      </Button>
                    ) : null}
                    {l.status !== "REJECTED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-9 font-medium"
                        onClick={() => act(() => renewListing({ data: { id: l.id } }), "Süre 30 gün uzatıldı")}
                      >
                        {expired ? "Yenile ve yayına al" : "30 gün yenile"}
                      </Button>
                    ) : null}
                  </div>
                  <div>
                    {pendingDel === l.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="danger"
                          className="min-h-9"
                          onClick={() => {
                            setPendingDel(null);
                            act(() => deleteListing({ data: { id: l.id } }), "İlan silindi");
                          }}
                        >
                          Evet, sil
                        </Button>
                        <Button size="sm" variant="ghost" className="min-h-9" onClick={() => setPendingDel(null)}>
                          Vazgeç
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="danger" className="min-h-9" onClick={() => setPendingDel(l.id)}>
                        Sil
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}
