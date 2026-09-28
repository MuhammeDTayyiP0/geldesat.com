import { auth } from "@/lib/auth/server";

export async function getMobileUserId(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}
