import { getRouteApi, Link } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getSiteSettings } from "@/lib/server/catalog";
import { LogoMark } from "@/components/brand/LogoMark";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";
import type { RootLoaderData } from "@/lib/use-flag";

const root = getRouteApi("__root__");

const cols = [
  {
    title: "Keşfet",
    links: [
      { to: "/search", label: "Tüm ilanlar" },
      { to: "/harita", label: "Harita" },
      { to: "/ilan-ver", label: "Ücretsiz ilan ver" },
    ],
  },
  {
    title: "Kurumsal",
    links: [
      { to: "/sayfa/$slug", params: { slug: "hakkimizda" }, label: "Hakkımızda" },
      { to: "/sayfa/$slug", params: { slug: "iletisim" }, label: "İletişim" },
    ],
  },
  {
    title: "Yasal",
    links: [
      { to: "/sayfa/$slug", params: { slug: "kvkk" }, label: "KVKK aydınlatma" },
      { to: "/sayfa/$slug", params: { slug: "gizlilik" }, label: "Gizlilik politikası" },
      { to: "/sayfa/$slug", params: { slug: "cerez" }, label: "Çerez politikası" },
      { to: "/sayfa/$slug", params: { slug: "kullanim" }, label: "Kullanım koşulları" },
      { to: "/sayfa/$slug", params: { slug: "uyelik" }, label: "Üyelik sözleşmesi" },
    ],
  },
] as const;

const THEME_OPTIONS: Array<{ value: ThemePref; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Açık tema", icon: Sun },
  { value: "system", label: "Sistem teması", icon: Monitor },
  { value: "dark", label: "Koyu tema", icon: Moon },
];

export function Footer() {
  const [email, setEmail] = useState("destek@geldesat.com");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("GeldeSat");
  const theme = useThemePref((root.useLoaderData() as RootLoaderData | undefined)?.theme ?? "system");
  useEffect(() => {
    void getSiteSettings()
      .then((s) => {
        if (s.support_email) setEmail(s.support_email);
        if (s.support_phone) setPhone(s.support_phone);
        if (s.company_name) setCompany(s.company_name);
      })
      .catch(() => undefined);
  }, []);
  return (
    <footer className="mt-auto border-t border-border bg-ink text-white mobile-content-space">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        {cols.map((col) => (
          <div key={col.title}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-fg/65">{col.title}</p>
            <ul className="space-y-2 text-sm text-primary-fg/80">
              {col.links.map((l) => (
                <li key={l.label}>
                  {"params" in l ? (
                    <Link to={l.to} params={l.params} className="hover:text-primary-fg">
                      {l.label}
                    </Link>
                  ) : (
                    <Link to={l.to} className="hover:text-primary-fg">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-fg/65">İletişim</p>
          <div className="mb-3 flex items-center gap-2">
            <LogoMark className="size-8 text-primary-fg" />
            <span className="text-sm font-medium">{company}</span>
          </div>
          <a href={`mailto:${email}`} className="block text-sm text-primary-fg/80 hover:text-white">{email}</a>
          {phone ? <p className="text-sm text-primary-fg/80">{phone}</p> : null}
          <p className="text-sm text-primary-fg/80">Adana, Türkiye</p>
        </div>
      </div>
      <div className="border-t border-primary-fg/10 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-primary-fg/65 sm:flex-row">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} {company}. İlanlar kullanıcılar tarafından yayınlanır. GeldeSat alım satımın tarafı değildir.
          </p>
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-primary-fg/15 bg-white/5 p-0.5" role="group" aria-label="Tema seçimi">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setThemePref(opt.value)}
                  aria-label={opt.label}
                  aria-pressed={active}
                  title={opt.label}
                  className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${
                    active ? "bg-white/20 text-white" : "text-primary-fg/65 hover:text-white"
                  }`}
                >
                  <Icon className="size-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}