import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { NotFound } from "@/components/common/NotFound";
import { routeTree } from "./routeTree.gen";

function GlobalPending() {
  return <BrandSpinner fullPage text="Yükleniyor…" />;
}

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: () => <NotFound />,
    defaultPendingComponent: GlobalPending,
    defaultPendingMs: 1000,
    defaultPendingMinMs: 500,
  });
}

