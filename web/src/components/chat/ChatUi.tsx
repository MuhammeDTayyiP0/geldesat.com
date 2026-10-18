import { useState, type ComponentProps, type ReactNode } from "react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Dropdown panel styled with the site's tokens. */
export function MenuContent({ className, ...props }: ComponentProps<typeof DropdownMenuContent>) {
  return <DropdownMenuContent className={cn("min-w-48 rounded-xl border-border bg-surface p-1 text-fg shadow-lift", className)} {...props} />;
}

export function MenuItem({ danger, className, ...props }: ComponentProps<typeof DropdownMenuItem> & { danger?: boolean }) {
  return (
    <DropdownMenuItem
      className={cn(
        "cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-sm focus:bg-elevated [&_svg]:text-muted",
        danger && "text-danger focus:bg-danger/10 [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

/** Avatar with initials fallback, optional online dot and a muted look for closed accounts. */
export function ChatAvatar({
  src,
  name,
  online,
  closed,
  className,
}: {
  src: string | null;
  name: string;
  online?: boolean;
  closed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative block shrink-0", className)}>
      {src && !closed ? (
        <img src={src} alt="" className="size-full rounded-full object-cover ring-1 ring-border" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-full place-items-center rounded-full text-sm font-bold ring-1 ring-border/60",
            closed ? "bg-elevated text-subtle" : "bg-primary/10 text-primary",
          )}
        >
          {closed ? "?" : name.trim().slice(0, 1).toLocaleUpperCase("tr")}
        </span>
      )}
      {online && !closed ? (
        <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-surface bg-ok" aria-label="Çevrimiçi" />
      ) : null}
    </span>
  );
}

/** Small confirm dialog replacing window.confirm. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="border-border bg-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            variant={danger ? "danger" : "default"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "İşleniyor…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
