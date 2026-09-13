
import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

// IMPORTANT: This file must be Edge-compatible. 
// Do not import "bcryptjs" or "prisma" here directly.

export default {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        Credentials({
            async authorize(credentials) {
                return null // Implementation is in auth.ts
            },
        }),
    ],
    trustHost: true,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: "/auth/login",
        error: "/auth/login",
    },
    callbacks: {
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            if (token.phoneNumber && session.user) {
                session.user.phoneNumber = token.phoneNumber as string
            }
            return session
        },
        async jwt({ token, user, trigger, session }) {
            if (user) { // User is available during sign-in
                token.phoneNumber = user.phoneNumber
            }
            if (trigger === "update" && session?.user?.phoneNumber) {
                token.phoneNumber = session.user.phoneNumber
            }
            return token
        }
    },
} satisfies NextAuthConfig
