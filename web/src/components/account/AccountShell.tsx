import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, HelpCircle, LogOut, Settings, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

/** "Ayarlar" heading that expands to its sub-pages; always open while one of them is shown. */
function SettingsGroup({ items, pathname }: { items: AccountNavItem[]; pathname: string }) {
  const inside = pathname.startsWith("/ayarlar");
  const [open, setOpen] = useState(inside);
  const expanded = open || inside;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-elevated",
          inside ? "font-semibold text-primary" : "text-fg",
        )}
      >
        <Settings className={cn("size-4.5 shrink-0", inside ? "text-primary" : "text-muted")} />
        <span className="flex-1 text-left">Ayarlar</span>
        <ChevronDown className={cn("size-4 text-subtle transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {items.map((item) => (
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
      {ACCOUNT_SECTIONS.map((section) =>
        section.title === "Ayarlar" ? (
          <SettingsGroup key={section.title} items={section.items} pathname={pathname} />
        ) : (
          <div key={section.title}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{section.title}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavRow key={item.to} item={item} active={pathname === item.to} count={item.badge ? counts[item.badge] : 0} />
              ))}
            </div>
          </div>
        ),
      )}
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

/** Rows of one menu section, as a rounded list. */
function MenuRows({ items, counts, onNavigate }: { items: AccountNavItem[]; counts: Record<"messages" | "notifications", number>; onNavigate: () => void }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((item) => {
        const Icon = item.icon;
        const count = item.badge ? counts[item.badge] : 0;
        return (
          <li key={item.to}>
            <Link to={item.to} onClick={onNavigate} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-elevated/60 active:bg-elevated">
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
  );
}

/**
 * "Ayarlar" button for the profile page (like Instagram's menu): opens a sheet
 * with the settings sub-pages, then account activity, help and sign-out.
 */
export function AccountSettingsMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { counts, admin } = useAccountMeta();
  const close = () => setOpen(false);
  const settings = ACCOUNT_SECTIONS.find((s) => s.title === "Ayarlar")?.items ?? [];
  const activity = (ACCOUNT_SECTIONS.find((s) => s.title === "Hesabım")?.items ?? []).filter((i) => i.to !== "/profil");
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Settings className="size-4" /> Ayarlar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "max-h-[85dvh] gap-0 overflow-y-auto border-border bg-bg p-0",
            // Bottom sheet on phones, centred panel from sm up.
            "top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl",
            "sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl",
          )}
        >
          <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between border-b border-border bg-surface px-5 py-3 text-left">
            <DialogTitle>Ayarlar</DialogTitle>
            <DialogDescription className="sr-only">Hesap ayarları ve kısayollar</DialogDescription>
            <button type="button" onClick={close} aria-label="Kapat" className="-mr-2 grid size-9 place-items-center rounded-full hover:bg-elevated">
              <X className="size-5" />
            </button>
          </DialogHeader>
          <div className="space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <MenuRows items={settings} counts={counts} onNavigate={close} />
            <section>
              <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-subtle">Hesap hareketleri</h3>
              <MenuRows items={activity} counts={counts} onNavigate={close} />
            </section>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {admin ? (
                <li>
                  <Link to="/admin" onClick={close} className="flex min-h-12 items-center gap-3 px-4 font-medium text-warn">
                    <Shield className="size-5" /> Yönetim paneli
                  </Link>
                </li>
              ) : null}
              <li>
                <Link to="/sayfa/$slug" params={{ slug: "yardim" }} onClick={close} className="flex min-h-12 items-center gap-3 px-4">
                  <HelpCircle className="size-5 text-muted" /> Yardım ve destek
                </Link>
              </li>
              <li>
                <SignOutButton className="flex min-h-12 w-full items-center gap-3 px-4 text-left font-medium text-danger" />
              </li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
