import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, MoreHorizontal, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initials, n, type Tone } from "./format";

/* ───────────────────────────── Layout bits ───────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-primary shadow-xs sm:flex">
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface shadow-xs", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHead({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

const PILL: Record<Tone, string> = {
  muted: "bg-elevated text-muted ring-border",
  primary: "bg-primary/8 text-primary ring-primary/20",
  ok: "bg-ok/8 text-ok ring-ok/20",
  warn: "bg-warn/10 text-warn ring-warn/25",
  danger: "bg-danger/8 text-danger ring-danger/20",
  ink: "bg-ink text-white ring-ink",
  violet: "bg-violet-500/10 text-violet-700 ring-violet-500/20",
};

export function Pill({ tone = "muted", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", PILL[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function Avatar({ name, src, size = 32, className }: { name: string | null | undefined; src?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  if (src && !failed) {
    return <img src={src} alt="" style={style} onError={() => setFailed(true)} className={cn("shrink-0 rounded-full border border-border object-cover", className)} />;
  }
  return (
    <span style={style} className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary", className)}>
      {initials(name)}
    </span>
  );
}

export function Thumb({ src, className, alt = "" }: { src: string | null | undefined; className?: string; alt?: string }) {
  if (!src) {
    return <div className={cn("flex shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-[10px] text-subtle", className)}>Foto yok</div>;
  }
  return <img src={src} alt={alt} loading="lazy" className={cn("shrink-0 rounded-lg border border-border bg-elevated object-cover", className)} />;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  onClick,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  onClick?: () => void;
  trend?: number | null;
}) {
  const iconTone: Record<Tone, string> = {
    muted: "bg-elevated text-muted",
    primary: "bg-primary/10 text-primary",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger/10 text-danger",
    ink: "bg-ink text-white",
    violet: "bg-violet-500/10 text-violet-700",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-surface p-4 text-left shadow-xs",
        onClick && "transition-[box-shadow,border-color] hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", iconTone[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
        {trend != null ? (
          <span className={cn("font-semibold", trend > 0 ? "text-ok" : trend < 0 ? "text-danger" : "text-muted")}>
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "•"} %{Math.abs(trend)}
          </span>
        ) : null}
        {hint ? <span className="truncate">{hint}</span> : null}
      </div>
    </Comp>
  );
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: ReactNode; icon?: React.ComponentType<{ className?: string }>; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-elevated text-subtle">
        <Icon className="size-6" />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="size-6" />
      </span>
      <p className="mt-3 text-sm font-semibold">Veriler yüklenemedi</p>
      <p className="mt-1 max-w-sm text-xs text-muted">{error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu."}</p>
      {onRetry ? (
        <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
          Tekrar dene
        </Button>
      ) : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-border", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-10 animate-pulse rounded-lg bg-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-elevated" />
            <div className="h-2.5 w-1/5 animate-pulse rounded bg-elevated" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-elevated" />
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Inputs ───────────────────────────── */

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Search box that reports its value after the user stops typing. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Ara…",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebounced(draft, 350);
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setDraft(value);
    }
  }, [value]);
  useEffect(() => {
    if (debounced !== last.current) {
      last.current = debounced;
      onChange(debounced);
    }
  }, [debounced, onChange]);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            last.current = draft;
            onChange(draft);
          }
          if (e.key === "Escape" && draft) {
            setDraft("");
          }
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-8 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Temizle"
          onClick={() => {
            setDraft("");
            last.current = "";
            onChange("");
          }}
          className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-subtle hover:bg-elevated hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function SelectBox({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("admin-select", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, hint, children, className, error }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; error?: string | null }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-fg">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
export const textareaClass =
  "min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

/** Pill tabs for status filters, with counts. */
export function Segmented<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ value: T; label: string; count?: number; tone?: Tone }>;
  className?: string;
}) {
  return (
    <div className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
              active ? "bg-ink text-white shadow-xs" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            {item.label}
            {item.count != null ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                  active ? "bg-white/20 text-white" : item.tone === "warn" && item.count > 0 ? "bg-warn/15 text-warn" : item.tone === "danger" && item.count > 0 ? "bg-danger/10 text-danger" : "bg-elevated text-muted",
                )}
              >
                {n(item.count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize?: (s: number) => void;
}) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted">
      <div className="flex items-center gap-3">
        <span>
          <span className="font-semibold text-fg tabular-nums">
            {n(from)}–{n(to)}
          </span>{" "}
          / {n(total)} kayıt
        </span>
        {onPageSize ? (
          <SelectBox
            label="Sayfa boyutu"
            value={String(pageSize)}
            onChange={(v) => onPageSize(Number(v))}
            options={[25, 50, 100].map((s) => ({ value: String(s), label: `${s} / sayfa` }))}
            className="h-8 text-xs"
          />
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-fg disabled:opacity-40"
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 tabular-nums">
          <span className="font-semibold text-fg">{page}</span> / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-fg disabled:opacity-40"
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 cursor-pointer rounded border-border accent-primary"
    />
  );
}

/** Floating bar for actions on the selected rows. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return (
    <div className="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-ink px-3 py-2 text-sm text-white shadow-2xl">
      <span className="px-1 font-semibold tabular-nums">{n(count)} seçili</span>
      <span className="h-5 w-px bg-white/20" />
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      <button type="button" onClick={onClear} className="ml-1 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Seçimi temizle">
        <X className="size-4" />
      </button>
    </div>
  );
}

export function BulkButton({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors", danger ? "text-red-300 hover:bg-red-500/20" : "hover:bg-white/10")}
    >
      {children}
    </button>
  );
}

/* ───────────────────────────── Table ───────────────────────────── */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap border-b border-border bg-elevated/50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted first:pl-4 last:pr-4", className)}>{children}</th>;
}

export function Td({ children, className, onClick }: { children?: ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <td onClick={onClick} className={cn("border-b border-border px-3 py-2.5 align-middle first:pl-4 last:pr-4", className)}>
      {children}
    </td>
  );
}

/* ───────────────────────────── Menu ───────────────────────────── */

export function Menu({ trigger, children, align = "end" }: { trigger?: ReactNode; children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg data-[state=open]:bg-elevated data-[state=open]:text-fg"
            aria-label="İşlemler"
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          align={align}
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-[70] max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-52 overflow-y-auto rounded-xl border border-border bg-surface p-1 text-sm shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {children}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon: Icon,
  danger,
  disabled,
  shortcut,
}: {
  children: ReactNode;
  onSelect: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <MenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        danger ? "text-danger data-[highlighted]:bg-danger/8" : "text-fg data-[highlighted]:bg-elevated",
      )}
    >
      {Icon ? <Icon className={cn("size-4", danger ? "text-danger" : "text-muted")} /> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <kbd className="text-[10px] text-subtle">{shortcut}</kbd> : null}
    </MenuPrimitive.Item>
  );
}

export function MenuSeparator() {
  return <MenuPrimitive.Separator className="my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <MenuPrimitive.Label className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">{children}</MenuPrimitive.Label>;
}

/* ───────────────────────────── Dialogs ───────────────────────────── */

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-surface shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{String(title)}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg" aria-label="Kapat">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-elevated/40 px-5 py-3">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Right-hand detail panel. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  width = "max-w-3xl",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-ink/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-[61] flex w-full flex-col border-l border-border bg-bg shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            width,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function SheetHeader({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-border bg-surface px-5 py-4">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg" aria-label="Kapat">
        <X className="size-5" />
      </button>
    </div>
  );
}

/* ───────────────────────────── Confirm / prompt ───────────────────────────── */

type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
};

type PromptOptions = ConfirmOptions & {
  label?: string;
  placeholder?: string;
  presets?: string[];
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
};

type DialogState =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOptions);

const ConfirmContext = createContext<{
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
} | null>(null);

/** `confirm()` / `prompt()` as promises, rendered with the console's own dialog. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [text, setText] = useState("");

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ kind: "confirm", resolve, ...o })), []);
  const prompt = useCallback(
    (o: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setText(o.defaultValue ?? "");
        setState({ kind: "prompt", resolve, ...o });
      }),
    [],
  );
  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  function close(result: boolean) {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(result);
    else state.resolve(result ? text.trim() : null);
    setState(null);
  }

  const promptInvalid = state?.kind === "prompt" && state.required !== false && !text.trim();

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(state)}
        onOpenChange={(o) => {
          if (!o) close(false);
        }}
        title={state?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => close(false)}>
              Vazgeç
            </Button>
            <Button variant={state?.danger ? "danger" : "default"} size="sm" disabled={promptInvalid} onClick={() => close(true)}>
              {state?.confirmLabel ?? "Onayla"}
            </Button>
          </>
        }
      >
        {state?.body ? <div className="text-sm text-muted">{state.body}</div> : null}
        {state?.kind === "prompt" ? (
          <div className={cn(state.body ? "mt-4" : "", "space-y-3")}>
            {state.presets?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {state.presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setText(p)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                      text === p ? "border-primary bg-primary/8 text-primary" : "border-border text-muted hover:border-primary/40 hover:text-fg",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : null}
            <Field label={state.label ?? "Açıklama"}>
              {state.multiline === false ? (
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={state.placeholder}
                  className={inputClass}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !promptInvalid) close(true);
                  }}
                />
              ) : (
                <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={state.placeholder} className={textareaClass} rows={3} />
              )}
            </Field>
          </div>
        ) : null}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}

/* ───────────────────────────── Misc ───────────────────────────── */

export function KeyValue({ items, className }: { items: Array<{ label: string; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-subtle">{item.label}</dt>
          <dd className="mt-0.5 break-words text-fg">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MiniStat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn("mt-0.5 text-lg font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

export function TabBar<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none]">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium transition-colors",
            item.value === value ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {item.label}
          {item.count != null ? <span className="rounded-full bg-elevated px-1.5 text-[10px] tabular-nums text-muted">{n(item.count)}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 font-sans text-[10px] font-semibold text-muted shadow-xs">{children}</kbd>;
}
