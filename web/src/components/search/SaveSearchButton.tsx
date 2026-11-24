import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { errorText } from "@/lib/error-text";
import type { CatalogSearch } from "@/lib/search-params";
import { createSavedSearch, type SavedSearchFilters } from "@/lib/server/saved-searches";
import { useFlag } from "@/lib/use-flag";

function defaultSearchName(search: CatalogSearch, categoryName?: string | null): string {
  const parts: string[] = [];
  if (search.q?.trim()) parts.push(search.q.trim());
  if (categoryName?.trim()) parts.push(categoryName.trim());
  else if (search.category?.trim()) parts.push(search.category.trim());
  const loc = [search.city, search.district].filter(Boolean).join(" / ");
  if (loc) parts.push(loc);
  if (!parts.length) {
    if (search.urgent === "1") parts.push("Acil satılık");
    else if (search.featured === "1") parts.push("Vitrin ilanları");
    else if (search.priceDropped === "1") parts.push("Fiyatı düşenler");
  }
  return (parts.join(" · ") || "Tüm ilanlar").slice(0, 80);
}

function parseOptionalPrice(raw?: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? n : null;
}

function extraFiltersFromSearch(search: CatalogSearch): SavedSearchFilters {
  const out: SavedSearchFilters = {};
  if (search.neighborhood) out.neighborhood = search.neighborhood;
  if (search.sort && search.sort !== "date_desc") out.sort = search.sort;
  if (search.minYear) out.minYear = search.minYear;
  if (search.maxYear) out.maxYear = search.maxYear;
  if (search.minKm) out.minKm = search.minKm;
  if (search.maxKm) out.maxKm = search.maxKm;
  if (search.minM2) out.minM2 = search.minM2;
  if (search.maxM2) out.maxM2 = search.maxM2;
  if (search.urgent === "1") out.urgent = "1";
  if (search.featured === "1") out.featured = "1";
  if (search.postedWithin) out.postedWithin = search.postedWithin;
  if (search.withPhotos === "1") out.withPhotos = "1";
  if (search.sellerType) out.sellerType = search.sellerType;
  if (search.priceDropped === "1") out.priceDropped = "1";
  if (search.attrs) out.attrs = search.attrs;
  return out;
}

/** Saves the active catalog search and optionally notifies on new matching listings. */
export function SaveSearchButton({
  search,
  categoryName,
  className,
}: {
  search: CatalogSearch;
  categoryName?: string | null;
  className?: string;
}) {
  const enabled = useFlag("kayitli_aramalar");
  const { user } = useCurrentUserState();
  const nav = useNavigate();
  const currentHref = useRouterState({ select: (s) => s.location.href });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  function handleOpen() {
    if (!user) {
      toast.message("Aramayı kaydetmek için giriş yapın");
      void nav({ to: "/login", search: { redirect: currentHref || "/search" } });
      return;
    }
    setName(defaultSearchName(search, categoryName));
    setNotify(true);
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await createSavedSearch({
        data: {
          name: trimmed,
          category_slug: search.category ?? null,
          city: search.city ?? null,
          district: search.district ?? null,
          q: search.q ?? null,
          min_price: parseOptionalPrice(search.minPrice),
          max_price: parseOptionalPrice(search.maxPrice),
          filters: extraFiltersFromSearch(search),
          notify,
        },
      });
      toast.success("Arama kaydedildi");
      setOpen(false);
    } catch (err) {
      toast.error(errorText(err, "Arama kaydedilemedi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className={className}
      >
        <Bookmark className="size-3.5" />
        <span>Aramayı kaydet</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="border-border bg-surface sm:max-w-md">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Aramayı kaydet</DialogTitle>
              <DialogDescription>
                Bu arama kriterlerini kaydedin; isterseniz yeni ilan eklendiğinde bildirim alın.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="saved-search-name">Arama adı</Label>
              <Input
                id="saved-search-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                maxLength={80}
                autoFocus
                required
                placeholder="Örn. İstanbul 3+1 Daire"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">Yeni ilan bildirimi</p>
                <p className="text-xs text-muted">Bu aramaya uyan yeni ilan yayınlanınca haber ver</p>
              </div>
              <ToggleSwitch
                label="Yeni ilan bildirimi"
                checked={notify}
                disabled={busy}
                onChange={setNotify}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
