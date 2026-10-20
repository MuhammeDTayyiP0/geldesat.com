import { Heart } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { myFavorites } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ListingCard } from "@/components/listing/ListingCard";
import { CardGridSkeleton } from "@/components/listing/ListingGridSkeleton";
import { AccountShell } from "@/components/account/AccountShell";
import type { ListingCard as Listing } from "@/lib/server/helpers";

export const Route = createFileRoute("/favoriler")({
  head: () => ({
    meta: [
      { title: "Favorilerim | GeldeSat" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Favs,
});

function Favs() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setLoading(true);
      void myFavorites()
        .then(setRows)
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (!isPending && !user) return <RedirectToSignIn />;

  return (
    <AccountShell title="Favorilerim" description={rows.length ? `${rows.length} kayıtlı ilan` : "Kaydettiğiniz ilanlar."}>
      {isPending || loading ? (
        <CardGridSkeleton count={6} className="lg:grid-cols-3" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <Heart className="mx-auto size-8 text-subtle" />
          <p className="mt-3 text-muted">Henüz favori yok.</p>
          <Link to="/search" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            İlanlara göz at
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          {rows.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              initialFavorite
              onFavoriteChange={(fav) => !fav && setRows((r) => r.filter((x) => x.id !== l.id))}
            />
          ))}
        </div>
      )}
    </AccountShell>
  );
}
