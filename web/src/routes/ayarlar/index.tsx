import { createFileRoute, redirect } from "@tanstack/react-router";

/** Settings live under the account area; the bare path opens profile settings. */
export const Route = createFileRoute("/ayarlar/")({
  beforeLoad: () => {
    throw redirect({ to: "/ayarlar/profil", replace: true });
  },
});
