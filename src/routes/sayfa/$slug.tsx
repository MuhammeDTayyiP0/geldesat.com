import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getLegal } from "@/lib/server/catalog";
import { slugify } from "@/lib/utils";
import { NotFound } from "@/components/common/NotFound";

export const Route = createFileRoute("/sayfa/$slug")({
  loader: async ({ params }) => {
    const page = await getLegal({ data: { slug: params.slug } });
    if (!page) {
      throw notFound();
    }
    return page;
  },
  notFoundComponent: () => (
    <NotFound
      type="page"
      title="Kurumsal Sayfa Bulunamadı"
      message="Ulaşmaya çalıştığınız kurumsal bilgi veya yasal metin sayfası bulunamadı."
    />
  ),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const BASE = "https://www.geldesat.com";
    const pageUrl = `${BASE}/sayfa/${loaderData.slug}`;
    const title = `${loaderData.title} | GeldeSat`;
    const desc = loaderData.body
      ? loaderData.body.replace(/#+\s/g, "").replace(/\n/g, " ").slice(0, 160)
      : `${loaderData.title} — GeldeSat kurumsal sayfası.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index,follow" },
        { property: "og:site_name", content: "GeldeSat" },
        { property: "og:locale", content: "tr_TR" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:image", content: `${BASE}/og.jpg` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: `${BASE}/og.jpg` },
      ],
      links: [{ rel: "canonical", href: pageUrl }],
    };
  },
  component: LegalPage,
});

export const LEGAL_NAV = [
  { slug: "hakkimizda", label: "Hakkımızda" },
  { slug: "iletisim", label: "İletişim" },
  { slug: "kvkk", label: "KVKK aydınlatma" },
  { slug: "gizlilik", label: "Gizlilik politikası" },
  { slug: "cerez", label: "Çerez politikası" },
  { slug: "kullanim", label: "Kullanım koşulları" },
  { slug: "uyelik", label: "Üyelik sözleşmesi" },
] as const;

function parseLegal(body: string) {
  const parts = body.split(/^## /m);
  const intro = parts[0]?.trim() ?? "";
  const sections = parts.slice(1).map((block) => {
    const i = block.indexOf("\n");
    const title = (i === -1 ? block : block.slice(0, i)).trim();
    const content = (i === -1 ? "" : block.slice(i + 1)).trim();
    return { title, content, id: slugify(title) };
  });
  return { intro, sections };
}

function Blocks({ text }: { text: string }) {
  const chunks = text.split(/\n\n+/).filter(Boolean);
  return (
    <>
      {chunks.map((chunk, i) => {
        const lines = chunk.split("\n");
        if (lines.length > 0 && lines.every((l) => /^[-*]\s/.test(l))) {
          return (
            <ul key={i} className="my-3 list-disc space-y-1 pl-5">
              {lines.map((l) => (
                <li key={l}>{l.replace(/^[-*]\s/, "")}</li>
              ))}
            </ul>
          );
        }
        if (lines.length > 0 && lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="my-3 list-decimal space-y-1 pl-5">
              {lines.map((l) => (
                <li key={l}>{l.replace(/^\d+\.\s/, "")}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="my-3">
            {chunk}
          </p>
        );
      })}
    </>
  );
}

function LegalPage() {
  const page = Route.useLoaderData();
  const { slug } = Route.useParams();
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted">Bu sayfa bulunamadı.</p>
        <Link to="/" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Anasayfaya dön
        </Link>
      </div>
    );
  }
  const { intro, sections } = parseLegal(page.body);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-muted">
        <Link to="/" className="hover:text-fg">
          Anasayfa
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-fg">{page.title}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Kurumsal</p>
          <ul className="mt-3 flex flex-wrap gap-1 lg:flex-col lg:gap-0.5">
            {LEGAL_NAV.map((item) => (
              <li key={item.slug}>
                <Link
                  to="/sayfa/$slug"
                  params={{ slug: item.slug }}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    slug === item.slug ? "bg-elevated font-medium text-fg" : "text-muted hover:bg-elevated hover:text-fg"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <article className="order-1 rounded-lg border border-border bg-surface p-5 shadow-card md:p-10 lg:order-2">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Yasal belge</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{page.title}</h1>
          <p className="mt-2 text-sm text-muted">Son güncelleme: 16 Eylül 2026 · GeldeSat · Adana</p>
          {intro ? (
            <div className="mt-6 text-sm leading-relaxed text-fg">
              <Blocks text={intro} />
            </div>
          ) : null}
          {sections.length > 1 ? (
            <nav className="mt-6 rounded-md bg-elevated p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">İçindekiler</p>
              <ol className="mt-2 space-y-1 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-primary hover:underline">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="mt-2 text-sm leading-relaxed text-fg">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-border py-6 first:border-t-0">
                <h2 className="text-lg font-semibold tracking-tight">{s.title}</h2>
                <Blocks text={s.content} />
              </section>
            ))}
          </div>
          <p className="mt-6 border-t border-border pt-4 text-xs text-subtle">
            Bu metin genel bilgilendirme amaçlıdır. Uyuşmazlıklarda Türk hukuku ve Adana mahkemeleri yetkilidir. Başvuru:{" "}
            <Link to="/sayfa/$slug" params={{ slug: "iletisim" }} className="text-primary hover:underline">
              iletişim
            </Link>
            .
          </p>
        </article>
      </div>
    </div>
  );
}
