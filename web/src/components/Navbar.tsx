import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Briefcase,
  Building2,
  Car,
  ChevronDown,
  ChevronRight,
  Heart,
  HelpCircle,
  History,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  PawPrint,
  Plus,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  TrendingUp,
  User,
  Wrench,
  X,
} from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { subscribeChatStream } from "@/lib/chat-stream";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { unreadCount } from "@/lib/server/social";
import { getMe } from "@/lib/server/account";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 1. Kategori & Mega Menü Tanımları (Sahibinden Standartlarında)
// ---------------------------------------------------------------------------

type SubCategoryGroup = {
  title: string;
  slug: string;
  items: { name: string; slug: string }[];
};

type MegaCategory = {
  id: string;
  name: string;
  slug: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  groups: SubCategoryGroup[];
};

const MAIN_NAV_CATEGORIES: MegaCategory[] = [
  {
    id: "emlak",
    name: "Emlak",
    slug: "emlak",
    icon: Building2,
    groups: [
      {
        title: "Konut",
        slug: "konut",
        items: [
          { name: "Satılık Daire", slug: "satilik-konut" },
          { name: "Kiralık Daire", slug: "kiralik-konut" },
          { name: "Satılık Villa", slug: "satilik-villa" },
          { name: "Kiralık Villa", slug: "kiralik-villa" },
          { name: "Satılık Residence", slug: "satilik-residence" },
          { name: "Satılık Yazlık", slug: "satilik-yazlik" },
          { name: "Turistik Günlük Kiralık", slug: "gunluk-kiralik" },
        ],
      },
      {
        title: "İşyeri",
        slug: "isyeri",
        items: [
          { name: "Satılık Dükkan & Mağaza", slug: "satilik-dukkan" },
          { name: "Kiralık Dükkan & Mağaza", slug: "kiralik-dukkan" },
          { name: "Satılık Ofis", slug: "satilik-ofis" },
          { name: "Kiralık Ofis", slug: "kiralik-ofis" },
          { name: "Satılık Fabrika & Depo", slug: "satilik-fabrika" },
          { name: "Satılık Plaza / Plaza Katı", slug: "satilik-plaza" },
        ],
      },
      {
        title: "Arsa & Arazi",
        slug: "arsa",
        items: [
          { name: "Satılık Arsa", slug: "arsa" },
          { name: "Satılık Tarla", slug: "arsa" },
          { name: "Bağ & Bahçe", slug: "arsa" },
          { name: "Kat Karşılığı Arsa", slug: "arsa" },
        ],
      },
      {
        title: "Projeler & Vitrin",
        slug: "projeler",
        items: [
          { name: "Sıfır Konut Projeleri", slug: "emlak" },
          { name: "Emlak Ofisleri", slug: "emlak" },
          { name: "Bankadan & İcradan Satılık", slug: "emlak" },
        ],
      },
    ],
  },
  {
    id: "vasita",
    name: "Vasıta",
    slug: "vasita",
    icon: Car,
    badge: "Popüler",
    groups: [
      {
        title: "Otomobil",
        slug: "otomobil",
        items: [
          { name: "BMW", slug: "oto-bmw" },
          { name: "Mercedes-Benz", slug: "oto-mercedes" },
          { name: "Volkswagen", slug: "oto-vw" },
          { name: "Renault", slug: "oto-renault" },
          { name: "Fiat", slug: "oto-fiat" },
          { name: "Toyota", slug: "oto-toyota" },
          { name: "Honda", slug: "oto-honda" },
          { name: "Tüm Otomobil İlanları", slug: "otomobil" },
        ],
      },
      {
        title: "Motosiklet",
        slug: "motosiklet",
        items: [
          { name: "Scooter", slug: "motosiklet" },
          { name: "Touring", slug: "motosiklet" },
          { name: "Super Sport", slug: "motosiklet" },
          { name: "Enduro / Cross", slug: "motosiklet" },
          { name: "Yamaha", slug: "moto-yamaha" },
          { name: "Honda Motosiklet", slug: "motosiklet" },
        ],
      },
      {
        title: "Ticari Araçlar",
        slug: "ticari",
        items: [
          { name: "Kamyonet", slug: "ticari" },
          { name: "Panelvan & Minibüs", slug: "ticari" },
          { name: "Kamyon & Çekici", slug: "ticari" },
          { name: "Otobüs & Midibüs", slug: "ticari" },
        ],
      },
      {
        title: "Özel Araçlar",
        slug: "ozel-araclar",
        items: [
          { name: "Elektrikli Araçlar", slug: "vasita" },
          { name: "Klasik Araçlar", slug: "vasita" },
          { name: "Deniz Araçları & Tekne", slug: "vasita" },
          { name: "Karavan & Kamp Araçları", slug: "vasita" },
        ],
      },
    ],
  },
  {
    id: "alisveris",
    name: "İkinci El Alışveriş",
    slug: "alisveris",
    icon: ShoppingBag,
    groups: [
      {
        title: "Bilgisayar & Donanım",
        slug: "bilgisayar",
        items: [
          { name: "Dizüstü (Laptop)", slug: "alisveris" },
          { name: "Masaüstü Bilgisayar", slug: "alisveris" },
          { name: "Monitör & Ekran Kartı", slug: "alisveris" },
          { name: "Tablet & Aksesuar", slug: "alisveris" },
        ],
      },
      {
        title: "Cep Telefonu & Aksesuar",
        slug: "telefon",
        items: [
          { name: "Apple iPhone", slug: "alisveris" },
          { name: "Samsung Galaxy", slug: "alisveris" },
          { name: "Xiaomi & Diğerleri", slug: "alisveris" },
          { name: "Akıllı Saat & Bileklik", slug: "alisveris" },
        ],
      },
      {
        title: "Ev Elektroniği & Beyaz Eşya",
        slug: "elektronik",
        items: [
          { name: "Televizyon & Ses", slug: "alisveris" },
          { name: "Buzdolabı & Çamaşır Makinesi", slug: "alisveris" },
          { name: "Oyun Konsolları (PS5 / Xbox)", slug: "alisveris" },
          { name: "Klima & Isıtıcı", slug: "alisveris" },
        ],
      },
      {
        title: "Ev & Yaşam / Moda",
        slug: "ev-yasam",
        items: [
          { name: "Mobilya & Dekorasyon", slug: "alisveris" },
          { name: "Giyim & Ayakkabı", slug: "alisveris" },
          { name: "Spor & Outdoor", slug: "alisveris" },
          { name: "Kitap, Müzik & Hobi", slug: "alisveris" },
        ],
      },
    ],
  },
  {
    id: "yedek-parca",
    name: "Yedek Parça & Aksesuar",
    slug: "yedek-parca",
    icon: Wrench,
    groups: [
      {
        title: "Otomotiv Ekipmanları",
        slug: "oto-parca",
        items: [
          { name: "Jant & Lastik", slug: "yedek-parca" },
          { name: "Ses & Müzik Sistemleri", slug: "yedek-parca" },
          { name: "Motor & Mekanik Parça", slug: "yedek-parca" },
          { name: "Aydınlatma & Far", slug: "yedek-parca" },
        ],
      },
      {
        title: "Motosiklet Ekipmanları",
        slug: "moto-ekipman",
        items: [
          { name: "Kask & Güvenlik", slug: "yedek-parca" },
          { name: "Motosiklet Montu & Eldiven", slug: "yedek-parca" },
          { name: "Motosiklet Çantaları", slug: "yedek-parca" },
        ],
      },
    ],
  },
  {
    id: "hizmetler",
    name: "Ustalar & Hizmetler",
    slug: "hizmetler",
    icon: Wrench,
    groups: [
      {
        title: "Ev Tadilat & Dekorasyon",
        slug: "tadilat",
        items: [
          { name: "Boya & Badana", slug: "hizmetler" },
          { name: "Su & Doğalgaz Tesisatı", slug: "hizmetler" },
          { name: "Elektrikçi & Aydınlatma", slug: "hizmetler" },
          { name: "Marangoz & Mobilya Montaj", slug: "hizmetler" },
        ],
      },
      {
        title: "Nakliyat & Araç Servisi",
        slug: "nakliyat",
        items: [
          { name: "Evden Eve Nakliyat", slug: "hizmetler" },
          { name: "Oto Ekspertiz & Bakım", slug: "hizmetler" },
          { name: "Oto Kurtarma & Çekici", slug: "hizmetler" },
          { name: "Temizlik Hizmetleri", slug: "hizmetler" },
        ],
      },
    ],
  },
  {
    id: "is-ilanlari",
    name: "İş İlanları",
    slug: "is-ilanlari",
    icon: Briefcase,
    groups: [
      {
        title: "Sektörel İlanlar",
        slug: "sektorler",
        items: [
          { name: "Satış & Pazarlama", slug: "is-ilanlari" },
          { name: "Restoran & Kafe Personeli", slug: "is-ilanlari" },
          { name: "Şoför & Kurye", slug: "is-ilanlari" },
          { name: "Bilişim & Yazılım", slug: "is-ilanlari" },
          { name: "Depo & Lojistik", slug: "is-ilanlari" },
        ],
      },
    ],
  },
  {
    id: "hayvanlar",
    name: "Hayvanlar Alemi",
    slug: "hayvanlar-alemi",
    icon: PawPrint,
    groups: [
      {
        title: "Evcil Hayvan & Bakım",
        slug: "evcil-hayvan",
        items: [
          { name: "Evcil Hayvan Sahiplenme", slug: "hayvanlar-alemi" },
          { name: "Akvaryum & Balıklar", slug: "hayvanlar-alemi" },
          { name: "Kuşlar & Kafesler", slug: "hayvanlar-alemi" },
          { name: "Mama, Aksesuar & Sağlık", slug: "hayvanlar-alemi" },
        ],
      },
    ],
  },
];

const POPULAR_SEARCH_TERMS = [
  "Satılık Daire",
  "Kiralık Daire",
  "BMW 320d",
  "Renault Megane",
  "Volkswagen Golf",
  "iPhone 15",
  "Fiat Egea",
  "Satılık Arsa",
  "Honda Civic",
  "Motosiklet",
];

const RECENT_SEARCHES_KEY = "geldesat:recent_searches_v1";

// ---------------------------------------------------------------------------
// 2. Autocomplete Arama Kutusu Bileşeni
// ---------------------------------------------------------------------------

function AutocompleteSearchBar({
  onSearchSubmit,
  initialQuery = "",
  className,
}: {
  onSearchSubmit?: () => void;
  initialQuery?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // localStorage'dan geçmiş aramaları yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 6));
      }
    } catch {
      // LocalStorage desteği yoksa sessizce devam et
    }
  }, []);

  // Tıklama dışı algılama (Click outside)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function saveSearchTerm(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const updated = [trimmed, ...recentSearches.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  function removeRecentSearch(termToRemove: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = recentSearches.filter((t) => t !== termToRemove);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  function clearAllRecentSearches(e: React.MouseEvent) {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  }

  function executeSearch(searchTerm: string, categorySlug?: string) {
    const finalTerm = searchTerm.trim();
    if (finalTerm) saveSearchTerm(finalTerm);
    setIsOpen(false);
    onSearchSubmit?.();

    const searchParams: { q?: string; category?: string } = {};
    if (finalTerm) searchParams.q = finalTerm;
    if (categorySlug && categorySlug !== "all") {
      searchParams.category = categorySlug;
    } else if (selectedCategory && selectedCategory !== "all") {
      searchParams.category = selectedCategory;
    }

    void navigate({ to: "/search", search: searchParams });
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeSearch(query);
  }

  // Dinamik öneriler: Kullanıcı yazarken eşleşen popüler kelimeler ve kategoriler
  const trimmedQ = query.trim().toLocaleLowerCase("tr");
  const filteredPopular = trimmedQ
    ? POPULAR_SEARCH_TERMS.filter((t) => t.toLocaleLowerCase("tr").includes(trimmedQ))
    : POPULAR_SEARCH_TERMS.slice(0, 6);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form onSubmit={handleFormSubmit} className="relative flex items-center w-full">
        {/* Kategori Seçici Seçeneği (Opsiyonel Sol Filtre) */}
        <div className="relative hidden lg:flex items-center">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 pl-3 pr-7 text-xs font-medium text-muted bg-elevated/60 hover:bg-elevated border-y border-l border-border rounded-l-lg appearance-none cursor-pointer focus:outline-hidden transition-colors"
            aria-label="Kategori filtresi"
          >
            <option value="all">Tüm Kategoriler</option>
            <option value="emlak">Emlak</option>
            <option value="vasita">Vasıta</option>
            <option value="alisveris">İkinci El Alışveriş</option>
            <option value="yedek-parca">Yedek Parça</option>
            <option value="hizmetler">Hizmetler</option>
            <option value="is-ilanlari">İş İlanları</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted" />
        </div>

        {/* Ana Arama Inputu */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsOpen(false);
            }}
            placeholder="Kelime, ilan no, marka veya kategori ile ara..."
            autoComplete="off"
            aria-label="İlan arama"
            className={cn(
              "w-full h-10 pl-10 pr-10 text-sm text-fg bg-surface border border-border transition-all duration-150 focus:outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20",
              "rounded-lg lg:rounded-l-none lg:rounded-r-lg",
              isOpen && "ring-2 ring-primary/20 border-primary shadow-xs",
            )}
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-fg rounded-full transition-colors"
              aria-label="Aramayı temizle"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Arama İkon Butonu (Görsel ve Hızlı Tetikleyici) */}
        <button
          type="submit"
          className="ml-2 hidden sm:flex items-center justify-center h-10 px-4 bg-primary hover:bg-primary/90 text-primary-fg text-sm font-semibold rounded-lg shadow-xs transition-all active:scale-95"
          aria-label="Ara"
        >
          <span>Ara</span>
        </button>
      </form>

      {/* Autocomplete Dropdown Paneli */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface rounded-xl border border-border shadow-lift overflow-hidden divide-y divide-border/60 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* 1. Canlı Arama Hedefleri (Kullanıcı bir şey yazıyorsa) */}
          {query.trim().length > 0 && (
            <div className="p-2 bg-elevated/40">
              <button
                type="button"
                onClick={() => executeSearch(query)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left font-medium text-primary hover:bg-surface rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Search className="size-4 shrink-0 text-primary" />
                  <span className="truncate">
                    &quot;<span className="font-semibold text-fg">{query}</span>&quot; ile ara
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Kategori Bazlı Hızlı Arama Butonları */}
              <div className="mt-1 flex flex-wrap gap-1.5 px-3">
                <span className="text-[11px] text-muted font-medium self-center mr-1">Kategoride:</span>
                {["emlak", "vasita", "alisveris"].map((cSlug) => {
                  const cat = MAIN_NAV_CATEGORIES.find((c) => c.slug === cSlug);
                  if (!cat) return null;
                  return (
                    <button
                      key={cSlug}
                      type="button"
                      onClick={() => executeSearch(query, cat.slug)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted hover:text-primary bg-surface hover:bg-elevated border border-border rounded-md transition-colors"
                    >
                      <cat.icon className="size-3 text-muted" />
                      <span>{cat.name} içinde</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Son Aramalar (LocalStorage'dan) */}
          {recentSearches.length > 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-muted">
                <div className="flex items-center gap-1.5">
                  <History className="size-3.5 text-muted" />
                  <span>Son Aramalar</span>
                </div>
                <button
                  type="button"
                  onClick={clearAllRecentSearches}
                  className="text-[11px] text-subtle hover:text-danger font-medium transition-colors"
                >
                  Tümünü Temizle
                </button>
              </div>
              <div className="mt-1 space-y-0.5">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    onClick={() => {
                      setQuery(term);
                      executeSearch(term);
                    }}
                    className="flex items-center justify-between px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <History className="size-3.5 text-subtle shrink-0 group-hover:text-primary" />
                      <span className="truncate">{term}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => removeRecentSearch(term, e)}
                      className="p-1 text-subtle hover:text-danger rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Sil"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Popüler ve Trend Aramalar */}
          <div className="p-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted">
              <TrendingUp className="size-3.5 text-warn" />
              <span>Popüler Aramalar</span>
            </div>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
              {filteredPopular.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    executeSearch(term);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-left text-fg hover:bg-elevated rounded-lg transition-colors group"
                >
                  <Search className="size-3.5 text-subtle shrink-0 group-hover:text-primary transition-colors" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Alt Kısım: Detaylı Arama Linki */}
          <div className="p-2 bg-elevated/40 flex items-center justify-between text-xs text-muted px-4 py-2.5">
            <span>Daha spesifik bir arama mı yapmak istiyorsunuz?</span>
            <Link
              to="/search"
              onClick={() => setIsOpen(false)}
              className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Detaylı Arama</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Kullanıcı Profil ve Hesap Açılır Menüsü (Better Auth Entegreli)
// ---------------------------------------------------------------------------

function UserAccountDropdown({ admin }: { admin: boolean }) {
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.displayName || user?.primaryEmail?.split("@")[0] || "Kullanıcı";
  const userInitial = displayName.charAt(0).toLocaleUpperCase("tr");

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Kullanıcı Menüsü"
        className={cn(
          "flex items-center gap-2 h-10 px-2.5 rounded-lg transition-colors",
          open ? "bg-elevated ring-1 ring-border" : "hover:bg-elevated",
        )}
      >
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt={displayName}
            className="size-7 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-fg text-xs font-bold shadow-xs">
            {userInitial}
          </span>
        )}
        <span className="hidden xl:inline text-xs font-semibold text-fg max-w-28 truncate">{displayName}</span>
        <ChevronDown className={cn("size-3.5 text-muted transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lift animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Kullanıcı Başlık Bilgisi */}
          <div className="p-3 border-b border-border/70 bg-elevated/40 rounded-t-lg">
            <p className="text-sm font-semibold text-fg truncate">{displayName}</p>
            <p className="text-xs text-muted truncate">{user?.primaryEmail || "Oturum Açıldı"}</p>
          </div>

          <div className="py-1">
            <Link
              to="/ilanlarim"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <LayoutGrid className="size-4 text-muted shrink-0" />
              <span>İlanlarım</span>
            </Link>

            <Link
              to="/mesajlar"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <MessageCircle className="size-4 text-muted shrink-0" />
              <span>Mesajlarım</span>
            </Link>

            <Link
              to="/favoriler"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <Heart className="size-4 text-muted shrink-0" />
              <span>Favorilerim</span>
            </Link>

            <Link
              to="/profil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <User className="size-4 text-muted shrink-0" />
              <span>Hesabım & Profil</span>
            </Link>

            {admin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors text-warn font-medium"
              >
                <Shield className="size-4 text-warn shrink-0" />
                <span>Yönetim Paneli</span>
              </Link>
            )}
          </div>

          <div className="pt-1 border-t border-border/70">
              <button
                type="button"
                disabled={signingOut}
                onClick={() => {
                  setSigningOut(true);
                  void signOut().catch(() => setSigningOut(false));
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors font-medium text-left"
              >
                <LogOut className="size-4 text-danger shrink-0" />
                <span>{signingOut ? "Çıkış Yapılıyor…" : "Güvenli Çıkış"}</span>
              </button>
            </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Hover Mega Menü Bileşeni (Alt Katman)
// ---------------------------------------------------------------------------

function MegaMenuOverlay({
  activeCategory,
  onClose,
}: {
  activeCategory: MegaCategory;
  onClose: () => void;
}) {
  return (
    <div
      onMouseLeave={onClose}
      className="absolute left-0 right-0 top-full z-40 bg-surface/98 backdrop-blur-xl border-b border-border shadow-lift py-6 px-4 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <activeCategory.icon className="size-5" />
            </span>
            <h3 className="text-base font-bold text-fg">{activeCategory.name}</h3>
            {activeCategory.badge && (
              <span className="px-2 py-0.5 text-[11px] font-semibold text-primary bg-primary/10 rounded-full">
                {activeCategory.badge}
              </span>
            )}
          </div>
          <Link
            to="/search"
            search={{ category: activeCategory.slug }}
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Tüm {activeCategory.name} İlanlarını Görüntüle</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {/* Çok Sütunlu Alt Kategori Listeleri */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {activeCategory.groups.map((group) => (
            <div key={group.slug} className="space-y-2.5">
              <Link
                to="/search"
                search={{ category: group.slug }}
                onClick={onClose}
                className="text-xs font-bold uppercase tracking-wider text-muted hover:text-primary transition-colors flex items-center justify-between group"
              >
                <span>{group.title}</span>
                <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
              </Link>
              <ul className="space-y-1.5 border-l-2 border-border/60 pl-3">
                {group.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      to="/search"
                      search={{ category: item.slug }}
                      onClick={onClose}
                      className="text-sm text-fg/80 hover:text-primary hover:font-medium transition-colors block py-0.5"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// "Tüm Kategoriler" Özel Mega Menüsü
function AllCategoriesMegaMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      onMouseLeave={onClose}
      className="absolute left-0 right-0 top-full z-40 bg-surface/98 backdrop-blur-xl border-b border-border shadow-lift py-6 px-4 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/70">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-5 text-primary" />
            <h3 className="text-base font-bold text-fg">Tüm Kategoriler</h3>
          </div>
          <Link
            to="/search"
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Gelişmiş Arama & Filtreler</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {MAIN_NAV_CATEGORIES.map((cat) => (
            <div key={cat.id} className="p-3 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-elevated/40 transition-all group">
              <Link
                to="/search"
                search={{ category: cat.slug }}
                onClick={onClose}
                className="flex items-center gap-2.5 mb-2 font-bold text-sm text-fg group-hover:text-primary transition-colors"
              >
                <span className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-fg transition-colors">
                  <cat.icon className="size-4" />
                </span>
                <span>{cat.name}</span>
              </Link>
              <div className="space-y-1 pl-8">
                {cat.groups.flatMap((g) => g.items).slice(0, 4).map((subItem) => (
                  <Link
                    key={subItem.name}
                    to="/search"
                    search={{ category: subItem.slug }}
                    onClick={onClose}
                    className="block text-xs text-muted hover:text-fg truncate py-0.5"
                  >
                    {subItem.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Mobil Hamburger Drawer (Slide-Over Panel)
// ---------------------------------------------------------------------------

function MobileNavigationDrawer({
  isOpen,
  onClose,
  unreadMsgCount,
  unreadNoteCount,
  admin,
}: {
  isOpen: boolean;
  onClose: () => void;
  unreadMsgCount: number;
  unreadNoteCount: number;
  admin: boolean;
}) {
  const { user } = useCurrentUserState();
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>("emlak");

  // Drawer açıkken body scroll kilidi
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
      {/* Karartma Arkalığı (Backdrop) */}
      <div
        className="fixed inset-0 bg-ink/50 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Çekmece */}
      <div className="relative w-full max-w-xs sm:max-w-sm bg-surface h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250 ease-out">
        {/* Çekmece Başlığı */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-elevated/40">
          <Link to="/" onClick={onClose} className="flex items-center gap-2">
            <LogoMark className="size-7" />
            <span className="text-lg font-bold tracking-tight text-ink">GeldeSat</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted hover:text-fg rounded-lg hover:bg-elevated transition-colors"
            aria-label="Menüyü Kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* İlan Ver Butonu - Mobil Çekmecede de Öne Çıkan */}
        <div className="p-3 border-b border-border">
          <Link
            to="/ilan-ver"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl font-bold text-sm text-ink bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-md active:scale-98 transition-all"
          >
            <Plus className="size-5 stroke-[2.5]" />
            <span>ÜCRETSİZ İLAN VER</span>
          </Link>
        </div>

        {/* Kullanıcı Giriş / Profil Kartı */}
        <div className="p-3 border-b border-border bg-elevated/20">
          {user ? (
            <div className="flex items-center gap-3">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="size-10 rounded-full object-cover ring-1 ring-border" />
              ) : (
                <div className="size-10 rounded-full bg-primary text-primary-fg font-bold grid place-items-center text-sm shadow-xs">
                  {(user.displayName || user.primaryEmail || "U").slice(0, 1).toLocaleUpperCase("tr")}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-fg truncate">{user.displayName || "Hesabım"}</p>
                <p className="text-xs text-muted truncate">{user.primaryEmail}</p>
              </div>
              <Link
                to="/profil"
                onClick={onClose}
                className="p-2 text-muted hover:text-primary rounded-lg hover:bg-elevated transition-colors"
                aria-label="Profil ayarları"
              >
                <Settings className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                to="/login"
                onClick={onClose}
                className="flex-1 flex items-center justify-center h-10 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-fg hover:bg-primary/90 transition-colors shadow-xs"
              >
                Giriş Yap
              </Link>
              <Link
                to="/login"
                onClick={onClose}
                className="flex-1 flex items-center justify-center h-10 px-3 text-xs font-semibold rounded-lg border border-border bg-surface text-fg hover:bg-elevated transition-colors"
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </div>

        {/* Hızlı İşlem Linkleri */}
        <div className="grid grid-cols-3 gap-1 p-2 border-b border-border text-center">
          <Link
            to={user ? "/mesajlar" : "/login"}
            onClick={onClose}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg hover:bg-elevated transition-colors text-xs font-medium text-fg relative"
          >
            <MessageCircle className="size-5 text-muted" />
            <span>Mesajlar</span>
            {unreadMsgCount > 0 && (
              <span className="absolute top-1.5 right-4 size-2 rounded-full bg-primary ring-2 ring-surface" />
            )}
          </Link>
          <Link
            to={user ? "/favoriler" : "/login"}
            onClick={onClose}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg hover:bg-elevated transition-colors text-xs font-medium text-fg"
          >
            <Heart className="size-5 text-muted" />
            <span>Favoriler</span>
          </Link>
          <Link
            to={user ? "/bildirimler" : "/login"}
            onClick={onClose}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg hover:bg-elevated transition-colors text-xs font-medium text-fg relative"
          >
            <Bell className="size-5 text-muted" />
            <span>Bildirimler</span>
            {unreadNoteCount > 0 && (
              <span className="absolute top-1.5 right-4 size-2 rounded-full bg-danger ring-2 ring-surface" />
            )}
          </Link>
        </div>

        {/* Kategoriler Akordeonu */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-2 py-1 text-xs font-bold text-muted uppercase tracking-wider">Kategoriler</p>
          {MAIN_NAV_CATEGORIES.map((cat) => {
            const isExpanded = expandedCategoryId === cat.id;
            return (
              <div key={cat.id} className="rounded-xl border border-border/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 text-left font-semibold text-sm transition-colors",
                    isExpanded ? "bg-elevated text-primary" : "hover:bg-elevated text-fg",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <cat.icon className="size-4 shrink-0 text-muted" />
                    <span>{cat.name}</span>
                  </div>
                  <ChevronDown
                    className={cn("size-4 text-muted transition-transform duration-200", isExpanded && "rotate-180")}
                  />
                </button>

                {isExpanded && (
                  <div className="p-3 bg-surface border-t border-border/60 space-y-3 animate-in fade-in-50 duration-150">
                    <Link
                      to="/search"
                      search={{ category: cat.slug }}
                      onClick={onClose}
                      className="text-xs font-bold text-primary hover:underline block"
                    >
                      Tüm {cat.name} İlanları →
                    </Link>
                    {cat.groups.map((group) => (
                      <div key={group.slug} className="space-y-1">
                        <p className="text-xs font-semibold text-muted">{group.title}</p>
                        <div className="space-y-0.5 pl-2 border-l border-border">
                          {group.items.map((item) => (
                            <Link
                              key={item.name}
                              to="/search"
                              search={{ category: item.slug }}
                              onClick={onClose}
                              className="block py-1 text-xs text-fg/80 hover:text-primary transition-colors"
                            >
                              {item.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Alt Kısım Ek Linkler */}
        <div className="p-3 border-t border-border bg-elevated/40 space-y-1 text-xs text-muted">
          <Link to="/harita" onClick={onClose} className="flex items-center gap-2 p-2 hover:text-fg rounded-lg">
            <MapPin className="size-4" />
            <span>Haritada İlan Ara</span>
          </Link>
          <Link to="/sayfa/$slug" params={{ slug: "yardim" }} onClick={onClose} className="flex items-center gap-2 p-2 hover:text-fg rounded-lg">
            <HelpCircle className="size-4" />
            <span>Yardım & Destek</span>
          </Link>
          {admin && (
            <Link to="/admin" onClick={onClose} className="flex items-center gap-2 p-2 text-warn font-semibold">
              <Shield className="size-4" />
              <span>Yönetici Paneli</span>
            </Link>
          )}
          {user && (
            <button
              type="button"
              onClick={() => {
                onClose();
                void signOut();
              }}
              className="w-full flex items-center gap-2 p-2 text-danger hover:bg-danger/10 rounded-lg text-left font-medium"
            >
              <LogOut className="size-4" />
              <span>Güvenli Çıkış Yap</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Ana Web Navbar Bileşeni (Sabit 2 Katmanlı Yapı)
// ---------------------------------------------------------------------------

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
