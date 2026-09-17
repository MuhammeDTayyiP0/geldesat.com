import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  Heart,
  LayoutGrid,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Shield,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 text-ink">
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

function MenuRow({
  to,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  to: "/search" | "/harita" | "/ilanlarim" | "/favoriler" | "/mesajlar" | "/bildirimler" | "/profil" | "/admin" | "/login";
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
  const panelRef = useRef<HTMLDivElement>(null);
  const canSignOut = authEnabled && !hasGateSessionMarker();
  const label = user?.displayName ?? user?.primaryEmail ?? "Hesap";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="md:hidden" aria-hidden={!open}>
      <div
        className="fixed inset-0 z-50 bg-ink/40"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease-out",
        }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
        className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-full flex-col bg-surface shadow-lift"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 200ms ease-out",
          pointerEvents: open ? "auto" : "none",
        }}
        inert={!open}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link to="/" onClick={onClose} className="flex items-center gap-2 text-ink">
            <LogoMark className="size-8" />
            <span className="text-lg font-semibold tracking-tight">GeldeSat</span>
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
            onClick={onClose}
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <form onSubmit={onSearch} className="px-1 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ne arıyorsunuz?"
                className="rounded-xl pl-9"
                aria-label="Ara"
              />
            </div>
          </form>

          {user ? (
            <Link
              to="/profil"
              onClick={onClose}
              className="mb-3 flex items-center gap-3 rounded-2xl bg-elevated p-3"
            >
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                <span className="grid size-11 place-items-center rounded-full bg-surface text-sm font-semibold">
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

          <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-subtle">Keşfet</p>
          <nav className="flex flex-col">
            <MenuRow to="/search" icon={Search} label="Tüm ilanlar" onClick={onClose} />
            <MenuRow to="/harita" icon={Map} label="Harita" onClick={onClose} />
          </nav>

          <SignedOut>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-subtle">Hesap</p>
            <nav className="flex flex-col">
              <MenuRow to="/login" icon={User} label="Giriş yap" onClick={onClose} />
            </nav>
          </SignedOut>
          <SignedIn>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-subtle">Hesap</p>
            <nav className="flex flex-col">
              <MenuRow to="/ilanlarim" icon={LayoutGrid} label="İlanlarım" onClick={onClose} />
              <MenuRow to="/favoriler" icon={Heart} label="Favoriler" onClick={onClose} />
              <MenuRow to="/mesajlar" icon={MessageCircle} label="Mesajlar" badge={msgUnread} onClick={onClose} />
              <MenuRow to="/bildirimler" icon={Bell} label="Bildirimler" badge={noteUnread} onClick={onClose} />
              <MenuRow to="/profil" icon={User} label="Profil" onClick={onClose} />
              {admin ? <MenuRow to="/admin" icon={Shield} label="Yönetim" onClick={onClose} /> : null}
            </nav>
            {canSignOut ? (
              <button
                type="button"
                disabled={signingOut}
                className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-sm font-medium text-muted hover:bg-elevated"
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

        <div className="drawer-safe shrink-0 border-t border-border p-4">
          <Link to="/ilan-ver" onClick={onClose} className="block">
            <Button className="h-12 w-full rounded-xl">
              <Plus className="size-4" /> Ücretsiz ilan ver
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const nav = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [noteUnread, setNoteUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [admin, setAdmin] = useState(false);

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
    window.addEventListener("geldesat:inbox", load);
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20000);
    return () => {
      window.removeEventListener("geldesat:inbox", load);
      window.clearInterval(tick);
    };
  }, [user]);

  const closeMenu = useCallback(() => setOpen(false), []);

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    void nav({ to: "/search", search: { q } });
    closeMenu();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Wordmark />
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
            <Link to="/mesajlar" className="relative grid size-11 place-items-center rounded-lg hover:bg-elevated" aria-label="Mesajlar">
              <MessageCircle className="size-5" />
              <UnreadDot n={msgUnread} tone="primary" />
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
            type="button"
            className="grid size-11 place-items-center rounded-lg hover:bg-elevated"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Menüyü kapat" : "Menü"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <span className="relative size-5">
              <Menu
                className={cn(
                  "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-200 ease-out",
                  open ? "scale-[0.25] opacity-0 blur-sm" : "scale-100 opacity-100 blur-none",
                )}
              />
              <X
                className={cn(
                  "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-200 ease-out",
                  open ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-sm",
                )}
              />
            </span>
          </button>
        </div>
      </div>
      <div id="mobile-menu">
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
      </div>
    </header>
  );
}
