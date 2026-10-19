import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Command as CommandIcon, Menu as MenuIcon, PanelLeftClose, Search, X } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { adminCounters } from "@/lib/server/admin/dashboard";
import { CategoryPickerDialog } from "./CategoryPickerDialog";
import { CommandPalette } from "./CommandPalette";
import { CategoryPickerProvider, SheetProvider, useSheets } from "./hooks";
import { ListingSheetBody } from "./ListingSheet";
import { UserSheetBody } from "./UserSheet";
import { ADMIN_NAV, ALL_NAV_ITEMS } from "./nav";
import { Avatar, ConfirmProvider, Kbd, Sheet } from "./ui";

/** Providers + chrome for every /admin screen. */
export function AdminShell({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ConfirmProvider>
        <CategoryPickerProvider render={(p) => <CategoryPickerDialog {...p} />}>
          <SheetProvider>
            <Chrome>{children}</Chrome>
            <SheetHost />
          </SheetProvider>
        </CategoryPickerProvider>
      </ConfirmProvider>
    </QueryClientProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname.replace(/\/+$/, "") || "/" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const counters = useQuery({
    queryKey: ["admin", "counters"],
    queryFn: () => adminCounters(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = ALL_NAV_ITEMS.find((i) => i.to === pathname) ?? ALL_NAV_ITEMS.find((i) => i.to !== "/admin" && pathname.startsWith(i.to));
  const badges = counters.data;

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {ADMIN_NAV.map((group) => (
        <div key={group.group}>
          {!collapsed ? <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">{group.group}</p> : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
              const count = item.badge && badges ? badges[item.badge] : 0;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                      active ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/6 hover:text-white",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon className={cn("size-[18px] shrink-0", active ? "text-white" : "text-white/50 group-hover:text-white/80")} />
                    {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                    {count ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                          item.badge === "reports" ? "bg-red-500 text-white" : item.badge === "orders" ? "bg-violet-500 text-white" : "bg-amber-400 text-ink",
                          collapsed && "absolute right-1 top-0.5",
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-white/8 px-4", collapsed && "justify-center px-0")}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-white">
        <LogoMark size={22} />
      </span>
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-bold text-white">GeldeSat</p>
          <p className="text-[11px] text-white/45">Yönetim konsolu</p>
        </div>
      ) : null}
    </div>
  );

  const footer = (
    <div className={cn("border-t border-white/8 p-3", collapsed && "px-2")}>
      <div className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5", collapsed && "justify-center px-0")}>
        <Avatar name={user?.displayName} src={user?.profileImageUrl} size={30} className="border-white/20" />
        {!collapsed ? (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold text-white">{user?.displayName ?? "Yönetici"}</p>
            <p className="truncate text-[11px] text-white/45">{user?.primaryEmail ?? ""}</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-bg text-fg">
      {/* Desktop sidebar */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col bg-[#0f1524] transition-[width] duration-200 lg:flex", collapsed ? "w-[68px]" : "w-64")}>
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Menüyü kapat" className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#0f1524] shadow-2xl">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Kapat">
              <X className="size-5" />
            </button>
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-fg lg:hidden" aria-label="Menüyü aç">
            <MenuIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden rounded-lg p-2 text-muted hover:bg-elevated hover:text-fg lg:block"
            aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
          >
            <PanelLeftClose className={cn("size-5 transition-transform", collapsed && "rotate-180")} />
          </button>
          <div className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
            <span className="text-muted">Yönetim</span>
            <span className="text-subtle">/</span>
            <span className="truncate font-semibold">{current?.label ?? "Kontrol paneli"}</span>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm text-subtle transition-colors hover:border-primary/40 md:ml-6"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left">İlan, üye, kategori ara…</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              <Kbd>
                <CommandIcon className="size-2.5" />
              </Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <a href="/" className="hidden shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-muted hover:bg-elevated hover:text-fg md:inline-flex">
            Siteye git <ArrowUpRight className="size-4" />
          </a>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6 xl:px-8">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function SheetHost() {
  const { stack, close } = useSheets();
  const top = stack[stack.length - 1];
  return (
    <Sheet open={Boolean(top)} onOpenChange={(o) => !o && close()} title={top?.type === "user" ? "Üye ayrıntıları" : "İlan ayrıntıları"}>
      {top ? (
        top.type === "listing" ? (
          <ListingSheetBody key={`l:${top.id}`} id={top.id} canGoBack={stack.length > 1} />
        ) : (
          <UserSheetBody key={`u:${top.id}`} id={top.id} canGoBack={stack.length > 1} />
        )
      ) : null}
    </Sheet>
  );
}
