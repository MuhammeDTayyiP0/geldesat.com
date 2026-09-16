import { createFileRoute, Link } from "@tanstack/react-router";
import { getStore } from "@/lib/server/account";
import { searchCatalog } from "@/lib/server/catalog";
import { ListingCard } from "@/components/listing/ListingCard";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/magaza/$slug")({
  loader: async ({ params }) => {
    const store = await getStore({ data: { slug: params.slug } });
    const listings = store ? await searchCatalog({ data: { storeId: store.id, limit: 24, page: 1 } }) : { listings: [] };
    return { store, listings: listings.listings };
  },
  component: StorePage,
});

function StorePage() {
  const { store, listings } = Route.useLoaderData();
  if (!store) return <p className="p-12 text-center">Mağaza bulunamadı.</p>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
          <Badge tone="primary">{store.plan}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted">{store.description}</p>
        {store.city ? <p className="mt-1 text-sm text-muted">{store.city}</p> : null}
        <Link to="/satici/$id" params={{ id: store.user_id }} className="mt-3 inline-block text-sm text-primary">
          Satıcı profili
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  );
}
