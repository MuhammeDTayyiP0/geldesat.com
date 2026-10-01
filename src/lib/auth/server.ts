/** Same-origin Better Auth for GeldeSat accounts. */
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { pgliteDialect } from "./pglite-dialect";

void ensureDbReady();

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const authDisabled = env("VITE_AUTH_ENABLED") === "false";
export const authConfigured = !authDisabled;

const globalAuthRef = globalThis as typeof globalThis & {
  __geldesatAuthSecret__?: string;
};
function authSecret(): string {
  globalAuthRef.__geldesatAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__geldesatAuthSecret__;
}

const localOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://[::1]:8081",
];
const siteOrigins = ["https://geldesat.com", "https://www.geldesat.com"];
const explicitBaseURL = env("BETTER_AUTH_URL");
const baseURL = explicitBaseURL ?? {
  allowedHosts: ["localhost", "127.0.0.1", "[::1]", "geldesat.com", "www.geldesat.com"],
  protocol: "auto" as const,
  fallback: "http://localhost:8080",
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
  secret: env("BETTER_AUTH_SECRET") ?? authSecret(),
  database,
  trustedOrigins,
  emailAndPassword: { enabled: emailAndPasswordEnabled },
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
            requireLocalEmailVerified: false,
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
  plugins: [tanstackStartCookies()],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
