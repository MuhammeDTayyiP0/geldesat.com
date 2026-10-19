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
export const CATEGORY_ICONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "home", label: "Emlak (ev)", icon: Building2 },
  { key: "car", label: "Vasıta (araba)", icon: Car },
  { key: "bag", label: "Alışveriş (çanta)", icon: ShoppingBag },
  { key: "cog", label: "Yedek parça (dişli)", icon: Cog },
  { key: "tractor", label: "İş makinesi (traktör)", icon: Tractor },
  { key: "wrench", label: "Hizmet (anahtar)", icon: Wrench },
  { key: "grad", label: "Eğitim (kep)", icon: GraduationCap },
  { key: "briefcase", label: "İş (çanta)", icon: Briefcase },
  { key: "users", label: "Kişiler", icon: Users },
  { key: "paw", label: "Hayvanlar (pati)", icon: PawPrint },
];

const BY_KEY = new Map(CATEGORY_ICONS.map((i) => [i.key, i.icon]));

export function categoryIcon(key: string | null | undefined): LucideIcon {
  return (key && BY_KEY.get(key)) || Folder;
}
