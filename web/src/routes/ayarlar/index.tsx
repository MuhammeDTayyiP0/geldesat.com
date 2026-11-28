import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, HelpCircle, MessageSquarePlus, Monitor, Moon, Search, Shield, Sun, type LucideIcon } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { AccountShell, MenuRows, SignOutButton } from "@/components/account/AccountShell";
import { SETTINGS_SECTIONS, useAccountMeta } from "@/components/account/account-nav";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";
import type { RootLoaderData } from "@/lib/use-flag";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ayarlar/")({
  head: () => ({ meta: [{ title: "Ayarlar | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SettingsHome,
});

const root = getRouteApi("__root__");

const THEME_OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "Cihaz ayarı", icon: Monitor },
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
];

/** Settings list, grouped and searchable like a phone's settings app; each row opens its own page. */
function SettingsHome() {
  const { user, isPending } = useCurrentUserState();
  const { admin } = useAccountMeta();
  const pref = useThemePref((root.useLoaderData() as RootLoaderData | undefined)?.theme ?? "system");
  const [q, setQ] = useState("");

  if (isPending) return <BrandSpinner fullPage text="Yükleniyor…" />;
  if (!user) return <RedirectToSignIn />;

  const term = q.trim().toLocaleLowerCase("tr");
  const sections = SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: term
      ? section.items.filter((i) => `${i.label} ${i.hint ?? ""}`.toLocaleLowerCase("tr").includes(term))
      : section.items,
  })).filter((section) => section.items.length);
  const matches = (words: string) => !term || words.toLocaleLowerCase("tr").includes(term);
  const showTheme = matches("görünüm tema açık koyu karanlık cihaz ayarı mod");
  const showHelp = matches("yardım destek iletişim kullanım koşulları gizlilik yönetim paneli geri bildirim hata sorun öneri");
  const showSignOut = matches("çıkış yap oturum kapat");

  return (
    <AccountShell title="Ayarlar">
      <div className="mx-auto max-w-2xl space-y-6">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-elevated px-3">
          <Search className="size-4 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ayarlarda ara"
            aria-label="Ayarlarda ara"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
          />
        </label>

        {showTheme ? (
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted">Görünüm</h2>
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-2">
              {THEME_OPTIONS.map((o) => {
                const Icon = o.icon;
                const selected = pref === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setThemePref(o.value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      selected ? "bg-primary-solid text-primary-fg shadow-xs" : "text-muted hover:bg-elevated hover:text-fg",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted">{section.title}</h2>
            <MenuRows items={section.items} />
          </section>
        ))}
        {term && !sections.length && !showTheme && !showHelp && !showSignOut ? (
          <p className="py-6 text-center text-sm text-muted">“{q.trim()}” ile eşleşen ayar yok.</p>
        ) : null}

        {showHelp ? (
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted">Destek</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {admin ? (
                <li>
                  <Link to="/admin" className="flex min-h-13 items-center gap-3 px-4 font-medium text-warn hover:bg-elevated/60">
                    <Shield className="size-5" /> Yönetim paneli
                  </Link>
                </li>
              ) : null}
              <li>
                <Link to="/ayarlar/geri-bildirim" className="flex min-h-13 items-center gap-3 px-4 hover:bg-elevated/60">
                  <MessageSquarePlus className="size-5 text-muted" /> Geri bildirim / Sorun bildir
                </Link>
              </li>
              <li>
                <Link to="/sayfa/$slug" params={{ slug: "iletisim" }} className="flex min-h-13 items-center gap-3 px-4 hover:bg-elevated/60">
                  <HelpCircle className="size-5 text-muted" /> Yardım ve destek
                </Link>
              </li>
              <li>
                <Link to="/sayfa/$slug" params={{ slug: "kullanim" }} className="flex min-h-13 items-center gap-3 px-4 hover:bg-elevated/60">
                  <FileText className="size-5 text-muted" /> Kullanım koşulları ve gizlilik
                </Link>
              </li>
            </ul>
          </section>
        ) : null}

        {showSignOut ? (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <li>
              <SignOutButton className="flex min-h-13 w-full items-center gap-3 px-4 text-left font-medium text-danger hover:bg-danger-solid/8" />
            </li>
          </ul>
        ) : null}
      </div>
    </AccountShell>
  );
}
