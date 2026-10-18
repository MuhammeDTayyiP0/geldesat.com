import { listCategories } from "@/lib/server/catalog";
import { CategoryAdminTree } from "@/components/listing/CategoryAdminTree";
import type { AdminPanel } from "./use-admin-panel";

/** Admin console — TAB 6: KATEGORİ AĞACI. */
export function CategoriesTab({ panel }: { panel: AdminPanel }) {
  const { cats, setCats } = panel;
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Kategori Hiyerarşi Ağacı</h3>
        <p className="text-xs text-muted mt-0.5">
          Kategorileri düzenleyin, yeni alt kategoriler ekleyin veya silin.
        </p>
      </div>
      <CategoryAdminTree
        categories={cats}
        onRefresh={() => listCategories().then((d) => setCats(d.categories))}
      />
    </div>
  );
}
