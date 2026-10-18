import { Link } from "@tanstack/react-router";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { MAIN_NAV_CATEGORIES } from "./nav-data";
import type { MegaCategory } from "./nav-data";

export function MegaMenuOverlay({
  activeCategory,
  onClose,
}: {
  activeCategory: MegaCategory;
  onClose: () => void;
}) {
  return (
    <div
      onMouseLeave={onClose}
      className="absolute left-0 right-0 top-full z-40 bg-surface/98 backdrop-blur-xl border-b border-border shadow-lift py-6 px-4 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <activeCategory.icon className="size-5" />
            </span>
            <h3 className="text-base font-bold text-fg">{activeCategory.name}</h3>
            {activeCategory.badge && (
              <span className="px-2 py-0.5 text-[11px] font-semibold text-primary bg-primary/10 rounded-full">
                {activeCategory.badge}
              </span>
            )}
          </div>
          <Link
            to="/search"
            search={{ category: activeCategory.slug }}
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Tüm {activeCategory.name} İlanlarını Görüntüle</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {/* Çok Sütunlu Alt Kategori Listeleri */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {activeCategory.groups.map((group) => (
            <div key={group.slug} className="space-y-2.5">
              <Link
                to="/search"
                search={{ category: group.slug }}
                onClick={onClose}
                className="text-xs font-bold uppercase tracking-wider text-muted hover:text-primary transition-colors flex items-center justify-between group"
              >
                <span>{group.title}</span>
                <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
              </Link>
              <ul className="space-y-1.5 border-l-2 border-border/60 pl-3">
                {group.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      to="/search"
                      search={{ category: item.slug }}
                      onClick={onClose}
                      className="text-sm text-fg/80 hover:text-primary hover:font-medium transition-colors block py-0.5"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// "Tüm Kategoriler" Özel Mega Menüsü
export function AllCategoriesMegaMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      onMouseLeave={onClose}
      className="absolute left-0 right-0 top-full z-40 bg-surface/98 backdrop-blur-xl border-b border-border shadow-lift py-6 px-4 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/70">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-5 text-primary" />
            <h3 className="text-base font-bold text-fg">Tüm Kategoriler</h3>
          </div>
          <Link
            to="/search"
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Gelişmiş Arama & Filtreler</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {MAIN_NAV_CATEGORIES.map((cat) => (
            <div key={cat.id} className="p-3 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-elevated/40 transition-all group">
              <Link
                to="/search"
                search={{ category: cat.slug }}
                onClick={onClose}
                className="flex items-center gap-2.5 mb-2 font-bold text-sm text-fg group-hover:text-primary transition-colors"
              >
                <span className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-fg transition-colors">
                  <cat.icon className="size-4" />
                </span>
                <span>{cat.name}</span>
              </Link>
              <div className="space-y-1 pl-8">
                {cat.groups.flatMap((g) => g.items).slice(0, 4).map((subItem) => (
                  <Link
                    key={subItem.name}
                    to="/search"
                    search={{ category: subItem.slug }}
                    onClick={onClose}
                    className="block text-xs text-muted hover:text-fg truncate py-0.5"
                  >
                    {subItem.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Mobil Hamburger Drawer (Slide-Over Panel)
// ---------------------------------------------------------------------------
