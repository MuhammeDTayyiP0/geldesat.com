import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, HelpCircle, LogOut, Settings, Shield } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { ACCOUNT_ITEMS, SETTINGS_ITEMS, useAccountMeta, type AccountNavItem } from "./account-nav";

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

/** "Ayarlar" opens the settings page; while one of its pages is shown, its sub-pages are listed below. */
function SettingsGroup({ pathname }: { pathname: string }) {
  const inside = pathname === "/ayarlar" || pathname.startsWith("/ayarlar/");
  return (
    <div>
      <Link
        to="/ayarlar"
        aria-current={pathname === "/ayarlar" ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-elevated",
          inside ? "font-semibold text-primary" : "text-fg",
        )}
      >
        <Settings className={cn("size-4.5 shrink-0", inside ? "text-primary" : "text-muted")} />
        <span className="flex-1">Ayarlar</span>
      </Link>
      {inside ? (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {SETTINGS_ITEMS.map((item) => (
            <NavRow key={item.to} item={item} active={pathname === item.to} count={0} />
          ))}
        </div>
      ) : null}
    </div>
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
      <div className="space-y-0.5">
        {ACCOUNT_ITEMS.map((item) => (
          <NavRow key={item.to} item={item} active={pathname === item.to} count={item.badge ? counts[item.badge] : 0} />
        ))}
        <SettingsGroup pathname={pathname} />
      </div>
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Settings sub-pages go back to the settings list; everything else to the account hub.
  const backTo = pathname.startsWith("/ayarlar/") ? "/ayarlar" : "/profil";
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
                <Link
                  to={backTo}
                  aria-label={backTo === "/ayarlar" ? "Ayarlara dön" : "Hesabıma dön"}
                  className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full hover:bg-elevated md:hidden"
                >
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

/** Rows of one menu section, as a rounded list. */
export function MenuRows({ items, counts }: { items: AccountNavItem[]; counts?: Record<"messages" | "notifications", number> }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((item) => {
        const Icon = item.icon;
        const count = item.badge && counts ? counts[item.badge] : 0;
        return (
          <li key={item.to}>
            <Link to={item.to} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-elevated/60 active:bg-elevated">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </span>
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
  );
}

