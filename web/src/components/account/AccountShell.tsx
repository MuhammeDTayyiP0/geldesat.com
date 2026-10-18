import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, HelpCircle, LogOut, Shield } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { ACCOUNT_SECTIONS, useAccountMeta, type AccountNavItem } from "./account-nav";

export function UserAvatar({ src, name, className }: { src: string | null | undefined; name: string; className?: string }) {
  return src ? (
    <img src={src} alt="" className={cn("shrink-0 rounded-full border border-border object-cover", className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary", className)}
    >
      {(name.trim() || "?").slice(0, 1).toLocaleUpperCase("tr")}
    </span>
  );
}

function NavRow({ item, active, count }: { item: AccountNavItem; active: boolean; count: number }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        active ? "bg-primary/10 font-semibold text-primary" : "text-fg hover:bg-elevated",
      )}
    >
      <Icon className={cn("size-4.5 shrink-0", active ? "text-primary" : "text-muted")} />
      <span className="flex-1 truncate">{item.label}</span>
      {count > 0 ? (
        <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-5 text-primary-fg">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

/** Desktop left menu. */
function AccountSidebar() {
  const { user } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { counts, admin } = useAccountMeta();
  const name = user?.displayName || user?.primaryEmail?.split("@")[0] || "Hesabım";
  return (
    <nav aria-label="Hesap menüsü" className="space-y-5">
      <Link to="/profil" className="flex items-center gap-3 rounded-xl p-2 hover:bg-elevated">
        <UserAvatar src={user?.profileImageUrl} name={name} className="size-11 text-base" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block truncate text-xs text-muted">{user?.primaryEmail}</span>
        </span>
      </Link>
      {ACCOUNT_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{section.title}</p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavRow key={item.to} item={item} active={pathname === item.to} count={item.badge ? counts[item.badge] : 0} />
            ))}
          </div>
        </div>
      ))}
      <div className="space-y-0.5 border-t border-border pt-4">
        {admin ? (
          <Link to="/admin" className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-warn hover:bg-elevated">
            <Shield className="size-4.5" /> Yönetim paneli
          </Link>
        ) : null}
        <Link to="/sayfa/$slug" params={{ slug: "yardim" }} className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-elevated">
          <HelpCircle className="size-4.5 text-muted" /> Yardım
        </Link>
        <SignOutButton className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-danger hover:bg-danger/8" />
      </div>
    </nav>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={() => {
        setBusy(true);
        void signOut("/").catch(() => setBusy(false));
      }}
    >
      <LogOut className="size-4.5" /> {busy ? "Çıkış yapılıyor…" : "Çıkış yap"}
    </button>
  );
}

/**
 * Frame for every account page: left menu on desktop; on phones a compact
 * header with a back link to the profile hub (which lists the same menu).
 */
export function AccountShell({
  title,
  description,
  actions,
  hub,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** The profile hub itself: no back link on phones. */
  hub?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-3 md:pb-12 md:pt-8">
      <div className="md:grid md:grid-cols-[232px_minmax(0,1fr)] md:gap-8 lg:gap-10">
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <AccountSidebar />
          </div>
        </aside>
        <main className="min-w-0">
          <header className={cn("mb-5 flex items-center justify-between gap-3", hub && "md:mb-6")}>
            <div className="flex min-w-0 items-center gap-1">
              {!hub ? (
                <Link to="/profil" aria-label="Hesabıma dön" className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full hover:bg-elevated md:hidden">
                  <ChevronLeft className="size-5" />
                </Link>
              ) : null}
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
                {description ? <p className="mt-0.5 hidden text-sm text-muted sm:block">{description}</p> : null}
              </div>
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Instagram-style settings list for phones (the desktop sidebar covers larger screens). */
export function AccountMenuList({ className }: { className?: string }) {
  const { counts, admin } = useAccountMeta();
  return (
    <div className={cn("space-y-5", className)}>
      {ACCOUNT_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-subtle">{section.title}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {section.items
              .filter((item) => item.to !== "/profil")
              .map((item) => {
                const Icon = item.icon;
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.to}>
                    <Link to={item.to} className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-elevated">
                      <Icon className="size-5 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium">{item.label}</span>
                        {item.hint ? <span className="block truncate text-xs text-muted">{item.hint}</span> : null}
                      </span>
                      {count > 0 ? (
                        <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-5 text-primary-fg">
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                      <ChevronRight className="size-4 text-subtle" />
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {admin ? (
          <li>
            <Link to="/admin" className="flex min-h-12 items-center gap-3 px-4 font-medium text-warn">
              <Shield className="size-5" /> Yönetim paneli
            </Link>
          </li>
        ) : null}
        <li>
          <Link to="/sayfa/$slug" params={{ slug: "yardim" }} className="flex min-h-12 items-center gap-3 px-4">
            <HelpCircle className="size-5 text-muted" /> Yardım ve destek
          </Link>
        </li>
        <li>
          <SignOutButton className="flex min-h-12 w-full items-center gap-3 px-4 text-left font-medium text-danger" />
        </li>
      </ul>
    </div>
  );
}
