import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  History,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MAIN_NAV_CATEGORIES, POPULAR_SEARCH_TERMS, RECENT_SEARCHES_KEY } from "./nav-data";

export function AutocompleteSearchBar({
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
