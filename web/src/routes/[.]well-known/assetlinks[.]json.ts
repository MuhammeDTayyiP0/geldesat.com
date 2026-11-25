import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        const pkg = process.env.ANDROID_PACKAGE_NAME?.trim() || "com.geldesat.app";
        const fingerprints = (process.env.ANDROID_APP_SHA256 ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const body = fingerprints.length
          ? [
              {
                relation: ["delegate_permission/common.handle_all_urls"],
                target: {
                  namespace: "android_app",
                  package_name: pkg,
                  sha256_cert_fingerprints: fingerprints,
                },
              },
            ]
          : [];

        return Response.json(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
