import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Heart,
  HelpCircle,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";
import { MAIN_NAV_CATEGORIES } from "./nav-data";

export function MobileNavigationDrawer({
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
            className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-xl font-bold text-sm text-primary-fg bg-primary hover:bg-primary/90 shadow-md active:scale-98 transition-all"
          >
            <Plus className="size-5 stroke-[2.5]" />
            <span>Ücretsiz İlan Ver</span>
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
