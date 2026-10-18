/** Same-origin Better Auth for GeldeSat accounts. */
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite, getSql } from "../db";
import { APIError } from "better-auth/api";
import { purgeUserData } from "../server/account-purge";
import { mailConfigured, sendActionMail } from "../server/mail";
import { pgliteDialect } from "./pglite-dialect";

void ensureDbReady();

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const globalAuthRef = globalThis as typeof globalThis & {
  __geldesatAuthSecret__?: string;
};
function authSecret(): string {
  const configured = env("BETTER_AUTH_SECRET") ?? env("AUTH_SECRET");
  if (configured) return configured;
  // A per-process random secret invalidates every session on each restart and
  // breaks sessions across replicas, so production must configure one.
  if (process.env.NODE_ENV === "production") {
    throw new Error("[auth] BETTER_AUTH_SECRET is not set; refusing to start with a random signing secret.");
  }
  globalAuthRef.__geldesatAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__geldesatAuthSecret__;
}

const localOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"];
const siteOrigins = ["https://geldesat.com", "https://www.geldesat.com"];
const explicitBaseURL = env("BETTER_AUTH_URL");
const baseURL = explicitBaseURL ?? {
  allowedHosts: ["localhost", "127.0.0.1", "[::1]", "geldesat.com", "www.geldesat.com"],
  protocol: "auto" as const,
  fallback: "http://localhost:3000",
};
const trustedOrigins = explicitBaseURL
  ? [...new Set([explicitBaseURL, ...localOrigins, ...siteOrigins])]
  : [...localOrigins, ...siteOrigins];

const databaseUrl = env("DATABASE_URL");
const googleClientId = env("GOOGLE_CLIENT_ID");
const googleClientSecret = env("GOOGLE_CLIENT_SECRET");
const googleAuthConfigured = Boolean(googleClientId && googleClientSecret);
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

export const SESSION_TOKEN_COOKIE = "__Host-geldesat-auth.session_token";

export const auth = betterAuth({
  baseURL,
  secret: authSecret(),
  database,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    // Without SMTP the reset endpoint reports that it is unavailable.
    ...(mailConfigured
      ? {
          sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
            await sendActionMail({
              to: user.email,
              subject: "GeldeSat şifre sıfırlama",
              intro: "GeldeSat hesabınız için şifre sıfırlama isteği aldık. Bağlantı 1 saat geçerlidir.",
              actionLabel: "Yeni şifre belirle",
              url,
            });
          },
        }
      : {}),
  },
  // Verified addresses are what lets a Google sign-in join an existing password
  // account (see accountLinking) and what ADMIN_EMAILS trusts.
  ...(mailConfigured
    ? {
        emailVerification: {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
            await sendActionMail({
              to: user.email,
              subject: "GeldeSat e-posta doğrulama",
              intro: "GeldeSat hesabınızın e-posta adresini doğrulayın.",
              actionLabel: "E-postamı doğrula",
              url,
            });
          },
        },
      }
    : {}),
  ...(googleAuthConfigured
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId as string,
            clientSecret: googleClientSecret as string,
          },
        },
        account: {
          accountLinking: {
            enabled: true,
            trustedProviders: ["google"],
            // Only link Google into an existing row whose email was verified.
            // Password sign-ups are unverified, so linking them would let
            // whoever pre-registered an address keep access to the victim's
            // account after the real owner signs in with Google.
            requireLocalEmailVerified: true,
          },
        },
      }
    : {}),
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-geldesat-auth.session_data" },
      account_data: { name: "__Host-geldesat-auth.account_data" },
      dont_remember: { name: "__Host-geldesat-auth.dont_remember" },
    },
  },
  user: {
    // Self-service account deletion (KVKK). Better Auth checks the password, or a
    // recent sign-in for Google-only accounts, then removes its own rows; the app
    // data goes first in beforeDelete.
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const sql = await getSql();
        const role = await sql.query<{ role: string }>("select role from profiles where user_id=$1", [user.id]);
        if (role[0]?.role === "ADMIN") {
          throw new APIError("BAD_REQUEST", { message: "Yönetici hesapları silinemez. Önce yönetici rolünü kaldırın." });
        }
        await purgeUserData(sql, user.id, { includeAuth: false });
      },
    },
  },
  plugins: [tanstackStartCookies()],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
