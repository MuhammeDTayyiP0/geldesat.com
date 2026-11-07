import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { errorStatus, publicErrorMessage } from "@/lib/server/errors";
import { rateLimit, viewerKey } from "@/lib/server/helpers";
import { readJson } from "@/lib/server/request-body";

const text = (max: number) => z.string().transform((value) => value.slice(0, max));

const Report = z.object({
  platform: z.enum(["ios", "android"]),
  appVersion: text(20).optional(),
  updateId: text(64).nullish(),
  deviceId: text(80).optional(),
  fatal: z.boolean().optional(),
  message: text(500).pipe(z.string().min(1)),
  stack: text(4000).optional(),
  screen: text(120).optional(),
});

/**
 * Errors the app caught (screen crashes, unhandled errors). The app saves fatal
 * ones and sends them on the next launch, a few at a time.
 */
export const Route = createFileRoute("/api/mobile/client-errors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          rateLimit(`client-errors:${viewerKey(request.headers)}`, 30, 60 * 60_000);
          const parsed = z.object({ errors: z.array(Report).min(1).max(10) }).safeParse(await readJson(request, 64 * 1024));
          if (!parsed.success) return Response.json({ success: false, error: "Rapor okunamadı." }, { status: 400 });
          const sql = await getSql();
          for (const e of parsed.data.errors) {
            await sql.query(
              `insert into client_errors (platform, app_version, update_id, device_id, fatal, message, stack, screen)
               values ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [e.platform, e.appVersion ?? null, e.updateId ?? null, e.deviceId ?? null, e.fatal ?? false, e.message, e.stack ?? null, e.screen ?? null],
            );
          }
          return Response.json({ success: true });
        } catch (error) {
          const message = publicErrorMessage(error, "Rapor kaydedilemedi.");
          return Response.json({ success: false, error: message }, { status: errorStatus(error, 500) });
        }
      },
    },
  },
});
