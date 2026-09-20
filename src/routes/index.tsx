import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Car, GraduationCap, PawPrint, Search, ShoppingBag, Tractor, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { featuredListings, listCategories, statsHome } from "@/lib/server/catalog";
import { ListingCard } from "@/components/listing/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [cats, featured, stats] = await Promise.all([listCategories(), featuredListings(), statsHome()]);
    return { cats, featured, stats };
  },
  component: Home,
});

const ICONS: Record<string, typeof Car> = {
  home: Building2,
  car: Car,
  bag: ShoppingBag,
  wrench: Wrench,
  paw: PawPrint,
  briefcase: Building2,
  cog: Wrench,
  tractor: Tractor,
  grad: GraduationCap,
  users: Users,
};

function Home() {
  const { cats, featured, stats } = Route.useLoaderData();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");

  function search(e: React.FormEvent) {
    e.preventDefault();
    const category = tab === "all" ? undefined : tab;
    void nav({ to: "/search", search: { q, category } });
  }

  return (
    <div>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Türkiye ilan platformu</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Emlak, vasıta ve ikinci el ilanları
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            {stats.listings} yayındaki ilan
            {stats.cities ? `, ${stats.cities} il` : ""}. Ücretsiz ilan verin, satıcıyla doğrudan konuşun.
          </p>
          <div className="mt-6 max-w-3xl rounded-xl border border-border bg-bg p-2 shadow-card">
            <div className="mb-2 flex flex-wrap gap-1">
              {[
                { id: "all", label: "Tümü" },
                { id: "emlak", label: "Emlak" },
                { id: "vasita", label: "Vasıta" },
                { id: "alisveris", label: "Alışveriş" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-2 text-sm ${tab === t.id ? "bg-ink text-primary-fg" : "text-muted hover:bg-elevated"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} className="rounded-lg pl-9" placeholder="Örn. Civic, 3+1 kiralık, iPhone" />
              </div>
              <Button type="submit" size="lg">
                Ara
              </Button>
            </form>
            <div className="mt-2 flex flex-wrap gap-2 px-1">
              {[
                { q: "Civic", label: "Civic" },
                { q: "3+1", label: "3+1" },
                { q: "iPhone", label: "iPhone" },
                { q: "kiralık", label: "Kiralık" },
              ].map((c) => (
                <button
                  key={c.q}
                  type="button"
                  className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary"
                  onClick={() => void nav({ to: "/search", search: { q: c.q } })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Kategoriler</h2>
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
          {cats.roots.map((c: any) => {
            const Icon = ICONS[c.icon ?? ""] ?? Building2;
            return (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="rounded-xl border border-border bg-surface p-4 transition-[box-shadow,border-color] duration-150 hover:border-primary/40 hover:shadow-lift"
              >
                <Icon className="size-5 text-primary" />
                <p className="mt-3 text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted">{cats.counts[c.id] ?? 0} ilan</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border bg-surface py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Vitrin</h2>
              <p className="text-sm text-muted">Öne çıkan ve güncel ilanlar</p>
            </div>
            <Link to="/search" className="text-sm font-medium text-primary hover:underline">
              Tümü
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-bg p-10 text-center">
              <p className="text-muted">Henüz vitrin ilanı yok.</p>
              <Link to="/ilan-ver" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                İlk ilanı siz verin
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((l: any) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
