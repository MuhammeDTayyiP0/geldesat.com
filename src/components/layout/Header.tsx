import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Heart,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Shield,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { authEnabled, signOut } from "@/lib/auth/client";
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
  const canSignOut = authEnabled;

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
            <LayoutGrid className="size-4 shrink-0 text-muted" /> İlanlarım
          </Link>
          <Link to="/profil" className={item} onClick={() => setOpen(false)}>
            <User className="size-4 shrink-0 text-muted" /> Hesabım
          </Link>
          {admin ? (
            <Link to="/admin" className={item} onClick={() => setOpen(false)}>
              <Shield className="size-4 shrink-0 text-muted" /> Yönetim
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
              <LogOut className="size-4 shrink-0 text-muted" /> {signingOut ? "Çıkılıyor…" : "Çıkış"}
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

export function Header({ className }: { className?: string } = {}) {
  const nav = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [q, setQ] = useState("");
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

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    void nav({ to: "/search", search: { q } });
  }

  return (
    <header className={cn("site-header sticky top-0 border-b border-border bg-surface/90 backdrop-blur-md", className)}>
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
              <Bell className="size-5 shrink-0" />
              <UnreadDot n={noteUnread} />
            </Link>
            <Link to="/favoriler" className="grid size-11 place-items-center rounded-lg hover:bg-elevated" aria-label="Favoriler">
              <Heart className="size-5 shrink-0" />
            </Link>
            <Link
              to="/mesajlar"
              className="relative grid size-11 place-items-center rounded-lg hover:bg-elevated transition-colors"
              aria-label={msgUnread > 0 ? `Mesajlar, ${msgUnread} okunmamış` : "Mesajlar"}
            >
              <MessageCircle className={cn("size-5 shrink-0 transition-colors", msgUnread > 0 && "text-primary")} />
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
              <Plus className="size-4 shrink-0" /> İlan ver
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
            <MessageCircle className="size-5 shrink-0" />
            {msgUnread > 0 ? (
              <span className="absolute right-0 top-0 grid place-items-center">
                <span className="absolute size-5 animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative min-w-5 rounded-full bg-primary px-1 text-center text-xs font-medium leading-5 text-primary-fg tabular-nums">
                  {msgUnread > 99 ? "99+" : msgUnread}
                </span>
              </span>
            ) : null}
          </Link>
          <Link to="/harita" aria-label="Harita" className="grid size-11 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg">
            <MapPin className="size-5" />
          </Link>
          <Link to={user ? "/profil" : "/login"} aria-label={user ? "Hesabım" : "Giriş yap"} className="grid size-11 place-items-center rounded-lg hover:bg-elevated">
            {user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" /> : <User className="size-5" />}
          </Link>
        </div>
      </div>
    </header>
  );
}
