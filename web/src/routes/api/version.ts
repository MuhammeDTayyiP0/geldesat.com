import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { version: typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev" },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
