import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A list that could not load: says so, instead of looking empty. */
export function ErrorState({ message = "Veriler yüklenemedi.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center" role="alert">
      <TriangleAlert className="mx-auto size-7 text-danger" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Tekrar dene
        </Button>
      ) : null}
    </div>
  );
}
