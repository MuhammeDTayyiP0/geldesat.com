import { Heart } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { myFavorites } from "@/lib/server/social";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { ListingCard } from "@/components/listing/ListingCard";
import type { ListingCard as Listing } from "@/lib/server/helpers";

export const Route = createFileRoute("/favoriler")({ component: Favs });

function Favs() {
  const { user, isPending } = useCurrentUserState();
  const [rows, setRows] = useState<Listing[]>([]);
  useEffect(() => {
    if (user) void myFavorites().then(setRows).catch(() => setRows([]));
  }, [user]);
  if (isPending) return <BrandSpinner fullPage text="Favorileriniz yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Favoriler</h1>
      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <Heart className="mx-auto size-8 text-subtle" />
          <p className="mt-3 text-muted">Henüz favori yok.</p>
          <Link to="/search" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            İlanlara göz at
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {rows.map((l) => (
            <ListingCard key={l.id} listing={l} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}
