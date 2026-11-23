import { auth } from "@/lib/auth/server";

export async function getMobileUserId(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

/**
 * Guards mutating `/api/mobile/*` JSON endpoints that also accept browser cookies
 * against cross-site form/fetch CSRF:
 * - Requests carrying `Authorization: Bearer …` are immune to cookie CSRF.
 * - Cookie-authenticated requests must not be cross-site (`Sec-Fetch-Site`) and
 *   must send `Content-Type: application/json` (which triggers CORS preflight).
 */
export function assertMobileJsonWrite(request: Request): Response | null {
  const authHeader = request.headers.get("authorization") ?? "";
  if (/^Bearer\s+\S+/i.test(authHeader)) return null;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return Response.json({ success: false, error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("application/json")) {
    return Response.json({ success: false, error: "İstek Content-Type: application/json olmalıdır." }, { status: 415 });
  }
  return null;
}
