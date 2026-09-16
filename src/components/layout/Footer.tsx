import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSiteSettings } from "@/lib/server/catalog";

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

export function Footer() {
  const [email, setEmail] = useState("destek@geldesat.com");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("GeldeSat");
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
    <footer className="mt-auto border-t border-border bg-ink text-primary-fg">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        {cols.map((col) => (
          <div key={col.title}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">{col.title}</p>
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">İletişim</p>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">G</span>
            <span className="text-sm font-medium">{company}</span>
          </div>
          <p className="text-sm text-primary-fg/80">{email}</p>
          {phone ? <p className="text-sm text-primary-fg/80">{phone}</p> : null}
          <p className="text-sm text-primary-fg/80">Adana, Türkiye</p>
        </div>
      </div>
      <div className="border-t border-primary-fg/10 px-4 py-4 text-center text-xs text-subtle">
        © {new Date().getFullYear()} {company}. İlanlar kullanıcılar tarafından yayınlanır. GeldeSat alım satımın tarafı değildir.
      </div>
    </footer>
  );
}