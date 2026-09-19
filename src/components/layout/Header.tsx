import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  Heart,
  LayoutGrid,
  LogOut,
  Map,
  MessageCircle,
  Plus,
  Search,
  Shield,
  User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { unreadCount } from "@/lib/server/social";
import { getMe } from "@/lib/server/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";

function Wordmark({ onClick }: { onClick?: () => void } = {}) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2 text-ink">
      <LogoMark className="size-8" />
      <span className="text-lg font-semibold tracking-tight">GeldeSat</span>
    </Link>
  );
}

function AccountMenu({ admin }: { admin: boolean }) {
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = user?.displayName ?? user?.primaryEmail ?? "Hesap";
  const canSignOut = authEnabled && !hasGateSessionMarker();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const item = "flex min-h-11 items-center gap-2 px-3 text-sm hover:bg-elevated";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
        aria-label="Hesap menüsü"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {user?.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-elevated text-xs font-semibold">
            {label.slice(0, 1).toLocaleUpperCase("tr")}
          </span>
        )}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lift">
          <p className="truncate px-3 py-2 text-xs text-muted">{label}</p>
          <Link to="/ilanlarim" className={item} onClick={() => setOpen(false)}>
            <LayoutGrid className="size-4 text-muted" /> İlanlarım
          </Link>
          <Link to="/profil" className={item} onClick={() => setOpen(false)}>
            <User className="size-4 text-muted" /> Hesabım
          </Link>
          {admin ? (
            <Link to="/admin" className={item} onClick={() => setOpen(false)}>
              <Shield className="size-4 text-muted" /> Yönetim
            </Link>
          ) : null}
          {canSignOut ? (
            <button
              type="button"
              disabled={signingOut}
              className={`${item} w-full text-left`}
              onClick={() => {
                setSigningOut(true);
                void signOut().catch(() => setSigningOut(false));
              }}
            >
              <LogOut className="size-4 text-muted" /> {signingOut ? "Çıkılıyor…" : "Çıkış"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UnreadDot({ n, tone = "danger" }: { n: number; tone?: "danger" | "primary" }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "absolute right-1.5 top-1.5 min-w-4 rounded-full px-1 text-center text-xs font-medium text-primary-fg tabular-nums",
        tone === "primary" ? "bg-primary" : "bg-danger",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

type MenuTo =
  | "/search"
  | "/harita"
  | "/ilanlarim"
  | "/favoriler"
  | "/mesajlar"
  | "/bildirimler"
  | "/profil"
  | "/admin"
  | "/login";

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <span className="nav-burger" data-open={open ? "true" : "false"} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function MenuRow({
  to,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  to: MenuTo;
  icon: typeof Search;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex min-h-12 items-center gap-3 rounded-xl px-2 pr-3 text-sm font-medium text-fg transition-colors duration-150 hover:bg-elevated active:scale-[0.96]"
    >
      <span className="grid size-10 place-items-center rounded-lg bg-elevated text-primary">
        <Icon className="size-5" />
      </span>
      <span className="flex-1">{label}</span>
      {badge && badge > 0 ? (
        <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-xs font-medium text-primary-fg tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : (
        <ChevronRight className="size-4 text-subtle" />
      )}
    </Link>
  );
}

function NavChip({
  to,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  to: MenuTo;
  icon: typeof Search;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="relative flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl bg-elevated px-1 text-center transition-colors duration-150 hover:bg-border/60 active:scale-[0.96]"
    >
      <span className="relative grid size-9 place-items-center rounded-lg bg-surface text-primary shadow-card">
        <Icon className="size-5" />
        {badge && badge > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-xs font-medium leading-4 text-primary-fg tabular-nums">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-xs font-medium text-fg">{label}</span>
    </Link>
  );
}

function MobileDrawer({
  open,
  onClose,
  q,
  setQ,
  onSearch,
  admin,
  msgUnread,
  noteUnread,
}: {
  open: boolean;
  onClose: () => void;
  q: string;
  setQ: (v: string) => void;
  onSearch: (e: React.FormEvent) => void;
  admin: boolean;
  msgUnread: number;
  noteUnread: number;
}) {
  const { user } = useCurrentUserState();
  const [signingOut, setSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const canSignOut = authEnabled && !hasGateSessionMarker();
  const label = user?.displayName ?? user?.primaryEmail ?? "Hesap";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (open) root.classList.add("mobile-nav-lock");
    else root.classList.remove("mobile-nav-lock");
    return () => root.classList.remove("mobile-nav-lock");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    panel?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="mobile-nav-root"
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
    >
      <div className="mobile-nav-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
        tabIndex={-1}
        className="mobile-nav-panel"
        inert={!open}
      >
        <div className="mobile-nav-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <form onSubmit={onSearch} className="pb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ne arıyorsunuz?"
                className="h-12 rounded-xl bg-elevated pl-9"
                aria-label="Ara"
              />
            </div>
          </form>

          {user ? (
            <Link
              to="/profil"
              onClick={onClose}
              className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-bg p-3"
            >
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                <span className="grid size-11 place-items-center rounded-full bg-elevated text-sm font-semibold">
                  {label.slice(0, 1).toLocaleUpperCase("tr")}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">Hesabı görüntüle</span>
              </span>
              <ChevronRight className="size-4 text-subtle" />
            </Link>
          ) : null}

          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Keşfet</p>
          <div className={cn("mb-4 grid gap-2", user ? "grid-cols-4" : "grid-cols-2")}>
            <NavChip to="/search" icon={Search} label="İlanlar" onClick={onClose} />
            <NavChip to="/harita" icon={Map} label="Harita" onClick={onClose} />
            <SignedIn>
              <NavChip to="/favoriler" icon={Heart} label="Favoriler" onClick={onClose} />
              <NavChip to="/mesajlar" icon={MessageCircle} label="Mesajlar" badge={msgUnread} onClick={onClose} />
            </SignedIn>
          </div>

          <SignedOut>
            <p className="px-1 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-subtle">Hesap</p>
            <nav className="flex flex-col">
              <MenuRow to="/login" icon={User} label="Giriş yap" onClick={onClose} />
            </nav>
            <p className="px-3 pt-1 text-xs text-muted">İlan vermek ve mesajlaşmak için giriş yapın.</p>
          </SignedOut>
          <SignedIn>
            <p className="px-1 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-subtle">Hesap</p>
            <nav className="flex flex-col">
              <MenuRow to="/ilanlarim" icon={LayoutGrid} label="İlanlarım" onClick={onClose} />
              <MenuRow to="/bildirimler" icon={Bell} label="Bildirimler" badge={noteUnread} onClick={onClose} />
              <MenuRow to="/profil" icon={User} label="Profil" onClick={onClose} />
              {admin ? <MenuRow to="/admin" icon={Shield} label="Yönetim" onClick={onClose} /> : null}
            </nav>
            {canSignOut ? (
              <button
                type="button"
                disabled={signingOut}
                className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-sm font-medium text-muted hover:bg-elevated"
                onClick={() => {
                  setSigningOut(true);
                  void signOut().catch(() => setSigningOut(false));
                }}
              >
                <span className="grid size-10 place-items-center rounded-lg bg-elevated">
                  <LogOut className="size-5" />
                </span>
                {signingOut ? "Çıkılıyor…" : "Çıkış"}
              </button>
            ) : null}
          </SignedIn>
        </div>

        <div className="drawer-safe shrink-0 border-t border-border bg-surface px-4 pt-3">
          <Link to="/ilan-ver" onClick={onClose} className="block">
            <Button className="h-12 w-full rounded-xl">
              <Plus className="size-4" /> Ücretsiz ilan ver
            </Button>
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Header({ className }: { className?: string } = {}) {
  const nav = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [noteUnread, setNoteUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [admin, setAdmin] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  // Close mobile menu on any navigation / route change
  useEffect(() => {
    setOpen(false);
  }, [pathname, searchStr]);

  useEffect(() => {
    if (!user) return;
    function load() {
      unreadCount()
        .then((c) => {
          setNoteUnread(c.notifications);
          setMsgUnread(c.messages);
        })
        .catch(() => undefined);
    }
    load();
    getMe()
      .then((m) => setAdmin(m.profile?.role === "ADMIN"))
      .catch(() => undefined);

    let es: EventSource | null = null;
    let stop = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connectSSE() {
      if (stop) return;
      try {
        es = new EventSource("/api/chat/stream");
        es.onmessage = (e) => {
          if (stop) return;
          try {
            const data = JSON.parse(e.data);
            if (data.type === "new_message") {
              setMsgUnread((prev) => prev + 1);
              window.dispatchEvent(new CustomEvent("geldesat:inbox", { detail: data }));
            } else if (data.type === "read_update" || data.type === "inbox_ping") {
              load();
              window.dispatchEvent(new CustomEvent("geldesat:inbox", { detail: data }));
            }
          } catch {
            // keepalive or non-JSON
          }
        };
        es.onerror = () => {
          es?.close();
          if (!stop) {
            retryTimer = setTimeout(connectSSE, 5000);
          }
        };
      } catch {
        // SSE fallback
      }
    }

    connectSSE();

    window.addEventListener("geldesat:inbox", load);
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20000);
    return () => {
      stop = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      window.removeEventListener("geldesat:inbox", load);
      window.clearInterval(tick);
    };
  }, [user]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => menuBtnRef.current?.focus());
  }, []);

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    void nav({ to: "/search", search: { q } });
    closeMenu();
  }

  return (
    <header className={cn("site-header sticky top-0 border-b border-border bg-surface/90 backdrop-blur-md", className)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Wordmark onClick={closeMenu} />
        <form onSubmit={goSearch} className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kelime, ilan no veya mağaza"
            className="rounded-lg pl-9"
            aria-label="Ara"
          />
        </form>
        <nav className="ml-auto hidden items-center gap-0.5 md:flex">
          {isPending ? <div className="h-8 w-24 animate-pulse rounded-md bg-elevated" /> : null}
          <SignedOut>
            <Link to="/login" className="grid h-11 place-items-center px-3 text-sm font-medium text-muted hover:text-fg">
              Giriş
            </Link>
          </SignedOut>
          <SignedIn>
            <Link to="/bildirimler" className="relative grid size-11 place-items-center rounded-lg hover:bg-elevated" aria-label="Bildirimler">
              <Bell className="size-5" />
              <UnreadDot n={noteUnread} />
            </Link>
            <Link to="/favoriler" className="grid size-11 place-items-center rounded-lg hover:bg-elevated" aria-label="Favoriler">
              <Heart className="size-5" />
            </Link>
            <Link
              to="/mesajlar"
              className="relative grid size-11 place-items-center rounded-lg hover:bg-elevated transition-colors"
              aria-label={msgUnread > 0 ? `Mesajlar, ${msgUnread} okunmamış` : "Mesajlar"}
            >
              <MessageCircle className={cn("size-5 transition-colors", msgUnread > 0 && "text-primary")} />
              {msgUnread > 0 ? (
                <span className="absolute right-1 top-1">
                  <span className="absolute -inset-0.5 animate-ping rounded-full bg-primary opacity-35" />
                  <span className="relative flex min-w-4.5 h-4.5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-fg tabular-nums shadow-xs">
                    {msgUnread > 99 ? "99+" : msgUnread}
                  </span>
                </span>
              ) : null}
            </Link>
            <AccountMenu admin={admin} />
          </SignedIn>
          <Link to="/ilan-ver" className="ml-1">
            <Button>
              <Plus className="size-4" /> İlan ver
            </Button>
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-0.5 md:hidden">
          <Link
            to={user ? "/mesajlar" : "/login"}
            onClick={closeMenu}
            className={cn(
              "relative grid size-11 place-items-center rounded-lg hover:bg-elevated",
              msgUnread > 0 && "text-primary",
            )}
            aria-label={msgUnread > 0 ? `Mesajlar, ${msgUnread} okunmamış` : "Mesajlar"}
          >
            <MessageCircle className="size-5" />
            {msgUnread > 0 ? (
              <span className="absolute right-0 top-0 grid place-items-center">
                <span className="absolute size-5 animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative min-w-5 rounded-full bg-primary px-1 text-center text-xs font-medium leading-5 text-primary-fg tabular-nums">
                  {msgUnread > 99 ? "99+" : msgUnread}
                </span>
              </span>
            ) : null}
          </Link>
          <button
            ref={menuBtnRef}
            type="button"
            className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Menüyü kapat" : "Menü"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <BurgerIcon open={open} />
          </button>
        </div>
      </div>
      <MobileDrawer
        open={open}
        onClose={closeMenu}
        q={q}
        setQ={setQ}
        onSearch={goSearch}
        admin={admin}
        msgUnread={msgUnread}
        noteUnread={noteUnread}
      />
    </header>
  );
}
