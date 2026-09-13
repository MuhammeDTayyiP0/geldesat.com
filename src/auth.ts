
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"

import Google from "next-auth/providers/google"

// Force a secret if env is missing
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

console.log("Auth Debug:", {
    hasSecret: !!secret,
    hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
})

if (!secret) {
    console.warn("WARNING: AUTH_SECRET / NEXTAUTH_SECRET is missing!")
}

// remove callbacks from authConfig to avoid duplicate key error
const { callbacks: _callbacks, ...authConfigMin } = authConfig

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(db),
    session: { strategy: "jwt" },

    callbacks: {
        async session({ token, session }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }

            if (token.phoneNumber && session.user) {
                // @ts-ignore
                session.user.phoneNumber = token.phoneNumber
            }

            if (session.user) {
                // @ts-ignore
                session.user.emailVerified = token.emailVerified as Date | null
            }

            return session
        },
        async jwt({ token, trigger, session }) {
            if (!token.sub) return token

            // Optimization: If trigger is update, manual update from client
            if (trigger === "update" && session?.user) {
                return { ...token, ...session.user }
            }

            // Always fetch fresh data from DB to ensure session is up to date
            const existingUser = await db.user.findUnique({
                where: { id: token.sub }
            })

            if (!existingUser) return token

            token.phoneNumber = existingUser.phoneNumber
            token.emailVerified = existingUser.emailVerified

            return token
        }
    },
    ...authConfigMin,
    secret,

    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),

        Credentials({
            credentials: {
                identifier: {},
                password: {}
            },
            async authorize(credentials) {
                console.log("Authorize called with:", credentials?.identifier) // Debug log

                try {
                    const parsedCredentials = z
                        .object({
                            identifier: z.string(),
                            password: z.string()
                        })
                        .safeParse(credentials)

                    if (parsedCredentials.success) {
                        const { identifier, password } = parsedCredentials.data

                        const user = await db.user.findFirst({
                            where: {
                                OR: [
                                    { email: identifier },
                                    { phoneNumber: identifier }
                                ]
                            }
                        })

                        if (!user) {
                            console.log("User not found")
                            return null
                        }

                        if (!user.password) {
                            console.log("User has no password (maybe google acc)")
                            return null
                        }

                        const passwordsMatch = await bcrypt.compare(password, user.password)

                        if (passwordsMatch) {
                            // User verification check removed as per request
                            /*
                            if (!user.emailVerified) {
                                console.log("User email not verified")
                                return null
                            }
                            */

                            console.log("Password match, returning user")
                            return user
                        } else {
                            console.log("Password mismatch")
                        }
                    } else {
                        console.log("Zod parsing failed")
                    }
                    return null
                } catch (error) {
                    console.error("Auth error in authorize:", error)
                    return null
                }
            },
        }),
    ],
})

