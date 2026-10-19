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
} from 'lucide-react-native';

/** Icon keys stored in categories.icon (same list as web/src/components/admin/categories/icons.ts). */
const ICONS: Record<string, { icon: LucideIcon; tint: string }> = {
  home: { icon: Building2, tint: '#1a4fd8' },
  car: { icon: Car, tint: '#d92d20' },
  bag: { icon: ShoppingBag, tint: '#7a5af8' },
  cog: { icon: Cog, tint: '#475467' },
  tractor: { icon: Tractor, tint: '#b54708' },
  wrench: { icon: Wrench, tint: '#0e9384' },
  grad: { icon: GraduationCap, tint: '#6941c6' },
  briefcase: { icon: Briefcase, tint: '#1f7a4d' },
  users: { icon: Users, tint: '#c11574' },
  paw: { icon: PawPrint, tint: '#ca8504' },
};

export function categoryIcon(key: string | null | undefined): { icon: LucideIcon; tint: string } {
  return (key && ICONS[key]) || { icon: Folder, tint: '#1a4fd8' };
}
