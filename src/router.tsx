import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { routeTree } from "./routeTree.gen";

function GlobalPending() {
  return <BrandSpinner fullPage text="Yükleniyor…" />;
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPendingComponent: GlobalPending,
    defaultPendingMs: 200,
  });
}
