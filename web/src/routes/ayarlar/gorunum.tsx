import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ayarlar/gorunum")({
  beforeLoad: () => {
    throw redirect({ to: "/ayarlar", replace: true });
  },
  component: () => null,
});
