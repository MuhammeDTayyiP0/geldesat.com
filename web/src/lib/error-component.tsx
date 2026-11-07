import { useEffect } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Shown when a page fails. The cause goes to the console, never to the visitor. */
export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error("[page]", error);
  }, [error]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Bir sorun oluştu</h1>
      <p className="max-w-md text-sm text-muted">Sayfa yüklenemedi. Tekrar deneyebilir veya ana sayfaya dönebilirsiniz.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={buttonVariants()}
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Tekrar dene
        </button>
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          Ana sayfaya dön
        </a>
      </div>
    </div>
  );
}
