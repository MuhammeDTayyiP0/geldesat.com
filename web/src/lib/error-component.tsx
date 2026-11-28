import { useEffect } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { isChunkLoadError, safeReloadOnce } from "@/lib/app-version";

/** Shown when a page fails. The cause goes to the console, never to the visitor. */
export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const chunkErr = isChunkLoadError(error);
  useEffect(() => {
    console.error("[page]", error);
    if (chunkErr) {
      safeReloadOnce("error-boundary");
    }
  }, [error, chunkErr]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Bir sorun oluştu</h1>
      <p className="max-w-md text-sm text-muted">
        {chunkErr ? "Uygulama güncellendi. Sayfayı yenileyerek devam edebilirsiniz." : "Sayfa yüklenemedi. Tekrar deneyebilir veya ana sayfaya dönebilirsiniz."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={buttonVariants()}
          onClick={() => {
            if (chunkErr) {
              window.location.reload();
              return;
            }
            reset();
            void router.invalidate();
          }}
        >
          {chunkErr ? "Sayfayı yenile" : "Tekrar dene"}
        </button>
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          Ana sayfaya dön
        </a>
      </div>
    </div>
  );
}
