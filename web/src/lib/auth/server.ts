/** Same-origin Better Auth for GeldeSat accounts. */
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { bearer } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite, getSql } from "../db";
import { mailConfigured, sendPasswordResetMail, sendVerificationMail } from "../server/mail";
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
export const googleAuthConfigured = Boolean(googleClientId && googleClientSecret);
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
          sendResetPassword: async ({ user, url }: { user: { email: string; name?: string | null }; url: string }) => {
            await sendPasswordResetMail({ to: user.email, name: user.name, url });
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
          sendVerificationEmail: async ({ user, url }: { user: { email: string; name?: string | null }; url: string }) => {
            await sendVerificationMail({ to: user.email, name: user.name, url });
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
  // Suspended members (admin console) cannot start a session.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const sql = await getSql();
          const rows = await sql.query<{ banned: boolean }>(
            "select banned_at is not null as banned from profiles where user_id = $1",
            [session.userId],
          );
          if (rows[0]?.banned) {
            throw new APIError("FORBIDDEN", { message: "Hesabınız askıya alındı. Destek için destek@geldesat.com adresine yazın." });
          }
        },
      },
    },
  },
  // bearer: the native app sends its session token as `Authorization: Bearer …`.
  plugins: [bearer(), tanstackStartCookies()],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
