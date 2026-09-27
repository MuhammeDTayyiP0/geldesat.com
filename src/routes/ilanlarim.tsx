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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">İlanlarım</h1>
        <Link to="/ilan-ver">
          <Button>Yeni ilan</Button>
        </Link>
      </div>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/ilan-ver" search={{ id: l.id }}>
                    <Button size="sm" variant="outline">
                      Düzenle
                    </Button>
                  </Link>
                  {l.status === "ACTIVE" && !expired ? (
                    <Button size="sm" variant="outline" onClick={() => setListingStatus({ data: { id: l.id, status: "SOLD" } }).then(reload)}>
                      Satıldı
                    </Button>
                  ) : null}
                  {l.status === "ACTIVE" && !expired ? (
                    <Button size="sm" variant="outline" onClick={() => setListingStatus({ data: { id: l.id, status: "INACTIVE" } }).then(reload)}>
                      Yayından kaldır
                    </Button>
                  ) : null}
                  {(l.status === "INACTIVE" || l.status === "SOLD") && !expired ? (
                    <Button size="sm" variant="outline" onClick={() => setListingStatus({ data: { id: l.id, status: "ACTIVE" } }).then(reload)}>
                      Yayına al
                    </Button>
                  ) : null}
                  {l.status !== "REJECTED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        renewListing({ data: { id: l.id } })
                          .then(() => {
                            toast.success("Süre 30 gün uzatıldı");
                            reload();
                          })
                          .catch((e) => toast.error(e instanceof Error ? e.message : "Yenilenemedi"))
                      }
                    >
                      {expired ? "Yenile ve yayına al" : "30 gün yenile"}
                    </Button>
                  ) : null}
                  {pendingDel === l.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          void deleteListing({ data: { id: l.id } }).then(() => {
                            setPendingDel(null);
                            reload();
                          })
                        }
                      >
                        Evet, sil
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDel(null)}>
                        Vazgeç
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setPendingDel(l.id)}>
                      Sil
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
