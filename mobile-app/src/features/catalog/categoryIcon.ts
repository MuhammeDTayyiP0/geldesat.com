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

/** Lighter tints for the dark theme: the light ones fall to about 2.3:1 on a dark card. */
const DARK_TINTS: Record<string, string> = {
  home: '#6f95ff',
  car: '#f97066',
  bag: '#a48afb',
  cog: '#98a2b3',
  tractor: '#f79009',
  wrench: '#2ed3b7',
  grad: '#b692f6',
  briefcase: '#47cd89',
  users: '#f670c7',
  paw: '#fac515',
};

export function categoryIcon(key: string | null | undefined, dark = false): { icon: LucideIcon; tint: string } {
  const found = key ? ICONS[key] : undefined;
  if (!found) return { icon: Folder, tint: dark ? '#6f95ff' : '#1a4fd8' };
  return dark ? { icon: found.icon, tint: DARK_TINTS[key as string] ?? found.tint } : found;
}
