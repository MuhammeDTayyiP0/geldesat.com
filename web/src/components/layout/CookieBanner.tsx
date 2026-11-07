import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem("geldesat-cookie"));
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem("geldesat-cookie", "essential");
    } catch {
      // Private mode: the banner simply comes back next time.
    }
  }

  return (
    <>
      <div className="h-28 sm:h-20" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-0 z-50 px-3 pb-2 md:pb-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-lift sm:flex-row sm:items-center">
          <p className="flex-1 text-sm leading-snug text-muted">
            Yalnızca oturum, güvenlik ve site tercihleri için zorunlu çerezler kullanıyoruz; reklam veya izleme çerezi yok. Ayrıntı{" "}
            <Link to="/sayfa/$slug" params={{ slug: "cerez" }} className="font-medium text-primary hover:underline">
              çerez politikası
            </Link>
            .
          </p>
          <Button size="sm" className="shrink-0" onClick={dismiss}>
            Tamam
          </Button>
        </div>
      </div>
    </>
  );
}
