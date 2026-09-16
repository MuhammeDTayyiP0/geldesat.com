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

  function save(value: "essential" | "all") {
    localStorage.setItem("geldesat-cookie", value);
    setShow(false);
  }

  return (
    <>
      <div className="h-28 sm:h-20" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-lift sm:flex-row sm:items-center">
          <p className="flex-1 text-sm leading-snug text-muted">
            Zorunlu çerezler oturum ve güvenlik içindir. Ayrıntı{" "}
            <Link to="/sayfa/$slug" params={{ slug: "cerez" }} className="font-medium text-primary hover:underline">
              çerez politikası
            </Link>
            .
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => save("essential")}>
              Sadece zorunlu
            </Button>
            <Button size="sm" onClick={() => save("all")}>
              Kabul et
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
