import {
  Briefcase,
  Building2,
  Car,
  Cog,
  Folder,
  GraduationCap,
  PawPrint,
  ShoppingBag,
  Tractor,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Icon keys stored in categories.icon (shared with the mobile app). */
/** `tint` is the category's accent colour, the same as in the app (mobile-app/src/features/catalog/categoryIcon.ts). */
export const CATEGORY_ICONS: Array<{ key: string; label: string; icon: LucideIcon; tint: string; darkTint: string }> = [
  { key: "home", label: "Emlak (ev)", icon: Building2, tint: "#1a4fd8", darkTint: "#60a5fa" },
  { key: "car", label: "Vasıta (araba)", icon: Car, tint: "#d92d20", darkTint: "#f97066" },
  { key: "bag", label: "Alışveriş (çanta)", icon: ShoppingBag, tint: "#7a5af8", darkTint: "#a78bfa" },
  { key: "cog", label: "Yedek parça (dişli)", icon: Cog, tint: "#475467", darkTint: "#cbd5e1" },
  { key: "tractor", label: "İş makinesi (traktör)", icon: Tractor, tint: "#b54708", darkTint: "#fb923c" },
  { key: "wrench", label: "Hizmet (anahtar)", icon: Wrench, tint: "#0e9384", darkTint: "#2dd4bf" },
  { key: "grad", label: "Eğitim (kep)", icon: GraduationCap, tint: "#6941c6", darkTint: "#c084fc" },
  { key: "briefcase", label: "İş (çanta)", icon: Briefcase, tint: "#1f7a4d", darkTint: "#4ade80" },
  { key: "users", label: "Kişiler", icon: Users, tint: "#c11574", darkTint: "#f472b6" },
  { key: "paw", label: "Hayvanlar (pati)", icon: PawPrint, tint: "#ca8504", darkTint: "#fbbf24" },
];

const BY_KEY = new Map(CATEGORY_ICONS.map((i) => [i.key, i]));

export function categoryIcon(key: string | null | undefined): LucideIcon {
  return (key && BY_KEY.get(key)?.icon) || Folder;
}

/** Icon and accent colour for a category's icon key (light + dark theme tints). */
export function categoryVisual(key: string | null | undefined): { icon: LucideIcon; tint: string; darkTint: string } {
  const hit = key ? BY_KEY.get(key) : undefined;
  return hit ? { icon: hit.icon, tint: hit.tint, darkTint: hit.darkTint } : { icon: Folder, tint: "#1a4fd8", darkTint: "#60a5fa" };
}
