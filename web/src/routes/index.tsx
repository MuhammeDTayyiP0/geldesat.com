import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Clock, LocateFixed, MapPin, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { homeListings, listCategoryRoots, searchCatalog, statsHome } from "@/lib/server/catalog";
import { myRecentListings } from "@/lib/server/social";
import type { ListingCard as Listing } from "@/lib/server/helpers";
import { ListingCard } from "@/components/listing/ListingCard";
import { CardGridSkeleton } from "@/components/listing/ListingGridSkeleton";
import { ListingRail } from "@/components/home/ListingRail";
import { categoryVisual } from "@/components/admin/categories/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { TURKEY_CITIES } from "@/lib/data/locations";
import { useNearbyCity } from "@/lib/nearby-city";
import { formatNumber } from "@/lib/utils";
import { jsonLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [cats, rails, stats] = await Promise.all([listCategoryRoots(), homeListings(), statsHome()]);
    return { cats, rails, stats };
  },
  head: () => {
    const BASE = "https://www.geldesat.com";
    return {
      meta: [
        { title: "GeldeSat — Türkiye İlan Platformu | Ücretsiz İlan Ver" },
        { name: "description", content: "GeldeSat — Türkiye'nin ücretsiz ilan platformu. Emlak, vasıta, ikinci el eşya ve hizmet ilanlarını saniyeler içinde verin. Güvenli iletişim, anlık mesajlaşma." },
        { name: "robots", content: "index,follow" },
        { name: "keywords", content: "ücretsiz ilan, ikinci el, emlak ilanları, vasıta ilanları, sahibinden satılık, kiralık, GeldeSat" },
        // Open Graph
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: BASE },
        { property: "og:title", content: "GeldeSat — Türkiye İlan Platformu" },
        { property: "og:description", content: "Emlak, vasıta ve ikinci el ilanlar. Ücretsiz ilan verin, güvenli alın satın." },
        { property: "og:image", content: `${BASE}/og.jpg` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        // Twitter / X
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "GeldeSat — Türkiye İlan Platformu" },
        { name: "twitter:description", content: "Emlak, vasıta ve ikinci el ilanlar. Ücretsiz ilan verin, güvenli alın satın." },
        { name: "twitter:image", content: `${BASE}/og.jpg` },
      ],
      links: [{ rel: "canonical", href: BASE }],
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "GeldeSat",
            alternateName: "geldesat.com",
            url: BASE,
            inLanguage: "tr-TR",
            publisher: { "@type": "Organization", name: "GeldeSat", url: BASE },
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${BASE}/search?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }),
        },
        {
          // HowTo — "İlan nasıl verilir?" zengin sonuçlara çıkar
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "GeldeSat'ta Ücretsiz İlan Nasıl Verilir?",
            description: "GeldeSat'ta birkaç adımda ücretsiz ilan verin, milyonlarca alıcıya ulaşın.",
            step: [
              { "@type": "HowToStep", position: 1, name: "Üye Olun", text: "Ücretsiz hesap oluşturun veya Google ile giriş yapın." },
              { "@type": "HowToStep", position: 2, name: "İlan Verin", text: "'İlan Ver' butonuna tıklayın ve kategori seçin." },
              { "@type": "HowToStep", position: 3, name: "Fotoğraf Ekleyin", text: "Ürününüzün net fotoğraflarını yükleyin." },
              { "@type": "HowToStep", position: 4, name: "Yayınlayın", text: "Fiyatı ve açıklamayı girdikten sonra ilanınızı ücretsiz yayınlayın." },
            ],
          }),
        },
      ],
    };
  },

  component: Home,
});

const QUICK = ["Civic", "3+1", "iPhone", "Kiralık"];

/** Same layout as the app's home: search, category strip, rails, then the newest listings. */
function Home() {
  const { cats, rails, stats } = Route.useLoaderData();
  const nav = useNavigate();
  const [q, setQ] = useState("");

  function search(e: React.FormEvent) {
    e.preventDefault();
    void nav({ to: "/search", search: { q: q.trim() || undefined } });
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="pb-1 pt-4 sm:pt-8">
        <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Emlak, Vasıta ve İkinci El İlanları</h1>
        <p className="mt-1 text-sm text-muted">
          {stats.listings > 0 ? `${formatNumber(stats.listings)} yayındaki ilan${stats.cities ? `, ${stats.cities} il` : ""}. ` : ""}
          Ücretsiz ilan verin, satıcıyla doğrudan konuşun.
        </p>
        <form onSubmit={search} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-12 rounded-xl bg-surface pl-10 text-[15px]"
              placeholder="Marka, model, ürün veya ilan no"
              aria-label="İlan ara"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 rounded-xl px-5">
            Ara
          </Button>
          <Link
            to="/ilan-ver"
            className="hidden h-12 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 md:inline-flex"
          >
            <Plus className="size-4 stroke-[2.6]" /> Ücretsiz İlan Ver
          </Link>
        </form>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK.map((t) => (
            <Link
              key={t}
              to="/search"
              search={{ q: t }}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-primary sm:text-sm"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>

      <CategoryStrip roots={cats.roots} counts={cats.counts} />

      <ListingRail
        title="Acil satılık"
        subtitle="Sahibi hızlı satmak istiyor"
        items={rails.urgent}
        seeAll={{ to: "/search", search: { urgent: "1" } }}
      />
      <ListingRail title="Vitrin" items={rails.featured} seeAll={{ to: "/search", search: { featured: "1" } }} />
      <NearbyRail />
      <RecentRail />

      <LatestFeed initial={rails.latest} pages={rails.latestPages} />
    </div>
  );
}

function CategoryStrip({
  roots,
  counts,
}: {
  roots: { id: string; name: string; slug: string; icon: string | null }[];
  counts: Record<string, number>;
}) {
  return (
    <nav aria-label="Kategoriler" className="-mx-4 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-1 sm:gap-2 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(104px,1fr))]">
        {roots.map((c) => {
          const { icon: Icon, tint } = categoryVisual(c.icon);
          return (
            <li key={c.id} className="shrink-0">
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group flex w-[76px] flex-col items-center gap-1.5 rounded-xl p-1 text-center lg:w-full"
              >
                <span
                  className="grid size-14 place-items-center rounded-[18px] transition-transform group-hover:-translate-y-0.5"
                  style={{ backgroundColor: `${tint}1a`, color: tint }}
                >
                  <Icon className="size-[26px]" strokeWidth={1.9} />
                </span>
                <span className="line-clamp-1 w-full text-xs font-medium text-fg">{c.name}</span>
                {counts[c.id] ? <span className="-mt-1 text-[11px] text-subtle">{formatNumber(counts[c.id])}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NearbyRail() {
  const { city, hydrated, locating, locate, setCity } = useNearbyCity();
  const [items, setItems] = useState<Listing[] | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!city) return setItems(null);
    let alive = true;
    setItems(null);
    searchCatalog({ data: { city, limit: 12, page: 1, sort: "date_desc" } })
      .then((r) => alive && setItems(r.listings))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [city]);

  if (!hydrated) return null;

  const picker = (
    <select
      aria-label="Şehrinizi seçin"
      value={city ?? ""}
      onChange={(e) => {
        setCity(e.target.value || null);
        setPicking(false);
      }}
      className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-sm sm:flex-none"
    >
      <option value="">Şehir seçin</option>
      {TURKEY_CITIES.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  );

  if (!city) {
    return (
      <section className="py-3">
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <LocateFixed className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Yakınınızdaki ilanlar</p>
            <p className="text-xs text-muted">{locating ? "Konumunuz alınıyor…" : "Konumunuzu kullanın veya şehrinizi seçin"}</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button size="sm" variant="outline" disabled={locating} onClick={() => void locate().then((err) => err && toast.error(err))}>
              <LocateFixed className="size-4" /> Konumumu kullan
            </Button>
            {picker}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <ListingRail
        title={`${city} civarında`}
        items={items}
        loading={items === null}
        seeAll={{ to: "/search", search: { city } }}
        action={
          picking ? (
            picker
          ) : (
            <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1 text-xs text-subtle hover:text-fg">
              <MapPin className="size-3.5" /> Şehri değiştir
            </button>
          )
        }
      />
      {items && items.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <MapPin className="size-4" /> {city} için henüz ilan yok.
          {picking ? (
            picker
          ) : (
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setPicking(true)}>
              Şehri değiştir
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

/** The signed-in user's recently viewed listings that are still on the air. */
function RecentRail() {
  const { user } = useCurrentUserState();
  const [items, setItems] = useState<Listing[] | null>(null);

  useEffect(() => {
    if (!user) return setItems(null);
    let alive = true;
    myRecentListings()
      .then((rows) => alive && setItems(rows.filter((r) => r.live).slice(0, 12)))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user || !items?.length) return null;
  return <ListingRail title="Son baktıklarınız" items={items} seeAll={{ to: "/son-bakilanlar" }} />;
}

function LatestFeed({ initial, pages }: { initial: Listing[]; pages: number }) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  async function more() {
    setBusy(true);
    try {
      const r = await searchCatalog({ data: { page: page + 1, limit: 24, sort: "date_desc" } });
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...r.listings.filter((x) => !seen.has(x.id))];
      });
      setPage(page + 1);
    } catch {
      toast.error("İlanlar yüklenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pb-10 pt-4">
      <h2 className="mb-2.5 text-[17px] font-semibold tracking-tight sm:text-lg">Yeni ilanlar</h2>
      {items.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-surface p-10 text-center">
          <Sparkles className="mx-auto size-7 text-subtle" />
          <p className="mt-2 font-medium">Henüz ilan yok</p>
          <p className="text-sm text-muted">İlk ilanı siz verin; ilan vermek ücretsiz.</p>
          <Link to="/ilan-ver" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            İlan ver
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((l, i) => (
              <ListingCard key={l.id} listing={l} priority={i < 2} />
            ))}
          </div>
          {busy ? <CardGridSkeleton count={4} className="mt-2.5 sm:mt-4 sm:grid-cols-3 lg:grid-cols-4" /> : null}
          {page < pages ? (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => void more()} disabled={busy}>
                {busy ? "Yükleniyor…" : "Daha fazla ilan göster"}
              </Button>
            </div>
          ) : (
            <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted">
              <Clock className="size-4" /> Hepsini gördünüz ·
              <Link to="/search" className="inline-flex items-center font-medium text-primary hover:underline">
                Aramaya git <ChevronRight className="size-4" />
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
