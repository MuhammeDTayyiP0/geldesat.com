import { useEffect, useState } from "react";
import {
  Ban,
  Bell,
  BellRing,
  FileDown,
  Heart,
  History,
  Lock,
  LayoutGrid,
  MessageCircle,
  Palette,
  ShieldCheck,
  Store,
  UserPen,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isAdminSession } from "@/lib/server/account";
import { unreadCount } from "@/lib/server/social";

type NavTo =
  | "/profil"
  | "/ilanlarim"
  | "/favoriler"
  | "/son-bakilanlar"
  | "/mesajlar"
  | "/bildirimler"
  | "/ayarlar"
  | "/ayarlar/profil"
  | "/ayarlar/gorunum"
  | "/ayarlar/guvenlik"
  | "/ayarlar/magaza"
  | "/ayarlar/gizlilik"
  | "/ayarlar/bildirimler"
  | "/ayarlar/hesap"
  | "/ayarlar/engellenenler"
  | "/admin";

export type AccountNavItem = { to: NavTo; label: string; icon: LucideIcon; badge?: "messages" | "notifications"; hint?: string };

/** "Hesabım": the person's own things (desktop sidebar and the account hub). */
export const ACCOUNT_ITEMS: AccountNavItem[] = [
  { to: "/profil", label: "Hesabım", icon: UserRound },
  { to: "/ilanlarim", label: "İlanlarım", icon: LayoutGrid, hint: "Yayındaki, bekleyen ve pasif ilanlar" },
  { to: "/favoriler", label: "Favorilerim", icon: Heart, hint: "Kaydettiğiniz ilanlar" },
  { to: "/son-bakilanlar", label: "Son baktıklarım", icon: History, hint: "Son incelediğiniz 50 ilan" },
  { to: "/mesajlar", label: "Mesajlar", icon: MessageCircle, badge: "messages", hint: "Alıcı ve satıcılarla yazışmalar" },
  { to: "/bildirimler", label: "Bildirimler", icon: Bell, badge: "notifications", hint: "Mesaj, favori ve ilan durumu" },
];

/** The settings page (/ayarlar), grouped like a phone's settings app. */
export const SETTINGS_SECTIONS: Array<{ title: string; items: AccountNavItem[] }> = [
  {
    title: "Hesap",
    items: [
      { to: "/ayarlar/profil", label: "Profil bilgileri", icon: UserPen, hint: "Fotoğraf, ad, telefon, konum" },
      { to: "/ayarlar/guvenlik", label: "Şifre ve güvenlik", icon: ShieldCheck, hint: "E-posta, şifre, oturumlar" },
      { to: "/ayarlar/hesap", label: "Verilerim ve hesabım", icon: FileDown, hint: "Verilerimi indir, hesabı sil" },
    ],
  },
  {
    title: "Tercihler",
    items: [
      { to: "/ayarlar/gorunum", label: "Görünüm", icon: Palette, hint: "Açık, koyu veya cihaz ayarı" },
      { to: "/ayarlar/bildirimler", label: "Bildirimler", icon: BellRing, hint: "Mesaj, favori, ilan durumu" },
      { to: "/ayarlar/gizlilik", label: "Gizlilik", icon: Lock, hint: "Telefonumu kimler görebilir, WhatsApp" },
      { to: "/ayarlar/engellenenler", label: "Engellenenler", icon: Ban, hint: "Mesajlaşmayı engellediğiniz kişiler" },
    ],
  },
  {
    title: "İşletme",
    items: [{ to: "/ayarlar/magaza", label: "Mağazam", icon: Store, hint: "Kurumsal mağaza bilgileri ve başvuru" }],
  },
];

export const SETTINGS_ITEMS: AccountNavItem[] = SETTINGS_SECTIONS.flatMap((s) => s.items);

/** Unread counters and admin flag for the account menu. */
export function useAccountMeta() {
  const { user } = useCurrentUserState();
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    unreadCount()
      .then((c) => alive && setCounts(c))
      .catch(() => undefined);
    isAdminSession()
      .then((a) => alive && setAdmin(Boolean(a)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);
  return { counts, admin };
}

