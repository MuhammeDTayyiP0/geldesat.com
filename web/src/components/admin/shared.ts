import {
  ShieldAlert,
  LayoutDashboard,
  Package,
  Users,
  CreditCard,
  FolderTree,
  Settings,
} from "lucide-react";

export const TABS = [
  { id: "ozet", label: "Genel Bakış", icon: LayoutDashboard },
  { id: "ilan", label: "İlan Moderasyonu", icon: Package },
  { id: "uye", label: "Kullanıcı Yönetimi", icon: Users },
  { id: "finans", label: "Doping & Finans", icon: CreditCard },
  { id: "sikayet", label: "Şikayet Masası", icon: ShieldAlert },
  { id: "kategori", label: "Kategori Ağacı", icon: FolderTree },
  { id: "site", label: "Site Ayarları", icon: Settings },
] as const;

export type Tab = (typeof TABS)[number]["id"];

export type ListingStatusFilter = "ALL" | "PENDING" | "ACTIVE" | "REJECTED";
export type UserRoleFilter = "ALL" | "ADMIN" | "USER";
export type CreditOrderStatusFilter = "ALL" | "PENDING" | "PAID" | "REJECTED";
export type ReportStatusFilter = "ALL" | "OPEN" | "CLOSED";

export const QUICK_REJECT_REASONS = [
  "Yasaklı veya mevzuata aykırı ürün/içerik",
  "Hatalı, eksik veya uyumsuz kategori seçimi",
  "Yanıltıcı veya sembolik fiyat girişi",
  "Görseller yetersiz, kalitesiz veya telifli",
  "Başlık veya açıklamada iletişim bilgisi kural ihlali",
];
