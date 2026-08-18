"use client"

import { useTransition, useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { login, loginWithGoogle } from "@/actions/auth"
import { Social } from "@/components/auth/Social"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

const LoginSchema = z.object({
    identifier: z.string().min(1, { message: "E-posta veya telefon gerekli" }),
    password: z.string().min(1, { message: "Şifre gerekli" }),
})

import { useSearchParams } from "next/navigation"

export function LoginForm() {
    const searchParams = useSearchParams()
    const urlError = searchParams.get("error") === "OAuthAccountNotLinked"
        ? "Bu email adresi ile daha önce kayıt olmuşsunuz. Lütfen şifrenizle giriş yapın."
        : ""

    const [error, setError] = useState<string | undefined>("")
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        if (urlError) {
            setError(urlError)
        }
    }, [urlError])

    const form = useForm<z.infer<typeof LoginSchema>>({
        resolver: zodResolver(LoginSchema),
        defaultValues: {
            identifier: "",
            password: "",
        },
    })

    const onSubmit = (values: z.infer<typeof LoginSchema>) => {
        setError("")
        startTransition(() => {
            login(values).then((data) => {
                if (data?.error) {
                    setError(data.error)
                }
            })
        })
    }


    return (
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="space-y-1">
                <CardTitle className="text-3xl font-bold text-center tracking-tight text-gray-900">Hoş Geldiniz</CardTitle>
                <CardDescription className="text-center text-gray-500">
                    GeldeSat hesabınıza giriş yapın
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="identifier">E-posta veya Telefon</Label>
                        <Input
                            {...form.register("identifier")}
                            id="identifier"
                            type="text"
                            placeholder="ornek@email.com veya 555..."
                            disabled={isPending}
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                        />
                        {form.formState.errors.identifier && (
                            <span className="text-sm text-destructive font-medium">{form.formState.errors.identifier.message}</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Şifre</Label>
                            <Link href="/auth/reset" className="text-xs text-primary hover:underline">
                                Şifremi Unuttum?
                            </Link>
                        </div>
                        <Input
                            {...form.register("password")}
                            id="password"
                            type="password"
                            placeholder="******"
                            disabled={isPending}
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-colors"
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

                    <Button type="submit" className="w-full font-bold h-11 text-base shadow-md hover:shadow-lg transition-all" disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Giriş Yap"}
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
                    Hesabınız yok mu?{" "}
                    <Link href="/auth/register" className="text-primary hover:underline font-bold">
                        Hemen Kayıt Ol
                    </Link>
                </p>
            </CardFooter>
        </Card>
    )
}
