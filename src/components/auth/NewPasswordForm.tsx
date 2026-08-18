"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSearchParams } from "next/navigation" // Token'ı URL'den alacağız

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { newPassword } from "@/actions/new-password"
import Link from "next/link"

const NewPasswordSchema = z.object({
    password: z.string().min(6, {
        message: "En az 6 karakter olmalı",
    }),
})

export function NewPasswordForm() {
    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [isPending, startTransition] = useTransition()

    const form = useForm<z.infer<typeof NewPasswordSchema>>({
        resolver: zodResolver(NewPasswordSchema),
        defaultValues: {
            password: "",
        },
    })

    const onSubmit = (values: z.infer<typeof NewPasswordSchema>) => {
        startTransition(() => {
            newPassword(values, token).then((data) => {
                if (data?.error) {
                    toast.error(data.error)
                }
                if (data?.success) {
                    toast.success(data.success)
                }
            })
        })
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-lg border">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                        Yeni Şifre Belirle
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Lütfen yeni şifrenizi girin.
                    </p>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Yeni Şifre</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            disabled={isPending}
                                            placeholder="******"
                                            type="password"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isPending}
                        >
                            Şifreyi Güncelle
                        </Button>
                    </form>
                </Form>
                <div className="text-center mt-4">
                    <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
                        Giriş sayfasına dön
                    </Link>
                </div>
            </div>
        </div>
    )
}
