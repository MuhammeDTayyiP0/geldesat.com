import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ayarlar/engellenenler")({
  beforeLoad: () => {
    throw redirect({ to: "/ayarlar/gizlilik", replace: true });
  },
  component: () => null,
});
