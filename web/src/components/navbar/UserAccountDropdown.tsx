import { Link } from "@tanstack/react-router";
import { Bell, ChevronDown, Heart, History, LayoutGrid, LogOut, MessageCircle, Settings, Shield, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export function UserAccountDropdown({ admin }: { admin: boolean }) {
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
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
              to="/profil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <User className="size-4 text-muted shrink-0" />
              <span>Profilim</span>
            </Link>

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
              to="/son-bakilanlar"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <History className="size-4 text-muted shrink-0" />
              <span>Son baktıklarım</span>
            </Link>

            <Link
              to="/bildirimler"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <Bell className="size-4 text-muted shrink-0" />
              <span>Bildirimler</span>
            </Link>

            <Link
              to="/ayarlar/profil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg hover:bg-elevated rounded-lg transition-colors"
            >
              <Settings className="size-4 text-muted shrink-0" />
              <span>Ayarlar</span>
            </Link>

            {admin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-warn hover:bg-elevated rounded-lg transition-colors font-medium"
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
