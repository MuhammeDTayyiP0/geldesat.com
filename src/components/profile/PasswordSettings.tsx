"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { updatePassword } from "@/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { Lock } from "lucide-react"

const PasswordSchema = z.object({
    currentPassword: z.string().min(1, "Mevcut şifre gereklidir"),
    newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalıdır"),
    confirmPassword: z.string().min(1, "Şifre tekrarı gereklidir"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
})

export function PasswordSettings() {
    const [isPending, startTransition] = useTransition()

    const form = useForm<z.infer<typeof PasswordSchema>>({
        resolver: zodResolver(PasswordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    })

    const onSubmit = (values: z.infer<typeof PasswordSchema>) => {
        startTransition(() => {
            updatePassword(values).then((data) => {
                if (data.error) {
                    toast.error(data.error)
                }
                if (data.success) {
                    toast.success(data.success)
                    form.reset()
                }
            })
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" /> Şifre Değiştir
                </CardTitle>
                <CardDescription>
                    Hesap şifrenizi buradan güncelleyebilirsiniz.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currentPassword">Mevcut Şifre</Label>
                        <Input
                            {...form.register("currentPassword")}
                            id="currentPassword"
                            type="password"
                            disabled={isPending}
                        />
                        {form.formState.errors.currentPassword && (
                            <span className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">Yeni Şifre</Label>
                        <Input
                            {...form.register("newPassword")}
                            id="newPassword"
                            type="password"
                            disabled={isPending}
                        />
                        {form.formState.errors.newPassword && (
                            <span className="text-sm text-destructive">{form.formState.errors.newPassword.message}</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
                        <Input
                            {...form.register("confirmPassword")}
                            id="confirmPassword"
                            type="password"
                            disabled={isPending}
                        />
                        {form.formState.errors.confirmPassword && (
                            <span className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</span>
                        )}
                    </div>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
