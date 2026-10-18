import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { AppErrorComponent } from "@/lib/error-component";
import { BrandSpinner } from "@/components/brand/BrandSpinner";
import { NotFound } from "@/components/common/NotFound";
import { buildCsp, createNonce } from "@/lib/csp";
import { routeTree } from "./routeTree.gen";

function GlobalPending() {
  return <BrandSpinner fullPage text="Yükleniyor…" />;
}

/**
 * Per-request CSP nonce for production SSR. The router puts it on its scripts
 * and in a `csp-nonce` meta tag the client reads back. Dev is skipped: Vite's
 * HMR client injects scripts the policy would block.
 */
const pageNonce = createIsomorphicFn()
  .server((): string | undefined => {
    if (!import.meta.env.PROD) return undefined;
    const nonce = createNonce();
    setResponseHeader("Content-Security-Policy", buildCsp(nonce));
    return nonce;
  })
  .client((): string | undefined => undefined);

export function getRouter() {
  const nonce = pageNonce();
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: () => <NotFound />,
    defaultPendingComponent: GlobalPending,
    defaultPendingMs: 1000,
    defaultPendingMinMs: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });
}
