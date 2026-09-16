import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Heart, LayoutGrid, LogOut, Menu, MessageCircle, Plus, Search, Shield, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { unreadCount } from "@/lib/server/social";
import { getMe } from "@/lib/server/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 text-ink">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-fg">G</span>
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
      className={`absolute right-1.5 top-1.5 min-w-4 rounded-full px-1 text-center text-xs font-medium text-primary-fg tabular-nums ${tone === "primary" ? "bg-primary" : "bg-danger"}`}
    >
      {n > 99 ? "99+" : n}
    </span>
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

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    void nav({ to: "/search", search: { q } });
    setOpen(false);
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
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <Link to="/ilan-ver">
            <Button size="sm">
              <Plus className="size-4" /> İlan
            </Button>
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menü"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-border bg-surface px-4 py-4 md:hidden">
          <form onSubmit={goSearch}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ne arıyorsunuz?" />
          </form>
          <div className="flex flex-col text-sm">
            <Link to="/search" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
              Tüm ilanlar
            </Link>
            <Link to="/harita" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
              Harita
            </Link>
            <SignedOut>
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
                Giriş yap
              </Link>
            </SignedOut>
            <SignedIn>
              <Link to="/ilanlarim" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
                İlanlarım
              </Link>
              <Link to="/favoriler" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
                Favoriler
              </Link>
              <Link to="/mesajlar" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
                Mesajlar{msgUnread > 0 ? ` (${msgUnread})` : ""}
              </Link>
              <Link to="/bildirimler" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
                Bildirimler{noteUnread > 0 ? ` (${noteUnread})` : ""}
              </Link>
              <Link to="/profil" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
                Profil
              </Link>
              {admin ? (
                <Link to="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 hover:bg-elevated">
                  Yönetim
                </Link>
              ) : null}
            </SignedIn>
          </div>
        </div>
      ) : null}
    </header>
  );
}