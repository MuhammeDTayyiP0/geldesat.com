import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Car,
  Compass,
  FileQuestion,
  Home,
  MessageCircleQuestion,
  PlusCircle,
  Search,
  ShoppingBag,
  Store,
  UserX,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NotFoundProps {
  title?: string;
  message?: string;
  type?: "general" | "listing" | "category" | "seller" | "store" | "page";
  showSearch?: boolean;
  showCategories?: boolean;
}

const POPULAR_CATEGORIES = [
  { slug: "emlak", label: "Emlak", icon: Building2 },
  { slug: "vasita", label: "Vasıta", icon: Car },
  { slug: "ikinci-el-ve-sifir-alisveris", label: "İkinci El Alışveriş", icon: ShoppingBag },
  { slug: "ustalar-ve-hizmetler", label: "Hizmetler", icon: Wrench },
];

export function NotFound({
  title,
  message,
  type = "general",
  showSearch = true,
  showCategories = true,
}: NotFoundProps) {
  const nav = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    void nav({ to: "/search", search: { q: query.trim() } });
  };

  const getHeading = () => {
    if (title) return title;
    switch (type) {
      case "listing":
        return "İlan Bulunamadı veya Yayından Kaldırıldı";
      case "category":
        return "Kategori Bulunamadı";
      case "seller":
        return "Satıcı Profili Bulunamadı";
      case "store":
        return "Mağaza Bulunamadı";
      case "page":
        return "Kurumsal Sayfa Bulunamadı";
      default:
        return "Aradığınız Sayfaya Ulaşılamadı";
    }
  };

  const getDescription = () => {
    if (message) return message;
    switch (type) {
      case "listing":
        return "Bu ilan satılmış, süresi dolmuş veya sahibi tarafından yayından kaldırılmış olabilir. Benzer ilanlara göz atabilir veya yeni bir arama yapabilirsiniz.";
      case "category":
        return "Ulaşmaya çalıştığınız kategori mevcut değil veya bağlantı adresi değişmiş olabilir.";
      case "seller":
        return "Görüntülemek istediğiniz satıcı hesabı bulunamadı veya kapatılmış olabilir.";
      case "store":
        return "Aradığınız kurumsal mağaza bulunamadı veya bağlantı geçersiz.";
      case "page":
        return "Görüntülemek istediğiniz kurumsal bilgi sayfası bulunamadı.";
      default:
        return "Gitmek istediğiniz sayfa silinmiş, adı değiştirilmiş veya geçici olarak kullanım dışı kalmış olabilir.";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "listing":
        return <FileQuestion className="size-10 sm:size-12 text-primary animate-pulse" />;
      case "seller":
        return <UserX className="size-10 sm:size-12 text-primary" />;
      case "store":
        return <Store className="size-10 sm:size-12 text-primary" />;
      default:
        return <Compass className="size-10 sm:size-12 text-primary animate-spin [animation-duration:12s]" />;
    }
  };

  return (
    <div className="relative min-h-[75vh] flex items-center justify-center px-4 py-12 sm:py-20 overflow-hidden">
      {/* Decorative ambient background blobs */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/8 blur-3xl rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-[300px] h-[250px] bg-primary/5 blur-2xl rounded-full" />

      <div className="relative w-full max-w-2xl mx-auto text-center">
        {/* Visual 404 Badge & Icon */}
        <div className="inline-flex items-center justify-center mb-6">
          <div className="relative flex items-center justify-center size-20 sm:size-24 rounded-3xl bg-surface border border-border shadow-lift">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-primary/10 via-transparent to-primary/5" />
            {getIcon()}
          </div>
        </div>

        {/* 404 Giant typography */}
        <div className="relative select-none mb-3">
          <span className="text-7xl sm:text-9xl font-black tracking-tighter bg-gradient-to-b from-fg/90 via-fg/70 to-fg/20 bg-clip-text text-transparent opacity-90">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest px-3.5 py-1 rounded-full bg-surface/90 border border-border text-primary shadow-sm backdrop-blur-md">
              Sayfa Bulunamadı
            </span>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mb-3">
          {getHeading()}
        </h1>
        <p className="text-sm sm:text-base text-muted max-w-lg mx-auto leading-relaxed mb-8">
          {getDescription()}
        </p>

        {/* Live Search Input Bar */}
        {showSearch && (
          <form
            onSubmit={handleSearch}
            className="relative max-w-md mx-auto mb-8 shadow-card rounded-2xl bg-surface border border-border p-1.5 flex items-center transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
          >
            <div className="pl-3 pr-2 text-muted">
              <Search className="size-4" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="GeldeSat'ta ilan, ürün veya hizmet arayın..."
              className="w-full bg-transparent text-sm text-fg placeholder:text-muted/70 focus:outline-none py-2"
            />
            <Button
              type="submit"
              size="sm"
              className="shrink-0 rounded-xl px-4 font-medium"
            >
              Ara
            </Button>
          </form>
        )}

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-xl gap-2 font-medium shadow-card")}
          >
            <Home className="size-4" />
            Anasayfaya Dön
          </Link>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              } else {
                void nav({ to: "/" });
              }
            }}
            className="rounded-xl gap-2 font-medium bg-surface hover:bg-elevated border-border text-fg"
          >
            <ArrowLeft className="size-4" />
            Geri Dön
          </Button>

          <Link
            to="/ilan-ver"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-xl gap-2 font-medium bg-surface hover:bg-elevated border-border text-primary hover:text-primary")}
          >
            <PlusCircle className="size-4" />
            Ücretsiz İlan Ver
          </Link>
        </div>

        {/* Popular Categories Pill Grid */}
        {showCategories && (
          <div className="pt-8 border-t border-border/80">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
              Popüler Kategorileri Keşfedin
            </p>
            <div className="flex flex-wrap justify-center items-center gap-2">
              {POPULAR_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <Link
                    key={cat.slug}
                    to="/category/$slug"
                    params={{ slug: cat.slug }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface hover:bg-elevated border border-border text-xs sm:text-sm font-medium text-fg hover:border-primary/40 transition-colors shadow-xs"
                  >
                    <IconComponent className="size-3.5 text-primary" />
                    {cat.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Help & Contact Link */}
        <div className="mt-8 text-center">
          <Link
            to="/sayfa/$slug"
            params={{ slug: "iletisim" }}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
          >
            <MessageCircleQuestion className="size-3.5" />
            Bir hata olduğunu mu düşünüyorsunuz? Bize ulaşın.
          </Link>
        </div>
      </div>
    </div>
  );
}

