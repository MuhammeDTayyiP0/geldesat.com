import { getSessionUser } from "@/lib/auth/verify.server";
import { UPLOAD_HEADER } from "@/lib/listing-photos";

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Session user for a same-site upload request (custom header, not cross-site), or an error response. */
export async function authorizeUpload(request: Request): Promise<{ userId: string } | Response> {
  if (request.headers.get(UPLOAD_HEADER) !== "1" || request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "Geçersiz istek" }, 403);
  }
  const user = await getSessionUser();
  if (!user) return json({ error: "Giriş yapmalısınız" }, 401);
  return { userId: user.id };
}
