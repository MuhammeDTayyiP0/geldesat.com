import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Fuel,
  Gauge,
  Home,
  Layers,
  MapPin,
  Ruler,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate, formatPrice } from "@/lib/utils";

/** Card shell shared by every section of the listing page. */
export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type Crumb = { id: string; slug: string; name: string };

export function Breadcrumbs({ path, title }: { path: Crumb[]; title: string }) {
  return (
    <nav aria-label="Konum" className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ol className="flex min-w-max items-center gap-1 text-xs text-muted">
        <li>
          <Link to="/" className="hover:text-fg hover:underline">
            Anasayfa
          </Link>
        </li>
        {path.map((p) => (
          <li key={p.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-subtle" aria-hidden="true" />
            <Link to="/category/$slug" params={{ slug: p.slug }} className="hover:text-fg hover:underline">
              {p.name}
            </Link>
          </li>
        ))}
        <li className="hidden items-center gap-1 sm:flex" aria-current="page">
          <ChevronRight className="size-3.5 text-subtle" aria-hidden="true" />
          <span className="max-w-xs truncate font-medium text-fg">{title}</span>
        </li>
      </ol>
    </nav>
  );
}

export function StatusBanner({
  status,
  expired,
  isOwner,
  onRenew,
  busy,
}: {
  status: string;
  expired: boolean;
  isOwner: boolean;
  onRenew: () => void;
  busy: boolean;
}) {
  let title: string | null = null;
  let body: ReactNode = null;
  if (status === "PENDING") {
    title = "Bu ilan onay bekliyor.";
    body = "Kontrol edildikten sonra yayına alınacak ve alıcılara görünecek.";
  } else if (status === "REJECTED") {
    title = "Bu ilan yayına uygun bulunmadı.";
    body = (
      <>
        Gerekçeyi{" "}
        <Link to="/bildirimler" className="font-semibold underline">
          bildirimlerinizde
        </Link>{" "}
        görebilirsiniz. İlanı düzenleyip tekrar onaya gönderebilirsiniz.
      </>
    );
  } else if (status === "SOLD") {
    title = "Bu ürün satıldı.";
    body = isOwner ? "İlan alıcılara “Satıldı” olarak görünür; mesaj alınmaz." : "Benzer ilanlara aşağıdan göz atabilirsiniz.";
  } else if (status === "INACTIVE") {
    title = "Bu ilan yayında değil.";
    body = isOwner ? "Yalnızca siz görüyorsunuz. Yönetim panelinden tekrar yayına alabilirsiniz." : null;
  } else if (expired) {
    title = "Bu ilanın yayın süresi doldu.";
    body = isOwner ? "Süreyi uzatarak ilanı tekrar yayına alabilirsiniz." : "Satıcıyla iletişim kapalıdır.";
  }
  if (!title) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-warn/30 bg-warn/8 p-4 text-sm text-warn sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{title}</p>
          {body ? <p className="mt-0.5 text-warn/85">{body}</p> : null}
        </div>
      </div>
      {isOwner && expired && status === "ACTIVE" ? (
        <Button size="sm" onClick={onRenew} disabled={busy} className="shrink-0">
          30 gün uzat
        </Button>
      ) : null}
    </div>
  );
}

const FACTS: Array<{ keys: string[]; label: string; icon: typeof Calendar; unit?: string }> = [
  { keys: ["Yıl"], label: "Yıl", icon: Calendar },
  { keys: ["KM", "Kilometre"], label: "Kilometre", icon: Gauge, unit: "km" },
  { keys: ["Yakıt", "Yakıt Tipi"], label: "Yakıt", icon: Fuel },
  { keys: ["Vites", "Vites Tipi"], label: "Vites", icon: Settings2 },
  { keys: ["m² (Net)", "m²", "m² (Brüt)"], label: "Alan", icon: Ruler, unit: "m²" },
  { keys: ["Oda Sayısı"], label: "Oda", icon: Home },
  { keys: ["Bulunduğu Kat", "Kat"], label: "Kat", icon: Layers },
];

/** The handful of attributes buyers scan first (year, km, m², rooms…), as tiles. */
export function KeyFacts({ attrs }: { attrs: Record<string, string | number> }) {
  const facts = FACTS.flatMap((f) => {
    const key = f.keys.find((k) => attrs[k] !== undefined && attrs[k] !== "");
    if (!key) return [];
    const raw = attrs[key];
    const value = typeof raw === "number" || /^\d+$/.test(String(raw)) ? Number(raw).toLocaleString("tr-TR") : String(raw);
    return [{ ...f, value: f.unit && !value.includes(f.unit) ? `${value} ${f.unit}` : value }];
  }).slice(0, 4);
  if (facts.length < 2) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {facts.map(({ label, icon: Icon, value }) => (
        <li key={label} className="rounded-xl border border-border bg-surface p-3 shadow-xs">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Icon className="size-3.5" aria-hidden="true" /> {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold sm:text-base">{value}</p>
        </li>
      ))}
    </ul>
  );
}

function AttrValue({ value }: { value: string }) {
  if (value === "true" || value === "Evet") {
    return <span className="rounded-full bg-ok/10 px-2 py-0.5 text-xs font-semibold text-ok">Evet</span>;
  }
  if (value === "false" || value === "Hayır") {
    return <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">Hayır</span>;
  }
  return <>{value}</>;
}

/** All category attributes; multi-select values become chips on a full-width row. */
export function SpecsSection({ attrs }: { attrs: Record<string, string | number> }) {
  const entries = Object.entries(attrs).filter(([, v]) => v !== "" && v != null);
  if (!entries.length) return null;
  const single = entries.filter(([, v]) => !String(v).includes(", "));
  const multi = entries.filter(([, v]) => String(v).includes(", "));
  return (
    <Section title="Özellikler">
      {single.length ? (
        <dl className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-2">
          {single.map(([k, v], i) => (
            <div
              key={k}
              className={cn(
                "flex items-center justify-between gap-4 border-border px-3 py-2.5 text-sm",
                i > 0 && "border-t",
                i === 1 && "sm:border-t-0",
                i % 2 === 1 && "sm:border-l",
              )}
            >
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium">
                <AttrValue value={String(v)} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {multi.map(([k, v]) => (
        <div key={k} className="mt-4">
          <h3 className="mb-2 text-sm font-medium">{k}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {String(v)
              .split(", ")
              .filter(Boolean)
              .map((item) => (
                <li key={item} className="rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-xs">
                  {item}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}

const DESC_COLLAPSE = 600;

export function DescriptionSection({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > DESC_COLLAPSE;
  return (
    <Section title="Açıklama">
      <div className={cn("relative", long && !open && "max-h-64 overflow-hidden")}>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/90 sm:text-[15px]">
          {text || "Satıcı açıklama eklemedi."}
        </p>
        {long && !open ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent" />
        ) : null}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          {open ? "Daha az göster" : "Devamını oku"}
        </button>
      ) : null}
    </Section>
  );
}

/** Price changes, newest first, each with its difference from the previous price. */
export function PriceHistorySection({ history }: { history: Array<{ price: number; at: string }> }) {
  if (history.length < 2) return null;
  const first = history[0].price;
  const last = history[history.length - 1].price;
  const total = last - first;
  const rows = history.map((h, i) => ({ ...h, diff: i === 0 ? 0 : h.price - history[i - 1].price })).reverse();
  return (
    <Section
      title="Fiyat geçmişi"
      action={
        total !== 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              total < 0 ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn",
            )}
          >
            {total < 0 ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />}
            {total < 0 ? "" : "+"}
            {formatPrice(total)}
          </span>
        ) : null
      }
    >
      <ol className="space-y-1.5">
        {rows.map((h, i) => (
          <li
            key={`${h.at}-${i}`}
            className={cn("flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm", i === 0 ? "bg-primary/6" : "bg-elevated/60")}
          >
            <span className="text-muted">{formatDate(h.at)}</span>
            <span className="flex items-center gap-2">
              {h.diff ? (
                <span className={cn("text-xs font-medium", h.diff < 0 ? "text-ok" : "text-warn")}>
                  {h.diff < 0 ? "↓" : "↑"} {formatPrice(Math.abs(h.diff))}
                </span>
              ) : null}
              <span className={cn("tabular-nums", i === 0 && "font-semibold")}>{formatPrice(h.price)}</span>
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * Only the district/city is known, so this links out to map search instead of
 * pinning a marker that would pretend to be the exact address.
 */
export function LocationSection({ city, district, neighborhood }: { city: string | null; district: string | null; neighborhood: string | null }) {
  if (!city) return null;
  const text = [neighborhood, district, city].filter(Boolean).join(", ");
  const query = encodeURIComponent(text);
  return (
    <Section title="Konum">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="font-medium">{text}</span>
            <span className="mt-0.5 block text-xs text-muted">Açık adres satıcı tarafından paylaşılmaz.</span>
          </span>
        </p>
        <div className="flex gap-2">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${query}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-elevated"
          >
            Google Haritalar <ExternalLink className="size-3" />
          </a>
          <a
            href={`https://yandex.com.tr/harita/?text=${query}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-elevated"
          >
            Yandex <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </Section>
  );
}

export type SellerInfo = {
  id: string;
  name: string;
  since: string;
  avatar: string | null;
  listing_count: number;
  rating_avg: number;
  rating_count: number;
};

export function SellerCard({
  seller,
  store,
  onReview,
}: {
  seller: SellerInfo;
  store: { name: string; slug: string } | null;
  onReview?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">{store ? "Mağaza" : "Satıcı"}</p>
      <Link to="/satici/$id" params={{ id: seller.id }} className="group flex items-center gap-3">
        {seller.avatar ? (
          <img src={seller.avatar} alt="" className="size-12 rounded-full border border-border object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-base font-bold text-primary" aria-hidden="true">
            {seller.name.slice(0, 1).toLocaleUpperCase("tr")}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold group-hover:text-primary">{store?.name ?? seller.name}</span>
          {store ? (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Store className="size-3.5" aria-hidden="true" /> Kurumsal mağaza · {seller.name}
            </span>
          ) : null}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {seller.rating_count > 0 ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-fg">
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                {seller.rating_avg.toFixed(1)}
                <span className="font-normal text-muted">({seller.rating_count})</span>
              </span>
            ) : (
              <span>Henüz puan yok</span>
            )}
            <span>·</span>
            <span>{seller.listing_count} aktif ilan</span>
          </span>
        </span>
        <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
      <p className="mt-3 text-xs text-muted">Üyelik: {formatDate(seller.since)}</p>
      {onReview ? (
        <button type="button" onClick={onReview} className="mt-3 text-sm font-medium text-primary hover:underline">
          Satıcıyı değerlendir
        </button>
      ) : null}
    </div>
  );
}

export function SafetyNote() {
  return (
    <div className="rounded-2xl border border-border bg-elevated/40 p-4 text-xs leading-relaxed text-muted">
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-fg">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Güvenli alışveriş
      </p>
      Ürünü görmeden kapora veya ön ödeme göndermeyin. Buluşmaları kalabalık ve güvenli yerlerde yapın.
    </div>
  );
}
