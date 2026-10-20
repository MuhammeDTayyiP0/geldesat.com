import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, MessageCircle, Plus, User } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useUnread } from "@/lib/unread-store";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { user } = useCurrentUserState();
  // Loaded and kept fresh by the header (always mounted alongside this bar).
  const msgUnread = useUnread().messages;

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const isHome = pathname === "/";
  const isCategories = pathname.startsWith("/search") || pathname.startsWith("/category");
  const isPost = pathname.startsWith("/ilan-ver");
  const isMessages = pathname.startsWith("/mesajlar");
  const isProfile = ["/profil", "/login", "/ilanlarim", "/ayarlar", "/favoriler", "/son-bakilanlar", "/bildirimler"].some((p) => pathname.startsWith(p));

  return (
    <nav
      aria-label="Mobil alt menü"
      className="fixed bottom-0 left-0 right-0 z-40 block border-t border-border bg-surface/95 backdrop-blur-md md:hidden shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid h-16 grid-cols-5 items-center px-1">
        {/* 1. Ana Sayfa */}
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
            isHome ? "text-primary font-bold" : "text-muted hover:text-fg",
          )}
        >
          <Home className={cn("size-5 transition-transform", isHome && "scale-110")} />
          <span>Ana Sayfa</span>
        </Link>

        {/* 2. Kategoriler */}
        <Link
          to="/search"
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
            isCategories ? "text-primary font-bold" : "text-muted hover:text-fg",
          )}
        >
          <LayoutGrid className={cn("size-5 transition-transform", isCategories && "scale-110")} />
          <span>Kategoriler</span>
        </Link>

        {/* 3. İlan Ver (Ortadaki Özel Yuvarlak Havada Buton - Sahibinden Standartlarında) */}
        <div className="flex flex-col items-center justify-center">
          <Link
            to="/ilan-ver"
            className={cn(
              "group relative -mt-6 flex size-12.5 items-center justify-center rounded-full bg-primary text-primary-fg ring-4 ring-surface shadow-md shadow-primary/25 transition-transform active:scale-95",
              isPost && "ring-primary/30",
            )}
            aria-label="İlan Ver"
          >
            <Plus className="size-6 stroke-[2.8] text-primary-fg transition-transform group-hover:rotate-90 duration-200" />
          </Link>
          <span className="mt-0.5 text-[10px] font-bold text-fg">İlan Ver</span>
        </div>

        {/* 4. Mesajlar */}
        <Link
          to={user ? "/mesajlar" : "/login"}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
            isMessages ? "text-primary font-bold" : "text-muted hover:text-fg",
          )}
        >
          <div className="relative">
            <MessageCircle className={cn("size-5 transition-transform", isMessages && "scale-110")} />
            {msgUnread > 0 ? (
              <span className="absolute -right-2.5 -top-1.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-fg">
                {msgUnread > 99 ? "99+" : msgUnread}
              </span>
            ) : null}
          </div>
          <span>Mesajlar</span>
        </Link>

        {/* 5. Hesabım */}
        <Link
          to={user ? "/profil" : "/login"}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
            isProfile ? "text-primary font-bold" : "text-muted hover:text-fg",
          )}
        >
          <User className={cn("size-5 transition-transform", isProfile && "scale-110")} />
          <span>{user ? "Hesabım" : "Giriş"}</span>
        </Link>
      </div>
    </nav>
  );
}
