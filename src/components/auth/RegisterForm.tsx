"use client"

import { useTransition, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"

import { register, loginWithGoogle } from "@/actions/auth"
import { Social } from "@/components/auth/Social"


import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2 } from "lucide-react"

const RegisterSchema = z.object({
    name: z.string().min(2, { message: "İsim en az 2 karakter olmalı" }),
    email: z.string().email({ message: "Geçersiz email adresi" }),
    phoneNumber: z.string().min(10, { message: "Geçerli bir telefon numarası giriniz" }),
    password: z.string().min(6, { message: "Şifre en az 6 karakter olmalı" }),
})

export function RegisterForm() {
    const [error, setError] = useState<string | undefined>("")
    const [success, setSuccess] = useState<string | undefined>("")
    const [isPending, startTransition] = useTransition()

    const form = useForm<z.infer<typeof RegisterSchema>>({
        resolver: zodResolver(RegisterSchema),
        defaultValues: {
            name: "",
            email: "",
            phoneNumber: "",
            password: "",
        },
    })

    const onSubmit = (values: z.infer<typeof RegisterSchema>) => {
        setError("")
        setSuccess("")
        startTransition(() => {
            register(values).then((data) => {
                if (data.error) {
                    setError(data.error)
                }
                if (data.success) {
                    setSuccess(data.success)
                    form.reset()
                }
            })
        })
    }

    return (
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="space-y-1">
                <CardTitle className="text-3xl font-bold text-center tracking-tight text-gray-900">Hesap Oluştur</CardTitle>
                <CardDescription className="text-center text-gray-500">
                    Hemen üye ol, ilan vermeye başla
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Ad Soyad</Label>
                        <Input
                            {...form.register("name")}
                            id="name"
                            placeholder="Ali Yılmaz"
                            disabled={isPending}
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-colors h-11"
                        />
                        {form.formState.errors.name && (
                            <span className="text-sm text-destructive font-medium">{form.formState.errors.name.message}</span>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            {...form.register("email")}
                            id="email"
                            type="email"
                            placeholder="ornek@email.com"
                            disabled={isPending}
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-colors h-11"
                        />
                        {form.formState.errors.email && (
                            <span className="text-sm text-destructive font-medium">{form.formState.errors.email.message}</span>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Telefon Numarası</Label>
                        <Input
                            {...form.register("phoneNumber")}
                            id="phoneNumber"
                            type="tel"
                            placeholder="0555 123 45 67"
                            disabled={isPending}
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-colors h-11"
                        />
                        {form.formState.errors.phoneNumber && (
                            <span className="text-sm text-destructive font-medium">{form.formState.errors.phoneNumber.message}</span>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Şifre</Label>
                        <Input
                            {...form.register("password")}
                            id="password"
                            type="password"
                            placeholder="******"
                            disabled={isPending}
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-colors h-11"
                        />
                        {form.formState.errors.password && (
                            <span className="text-sm text-destructive font-medium">{form.formState.errors.password.message}</span>
                        )}
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Hata</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>Başarılı</AlertTitle>
                            <AlertDescription>
                                {success} <Link href="/auth/login" className="font-bold underline">Buradan giriş yapabilirsiniz.</Link>
                            </AlertDescription>
                        </Alert>
                    )}


                    <Button type="submit" className="w-full font-bold h-11 text-base shadow-md hover:shadow-lg transition-all" disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Kayıt Ol"}
                    </Button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-gray-400 font-medium">veya şununla devam et</span>
                        </div>
                    </div>

                    <Social />

                </form>
            </CardContent>
            <CardFooter className="flex justify-center pb-8">
                <p className="text-sm text-muted-foreground">
                    Zaten hesabınız var mı?{" "}
                    <Link href="/auth/login" className="text-primary hover:underline font-bold">
                        Giriş Yap
                    </Link>
                </p>
            </CardFooter>
        </Card>
    )
}
