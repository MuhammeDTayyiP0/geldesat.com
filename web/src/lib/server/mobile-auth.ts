import { auth } from "@/lib/auth/server";
import { publicOrigin } from "./ota";

export async function getMobileUserId(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

/**
 * Guards mutating `/api/mobile/*` JSON endpoints that also accept browser cookies
 * against cross-site form/fetch CSRF:
 * - Requests carrying `Authorization: Bearer …` are immune to cookie CSRF.
 * - Cookie-authenticated requests must pass `Sec-Fetch-Site` and `Origin` checks
 *   and must send exact MIME `application/json` (triggering CORS preflight).
 */
export function assertMobileJsonWrite(request: Request): Response | null {
  const authHeader = request.headers.get("authorization") ?? "";
  if (/^Bearer\s+\S+/i.test(authHeader)) return null;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return Response.json({ success: false, error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      const reqOrigin = new URL(originHeader).origin;
      const allowed = new Set<string>([publicOrigin(request)]);
      try {
        allowed.add(new URL(request.url).origin);
      } catch {
        // ignore malformed request.url
      }
      if (!allowed.has(reqOrigin)) {
        return Response.json({ success: false, error: "Geçersiz istek kaynağı." }, { status: 403 });
      }
    } catch {
      return Response.json({ success: false, error: "Geçersiz istek kaynağı." }, { status: 403 });
    }
  } else if (request.headers.has("cookie") && !fetchSite) {
    return Response.json({ success: false, error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  const mime = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime !== "application/json") {
    return Response.json({ success: false, error: "İstek Content-Type: application/json olmalıdır." }, { status: 415 });
  }
  return null;
}
