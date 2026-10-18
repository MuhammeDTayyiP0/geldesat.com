import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Heart,
  LayoutGrid,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { subscribeChatStream } from "@/lib/chat-stream";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { unreadCount } from "@/lib/server/social";
import { getMe } from "@/lib/server/account";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";
import { MAIN_NAV_CATEGORIES } from "./navbar/nav-data";
import type { MegaCategory } from "./navbar/nav-data";
import { AutocompleteSearchBar } from "./navbar/SearchBar";
import { UserAccountDropdown } from "./navbar/UserAccountDropdown";
import { MegaMenuOverlay, AllCategoriesMegaMenu } from "./navbar/MegaMenu";
import { MobileNavigationDrawer } from "./navbar/MobileNavigationDrawer";

export interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  const { user, isPending } = useCurrentUserState();
  const [msgUnread, setMsgUnread] = useState(0);
  const [noteUnread, setNoteUnread] = useState(0);
  const [admin, setAdmin] = useState(false);

  // Mega menü hover kontrolü
  const [hoveredCategory, setHoveredCategory] = useState<MegaCategory | null>(null);
  const [allCategoriesHovered, setAllCategoriesHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobil drawer durumu
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // SSE ve unread yükleyici
  useEffect(() => {
    if (!user) {
      setMsgUnread(0);
      setNoteUnread(0);
      setAdmin(false);
      return;
    }

    function loadStats() {
      unreadCount()
        .then((c) => {
          setNoteUnread(c.notifications);
          setMsgUnread(c.messages);
        })
        .catch(() => undefined);
    }

    loadStats();
    getMe()
      .then((m) => setAdmin(m.profile?.role === "ADMIN"))
      .catch(() => undefined);

    // The header owns the inbox side of the shared chat stream and re-broadcasts
    // it as a window event for the inbox page.
    const unsubscribe = subscribeChatStream((data) => {
      if (data.type === "new_message") {
        setMsgUnread((prev) => prev + 1);
        window.dispatchEvent(new CustomEvent("geldesat:inbox", { detail: data }));
      } else if (data.type === "read_update" || data.type === "inbox_ping") {
        loadStats();
        window.dispatchEvent(new CustomEvent("geldesat:inbox", { detail: data }));
      }
    });
    window.addEventListener("geldesat:inbox", loadStats);
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") loadStats();
    }, 20000);

    return () => {
      unsubscribe();
      window.removeEventListener("geldesat:inbox", loadStats);
      window.clearInterval(tick);
    };
  }, [user]);

  // Mega menü için yumuşak hover gecikmesi
  function handleCategoryMouseEnter(cat: MegaCategory) {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setAllCategoriesHovered(false);
    setHoveredCategory(cat);
  }

  function handleCategoryMouseLeave() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCategory(null);
    }, 150);
  }

  function handleAllCategoriesMouseEnter() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredCategory(null);
    setAllCategoriesHovered(true);
  }

  function handleAllCategoriesMouseLeave() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setAllCategoriesHovered(false);
    }, 150);
  }

  return (
    <header className={cn("site-header sticky top-0 z-40 w-full bg-surface shadow-xs", className)}>
      {/* =========================================================================
          KATMAN 1: ÜST KATMAN (Logo, Arama, Mesajlar, Favoriler, Profil, İlan Ver)
          ========================================================================= */}
      <div className="border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Sol: Hamburger Butonu (Mobil) + Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg md:hidden"
              aria-label="Menüyü Aç"
            >
              <Menu className="size-6" />
            </button>

            <Link to="/" className="flex items-center gap-2 group">
              <LogoMark className="size-8 transition-transform group-hover:scale-105" />
              <span className="text-xl font-bold tracking-tight text-ink">GeldeSat</span>
            </Link>
          </div>

          {/* Orta: Arama Çubuğu (Masaüstünde Geniş Autocomplete, Mobilde Buton) */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-4">
            <AutocompleteSearchBar />
          </div>

          {/* Sağ: İkonlar, Giriş/Profil ve İlan Ver Butonu */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobilde Arama Açma Butonu */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              className={cn(
                "grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg md:hidden transition-colors",
                mobileSearchOpen && "bg-elevated text-primary",
              )}
              aria-label="Arama Yap"
            >
              <Search className="size-5" />
            </button>

            {/* Mobilde Harita Kısayolu */}
            <Link
              to="/harita"
              className="grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg md:hidden transition-colors"
              aria-label="Haritada Ara"
            >
              <MapPin className="size-5" />
            </Link>

            {/* Mobilde Bildirimler (Giriş yapılmışsa rozetle) */}
            <SignedIn>
              <Link
                to="/bildirimler"
                className="relative grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg md:hidden transition-colors"
                aria-label={noteUnread > 0 ? `Bildirimler (${noteUnread} yeni)` : "Bildirimler"}
              >
                <Bell className="size-5" />
                {noteUnread > 0 && (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface" />
                )}
              </Link>
            </SignedIn>

            {/* Masaüstü Mesajlar (Mobilde alt barda olduğu için md:grid ile gösterilir) */}
            <Link
              to={user ? "/mesajlar" : "/login"}
              className="relative hidden md:grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg transition-colors"
              aria-label={msgUnread > 0 ? `Mesajlar (${msgUnread} okunmamış)` : "Mesajlar"}
            >
              <MessageCircle className={cn("size-5 transition-colors", msgUnread > 0 && "text-primary")} />
              {msgUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5">
                  <span className="absolute -inset-0.5 animate-ping rounded-full bg-primary opacity-40" />
                  <span className="relative flex min-w-4.5 h-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-fg tabular-nums shadow-xs">
                    {msgUnread > 99 ? "99+" : msgUnread}
                  </span>
                </span>
              )}
            </Link>

            {/* Masaüstü Favoriler */}
            <Link
              to={user ? "/favoriler" : "/login"}
              className="hidden md:grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg transition-colors"
              aria-label="Favorilerim"
            >
              <Heart className="size-5" />
            </Link>

            {/* Masaüstü Bildirimler */}
            <SignedIn>
              <Link
                to="/bildirimler"
                className="relative hidden md:grid size-10 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg transition-colors"
                aria-label={noteUnread > 0 ? `Bildirimler (${noteUnread} yeni)` : "Bildirimler"}
              >
                <Bell className="size-5" />
                {noteUnread > 0 && (
                  <span className="absolute 1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
                )}
              </Link>
            </SignedIn>

            {/* Masaüstü Kullanıcı Giriş / Profil Menüsü (Mobilde alt barda ve çekmecede vardır) */}
            <div className="hidden md:flex items-center">
              {isPending ? (
                <div className="h-9 w-20 animate-pulse rounded-lg bg-elevated" />
              ) : (
                <>
                  <SignedOut>
                    <Link
                      to="/login"
                      className="flex items-center gap-1.5 h-10 px-3 text-xs sm:text-sm font-semibold text-fg hover:text-primary hover:bg-elevated rounded-lg transition-colors"
                    >
                      <User className="size-4 text-muted" />
                      <span>Giriş Yap</span>
                    </Link>
                  </SignedOut>

                  <SignedIn>
                    <UserAccountDropdown admin={admin} />
                  </SignedIn>
                </>
              )}
            </div>

            {/* Masaüstü "İlan Ver" Butonu (Mobilde alt barda ortada havada duran yuvarlak buton olduğu için md:flex) */}
            <Link
              to="/ilan-ver"
              className="ml-1 sm:ml-2 hidden md:flex items-center gap-1.5 h-10 px-3.5 sm:px-4.5 rounded-lg font-bold text-xs sm:text-sm text-ink bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-sm hover:shadow-md active:scale-95 transition-all duration-150 ring-1 ring-amber-400/50"
            >
              <Plus className="size-4 stroke-[2.8]" />
              <span className="tracking-tight">İlan Ver</span>
            </Link>
          </div>
        </div>

        {/* Mobilde Arama Çubuğu Açıldığında Gösterilen Panel */}
        {mobileSearchOpen && (
          <div className="p-3 border-t border-border bg-surface md:hidden animate-in fade-in-50 duration-150">
            <AutocompleteSearchBar onSearchSubmit={() => setMobileSearchOpen(false)} />
          </div>
        )}
      </div>

      {/* =========================================================================
          KATMAN 2: ALT KATMAN (Yatay Kategori Şeridi ve Hover Mega-Menü Desteği)
          ========================================================================= */}
      <nav
        aria-label="Ana kategoriler"
        className="relative hidden md:block border-b border-border/80 bg-surface/98 backdrop-blur-md"
      >
        <div className="mx-auto flex h-11 max-w-7xl items-center px-4 sm:px-6">
          {/* 1. "Tüm Kategoriler" Butonu */}
          <div
            onMouseEnter={handleAllCategoriesMouseEnter}
            className="relative h-full flex items-center pr-3 border-r border-border/70"
          >
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-bold transition-colors",
                allCategoriesHovered ? "bg-primary text-primary-fg" : "text-fg hover:bg-elevated",
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>Tüm Kategoriler</span>
              <ChevronDown
                className={cn("size-3 transition-transform duration-150", allCategoriesHovered && "rotate-180")}
              />
            </button>
          </div>

          {/* 2. Yatay Kategori Linkleri */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar pl-2">
            {MAIN_NAV_CATEGORIES.map((cat) => {
              const isHovered = hoveredCategory?.id === cat.id;
              return (
                <div
                  key={cat.id}
                  onMouseEnter={() => handleCategoryMouseEnter(cat)}
                  className="relative h-full flex items-center"
                >
                  <Link
                    to="/search"
                    search={{ category: cat.slug }}
                    className={cn(
                      "flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                      isHovered ? "bg-elevated text-primary font-semibold shadow-2xs" : "text-muted hover:text-fg hover:bg-elevated/70",
                    )}
                  >
                    <cat.icon className={cn("size-3.5", isHovered ? "text-primary" : "text-muted")} />
                    <span>{cat.name}</span>
                    {cat.badge && (
                      <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold text-warn bg-warn/10 rounded-full">
                        {cat.badge}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* 3. Sağ Kısayollar (Harita, Vitrin vb.) */}
          <div className="flex items-center gap-2 pl-3 border-l border-border/70">
            <Link
              to="/harita"
              className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary transition-colors py-1 px-2 rounded-md hover:bg-elevated"
            >
              <MapPin className="size-3.5 text-primary" />
              <span>Harita</span>
            </Link>
          </div>
        </div>

        {/* Hover Mega Menü Açılır Panelleri */}
        {allCategoriesHovered && <AllCategoriesMegaMenu onClose={handleAllCategoriesMouseLeave} />}
        {hoveredCategory && <MegaMenuOverlay activeCategory={hoveredCategory} onClose={handleCategoryMouseLeave} />}
      </nav>

      {/* Mobil Hamburger Çekmecesi */}
      <MobileNavigationDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        unreadMsgCount={msgUnread}
        unreadNoteCount={noteUnread}
        admin={admin}
      />
    </header>
  );
}

// Geriye dönük uyumluluk için Header adı ile de export edilir
export { Navbar as Header };
