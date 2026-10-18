import { useEffect, useState } from "react";
import {
  Ban,
  Bell,
  BellRing,
  FileDown,
  Heart,
  Lock,
  LayoutGrid,
  MessageCircle,
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
  | "/mesajlar"
  | "/bildirimler"
  | "/ayarlar/profil"
  | "/ayarlar/guvenlik"
  | "/ayarlar/magaza"
  | "/ayarlar/gizlilik"
  | "/ayarlar/bildirimler"
  | "/ayarlar/hesap"
  | "/ayarlar/engellenenler"
  | "/admin";

export type AccountNavItem = { to: NavTo; label: string; icon: LucideIcon; badge?: "messages" | "notifications"; hint?: string };

/** The account area's menu, shared by the desktop sidebar and the mobile profile page. */
export const ACCOUNT_SECTIONS: Array<{ title: string; items: AccountNavItem[] }> = [
  {
    title: "Hesabım",
    items: [
      { to: "/profil", label: "Profilim", icon: UserRound },
      { to: "/ilanlarim", label: "İlanlarım", icon: LayoutGrid, hint: "Yayındaki, bekleyen ve pasif ilanlar" },
      { to: "/favoriler", label: "Favorilerim", icon: Heart },
      { to: "/mesajlar", label: "Mesajlar", icon: MessageCircle, badge: "messages" },
      { to: "/bildirimler", label: "Bildirimler", icon: Bell, badge: "notifications" },
    ],
  },
  {
    title: "Ayarlar",
    items: [
      { to: "/ayarlar/profil", label: "Profil bilgileri", icon: UserPen, hint: "Fotoğraf, ad, telefon, konum" },
      { to: "/ayarlar/gizlilik", label: "Gizlilik", icon: Lock, hint: "Telefonumu kimler görebilir, WhatsApp" },
      { to: "/ayarlar/bildirimler", label: "Bildirim tercihleri", icon: BellRing, hint: "Mesaj, favori, ilan durumu" },
      { to: "/ayarlar/engellenenler", label: "Engellenenler", icon: Ban, hint: "Mesajlaşmayı engellediğiniz kişiler" },
      { to: "/ayarlar/guvenlik", label: "Hesap ve güvenlik", icon: ShieldCheck, hint: "E-posta, şifre, oturumlar" },
      { to: "/ayarlar/magaza", label: "Mağazam", icon: Store, hint: "Kurumsal mağaza bilgileri ve başvuru" },
      { to: "/ayarlar/hesap", label: "Verilerim ve hesabım", icon: FileDown, hint: "Verilerimi indir, hesabı sil" },
    ],
  },
];

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

