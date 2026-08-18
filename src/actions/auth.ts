"use server"

import * as z from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { signIn } from "@/auth"
import { AuthError } from "next-auth"
import { generateVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/mail"

const LoginSchema = z.object({
    identifier: z.string().min(1, "E-posta veya telefon gerekli"), // Changed email to identifier
    password: z.string().min(1, "Şifre gerekli"),
})

const RegisterSchema = z.object({
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    password: z.string().min(6, "En az 6 karakter gerekli"),
    name: z.string().min(1, "İsim gerekli"),
    phoneNumber: z.string().min(10, "Geçerli bir telefon numarası giriniz"),
})

export const login = async (values: z.infer<typeof LoginSchema>) => {
    const validatedFields = LoginSchema.safeParse(values)

    if (!validatedFields.success) {
        return { error: "Geçersiz giriş!" }
    }

    const { identifier, password } = validatedFields.data

    const existingUser = await db.user.findFirst({
        where: {
            OR: [
                { email: identifier },
                { phoneNumber: identifier }
            ]
        }
    })

    if (!existingUser || !existingUser.email || !existingUser.password) {
        return { error: "Kayıt bulunamadı!" }
    }

    try {
        await signIn("credentials", {
            identifier, // Passing identifier instead of email
            password,
            redirectTo: "/",
        })
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Hatalı giriş bilgileri!" }
                default:
                    return { error: "Bir şeyler ters gitti!" }
            }
        }
        throw error
    }
}

export const register = async (values: z.infer<typeof RegisterSchema>) => {
    const validatedFields = RegisterSchema.safeParse(values)

    if (!validatedFields.success) {
        return { error: "Geçersiz alanlar!" }
    }

    const { email, password, name, phoneNumber } = validatedFields.data
    const hashedPassword = await bcrypt.hash(password, 10)

    const existingUser = await db.user.findFirst({
        where: {
            OR: [
                { email },
                { phoneNumber }
            ]
        },
    })

    if (existingUser) {
        return { error: "E-posta veya telefon numarası zaten kayıtlı!" }
    }

    await db.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            phoneNumber,
        },
    })

    const verificationToken = await generateVerificationToken(email)
    await sendVerificationEmail(verificationToken.email, verificationToken.token)

    return { success: "Doğrulama e-postası gönderildi!" }
}

export const loginWithGoogle = async () => {
    await signIn("google", { redirectTo: "/" })
}
