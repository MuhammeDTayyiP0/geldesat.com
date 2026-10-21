import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  FolderTree,
  History,
  LayoutList,
  ListChecks,
  Megaphone,
  MessageSquareWarning,
  Rocket,
  Settings2,
  SlidersHorizontal,
  Star,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminPath =
  | "/admin"
  | "/admin/moderasyon"
  | "/admin/ilanlar"
  | "/admin/sikayetler"
  | "/admin/yorumlar"
  | "/admin/kategoriler"
  | "/admin/ozellikler"
  | "/admin/kullanicilar"
  | "/admin/magazalar"
  | "/admin/finans"
  | "/admin/duyurular"
  | "/admin/sayfalar"
  | "/admin/ayarlar"
  | "/admin/guncellemeler"
  | "/admin/kayitlar"
  | "/admin/sistem";

export type AdminNavItem = {
  to: AdminPath;
  label: string;
  icon: LucideIcon;
  badge?: "pending" | "reports" | "orders";
  keywords?: string;
};

export const ADMIN_NAV: Array<{ group: string; items: AdminNavItem[] }> = [
  {
    group: "Genel",
    items: [{ to: "/admin", label: "Kontrol paneli", icon: BarChart3, keywords: "dashboard özet istatistik" }],
  },
  {
    group: "İçerik",
    items: [
      { to: "/admin/moderasyon", label: "Onay kuyruğu", icon: ListChecks, badge: "pending", keywords: "moderasyon onay bekleyen" },
      { to: "/admin/ilanlar", label: "İlanlar", icon: LayoutList, keywords: "ilan listesi" },
      { to: "/admin/sikayetler", label: "Şikayetler", icon: MessageSquareWarning, badge: "reports", keywords: "rapor bildirim" },
      { to: "/admin/yorumlar", label: "Değerlendirmeler", icon: Star, keywords: "yorum puan" },
    ],
  },
  {
    group: "Katalog",
    items: [
      { to: "/admin/kategoriler", label: "Kategori ağacı", icon: FolderTree, keywords: "kategori hiyerarşi" },
      { to: "/admin/ozellikler", label: "İlan özellikleri", icon: SlidersHorizontal, keywords: "özellik attribute filtre" },
    ],
  },
  {
    group: "Üyeler",
    items: [
      { to: "/admin/kullanicilar", label: "Kullanıcılar", icon: Users, keywords: "üye hesap" },
      { to: "/admin/magazalar", label: "Mağazalar", icon: Store, keywords: "kurumsal mağaza" },
    ],
  },
  {
    group: "Gelir & iletişim",
    items: [
      { to: "/admin/finans", label: "Ödemeler & kredi", icon: CreditCard, badge: "orders", keywords: "havale doping finans" },
      { to: "/admin/duyurular", label: "Duyurular", icon: Megaphone, keywords: "bildirim gönder push" },
      { to: "/admin/sayfalar", label: "Kurumsal sayfalar", icon: FileText, keywords: "kvkk sözleşme içerik" },
    ],
  },
  {
    group: "Sistem",
    items: [
      { to: "/admin/ayarlar", label: "Ayarlar", icon: Settings2, keywords: "site iletişim banka mobil özellik anahtarı flag" },
      { to: "/admin/guncellemeler", label: "Uygulama güncellemeleri", icon: Rocket, keywords: "ota mobil güncelleme sürüm geri al" },
      { to: "/admin/kayitlar", label: "İşlem kayıtları", icon: History, keywords: "audit log denetim" },
      { to: "/admin/sistem", label: "Sistem durumu", icon: Activity, keywords: "veritabanı sağlık bakım" },
    ],
  },
];

export const ALL_NAV_ITEMS = ADMIN_NAV.flatMap((g) => g.items);
