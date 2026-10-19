import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, HelpCircle, Search, Shield } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { AccountShell, MenuRows, SignOutButton, UserAvatar } from "@/components/account/AccountShell";
import { SETTINGS_SECTIONS, useAccountMeta } from "@/components/account/account-nav";

export const Route = createFileRoute("/ayarlar/")({
  head: () => ({ meta: [{ title: "Ayarlar | GeldeSat" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SettingsHome,
});

/** Settings list, grouped and searchable like a phone's settings app; each row opens its own page. */
function SettingsHome() {
  const { user, isPending } = useCurrentUserState();
  const { admin } = useAccountMeta();
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
  const name = user.displayName || user.primaryEmail?.split("@")[0] || "Hesabım";

  return (
    <AccountShell title="Ayarlar">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/ayarlar/profil" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:bg-elevated/60">
          <UserAvatar src={user.profileImageUrl} name={name} className="size-12 text-lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{name}</span>
            <span className="block truncate text-sm text-muted">{user.primaryEmail}</span>
          </span>
          <span className="text-sm font-medium text-primary">Düzenle</span>
        </Link>

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

        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-subtle">{section.title}</h2>
            <MenuRows items={section.items} />
          </section>
        ))}
        {term && !sections.length ? <p className="py-6 text-center text-sm text-muted">“{q.trim()}” ile eşleşen ayar yok.</p> : null}

        {!term ? (
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-subtle">Destek</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {admin ? (
                <li>
                  <Link to="/admin" className="flex min-h-13 items-center gap-3 px-4 font-medium text-warn hover:bg-elevated/60">
                    <Shield className="size-5" /> Yönetim paneli
                  </Link>
                </li>
              ) : null}
              <li>
                <Link to="/sayfa/$slug" params={{ slug: "yardim" }} className="flex min-h-13 items-center gap-3 px-4 hover:bg-elevated/60">
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

        {!term ? (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <li>
              <SignOutButton className="flex min-h-13 w-full items-center gap-3 px-4 text-left font-medium text-danger hover:bg-danger/8" />
            </li>
          </ul>
        ) : null}
      </div>
    </AccountShell>
  );
}
