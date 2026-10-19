import type { AuditEntry } from "@/lib/server/admin/dashboard";
import { cn } from "@/lib/utils";
import { actionTone, dateTime, relative, TARGET_LABEL } from "./format";

const DOT: Record<string, string> = {
  danger: "bg-danger",
  ok: "bg-ok",
  violet: "bg-violet-500",
  primary: "bg-primary",
  warn: "bg-warn",
  muted: "bg-subtle",
  ink: "bg-ink",
};

/** Timeline of admin actions. */
export function AuditList({ entries, empty, compact }: { entries: AuditEntry[]; empty?: string; compact?: boolean }) {
  if (!entries.length) return <p className="py-4 text-center text-sm text-muted">{empty ?? "Kayıt yok."}</p>;
  return (
    <ol className="relative space-y-0">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 pl-1">
          {i < entries.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden /> : null}
          <span className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface", DOT[actionTone(e.action)])} />
          <div className="min-w-0 flex-1">
            <p className={cn("break-words text-fg", compact ? "text-xs" : "text-sm")}>{e.summary}</p>
            <p className="mt-0.5 text-[11px] text-muted" title={dateTime(e.created_at)}>
              {e.admin_name} · {TARGET_LABEL[e.target_type] ?? e.target_type} · {relative(e.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
