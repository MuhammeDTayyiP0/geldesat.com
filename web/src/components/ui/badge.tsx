import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "primary" | "ok" | "warn" | "danger" | "ink" | "urgent";
  children: React.ReactNode;
}) {
  const tones = {
    muted: "bg-elevated text-muted",
    primary: "bg-primary/10 text-primary",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger/10 text-danger",
    ink: "bg-ink text-primary-fg",
    urgent: "bg-urgent font-bold text-white",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
