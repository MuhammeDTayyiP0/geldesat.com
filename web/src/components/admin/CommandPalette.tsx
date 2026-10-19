import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, FolderTree, LayoutList, Search, Store, User } from "lucide-react";
import { adminGlobalSearch } from "@/lib/server/admin/dashboard";
import { useSheets } from "./hooks";
import { ALL_NAV_ITEMS } from "./nav";
import { LISTING_STATUS } from "./format";
import { Kbd, Spinner, useDebounced } from "./ui";

const GROUP =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle";

/** Ctrl/⌘+K: jump to any screen, listing (by number or title), member, category or store. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 250);
  const navigate = useNavigate();
  const { openListing, openUser } = useSheets();

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const search = useQuery({
    queryKey: ["admin", "palette", term],
    queryFn: () => adminGlobalSearch({ data: { q: term } }),
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  });

  const needle = q.trim().toLocaleLowerCase("tr");
  const pages = useMemo(
    () => ALL_NAV_ITEMS.filter((i) => !needle || `${i.label} ${i.keywords ?? ""}`.toLocaleLowerCase("tr").includes(needle)),
    [needle],
  );

  function go(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  const r = search.data;
  const item = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-primary/8 aria-selected:text-primary";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-ink/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-[91] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl outline-none">
          <DialogPrimitive.Title className="sr-only">Hızlı arama</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Sayfa, ilan, üye veya kategori arayın</DialogPrimitive.Description>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-subtle" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder="İlan no, başlık, üye e-postası, kategori…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              />
              {search.isFetching ? <Spinner className="text-subtle" /> : <Kbd>Esc</Kbd>}
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">{term.length >= 2 && !search.isFetching ? "Sonuç bulunamadı." : "Aramak için yazın."}</Command.Empty>
              {pages.length ? (
                <Command.Group heading="Sayfalar" className={GROUP}>
                  {pages.map((p) => (
                    <Command.Item key={p.to} value={`page:${p.to}`} onSelect={() => go(() => void navigate({ to: p.to }))} className={item}>
                      <p.icon className="size-4 text-muted" />
                      <span className="flex-1">{p.label}</span>
                      <CornerDownLeft className="size-3.5 text-subtle" />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {r?.listings.length ? (
                <Command.Group heading="İlanlar" className={GROUP}>
                  {r.listings.map((l) => (
                    <Command.Item key={l.id} value={`listing:${l.id}`} onSelect={() => go(() => openListing(l.id))} className={item}>
                      <LayoutList className="size-4 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      <span className="font-mono text-xs text-muted">#{l.listing_no}</span>
                      <span className="text-[11px] text-subtle">{LISTING_STATUS[l.status]?.label ?? l.status}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {r?.users.length ? (
                <Command.Group heading="Üyeler" className={GROUP}>
                  {r.users.map((u) => (
                    <Command.Item key={u.user_id} value={`user:${u.user_id}`} onSelect={() => go(() => openUser(u.user_id))} className={item}>
                      <User className="size-4 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{u.display_name}</span>
                      <span className="truncate text-xs text-muted">{u.email}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {r?.categories.length ? (
                <Command.Group heading="Kategoriler" className={GROUP}>
                  {r.categories.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`category:${c.id}`}
                      onSelect={() => go(() => void navigate({ to: "/admin/kategoriler", search: { id: c.id } }))}
                      className={item}
                    >
                      <FolderTree className="size-4 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      {c.parent_name ? <span className="truncate text-xs text-muted">{c.parent_name}</span> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {r?.stores.length ? (
                <Command.Group heading="Mağazalar" className={GROUP}>
                  {r.stores.map((s) => (
                    <Command.Item key={s.id} value={`store:${s.id}`} onSelect={() => go(() => void navigate({ to: "/admin/magazalar", search: { q: s.name } }))} className={item}>
                      <Store className="size-4 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="text-xs text-muted">/{s.slug}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
            <div className="flex items-center gap-3 border-t border-border bg-elevated/40 px-4 py-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> gezin
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>↵</Kbd> aç
              </span>
              <span className="ml-auto">İlan numarasıyla doğrudan arayabilirsiniz</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
