import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ayarlar/hesap")({
  beforeLoad: () => {
    throw redirect({ to: "/ayarlar/guvenlik", replace: true });
  },
  component: () => null,
});
