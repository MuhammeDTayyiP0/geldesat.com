import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Bookmark,
  Heart,
  History,
  Lock,
  LayoutGrid,
  MessageCircle,
  MessageSquareText,
  ShieldCheck,
  UserCheck,
  UserPen,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isAdminSession } from "@/lib/server/account";
import { useUnread } from "@/lib/unread-store";

type NavTo =
  | "/profil"
  | "/ilanlarim"
  | "/favoriler"
  | "/son-bakilanlar"
  | "/mesajlar"
  | "/bildirimler"
  | "/ayarlar"
  | "/ayarlar/profil"
  | "/ayarlar/guvenlik"
  | "/ayarlar/gizlilik"
  | "/ayarlar/bildirimler"
  | "/ayarlar/kayitli-aramalar"
  | "/ayarlar/takip-ettiklerim"
  | "/ayarlar/sablonlar"
  | "/admin";

export type AccountNavItem = { to: NavTo; label: string; icon: LucideIcon; badge?: "messages" | "notifications"; hint?: string };

/** "Hesabım": the person's own things (desktop sidebar and the account hub). */
export const ACCOUNT_ITEMS: AccountNavItem[] = [
  { to: "/profil", label: "Hesabım", icon: UserRound },
  { to: "/ilanlarim", label: "İlanlarım", icon: LayoutGrid, hint: "Yayındaki, bekleyen ve pasif ilanlar" },
  { to: "/favoriler", label: "Favorilerim", icon: Heart, hint: "Kaydettiğiniz ilanlar" },
  { to: "/ayarlar/kayitli-aramalar", label: "Kayıtlı aramalarım", icon: Bookmark, hint: "Kaydettiğiniz aramalar ve yeni ilan bildirimleri" },
  { to: "/ayarlar/takip-ettiklerim", label: "Takip ettiklerim", icon: UserCheck, hint: "Takip ettiğiniz satıcılar" },
  { to: "/son-bakilanlar", label: "Son baktıklarım", icon: History, hint: "Son incelediğiniz 50 ilan" },
  { to: "/mesajlar", label: "Mesajlar", icon: MessageCircle, badge: "messages", hint: "Alıcı ve satıcılarla yazışmalar" },
  { to: "/bildirimler", label: "Bildirimler", icon: Bell, badge: "notifications", hint: "Mesaj, favori ve ilan durumu" },
];

/** The settings page (/ayarlar), grouped like a phone's settings app. */
export const SETTINGS_SECTIONS: Array<{ title: string; items: AccountNavItem[] }> = [
  {
    title: "Hesap",
    items: [
      { to: "/ayarlar/profil", label: "Profil bilgileri", icon: UserPen, hint: "Fotoğraf, ad, telefon, konum, biyografi" },
      { to: "/ayarlar/guvenlik", label: "Hesap ve güvenlik", icon: ShieldCheck, hint: "E-posta, şifre, oturumlar, veri indir, hesabı sil" },
    ],
  },
  {
    title: "Gizlilik ve iletişim",
    items: [
      { to: "/ayarlar/gizlilik", label: "Gizlilik ve engellenenler", icon: Lock, hint: "Telefon görünürlüğü, okundu bilgisi, engellenenler" },
      { to: "/ayarlar/bildirimler", label: "Bildirimler", icon: BellRing, hint: "Mesaj, favori, ilan durumu" },
      { to: "/ayarlar/sablonlar", label: "Hazır mesajlarım", icon: MessageSquareText, hint: "Sohbette tek tıkla gönderilecek kalıp mesajlar" },
    ],
  },
];

export const SETTINGS_ITEMS: AccountNavItem[] = SETTINGS_SECTIONS.flatMap((s) => s.items);

/** Unread counters and admin flag for the account menu. */
export function useAccountMeta() {
  const { user } = useCurrentUserState();
  const counts = useUnread();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    let alive = true;
    isAdminSession()
      .then((a) => alive && setAdmin(Boolean(a)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);
  return { counts, admin };
}

