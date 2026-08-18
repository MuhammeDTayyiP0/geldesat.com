"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { updatePhoneNumber } from "@/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { Phone } from "lucide-react"
import { useSession } from "next-auth/react"

const PhoneSchema = z.object({
    phoneNumber: z.string().min(10, "Geçerli bir telefon numarası giriniz").regex(/^[0-9+\s()-]+$/, "Sadece rakam girebilirsiniz")
})

export function PhoneSettings({ currentPhone }: { currentPhone?: string | null }) {
    const [isPending, startTransition] = useTransition()
    const { update } = useSession()

    const form = useForm<z.infer<typeof PhoneSchema>>({
        resolver: zodResolver(PhoneSchema),
        defaultValues: {
            phoneNumber: currentPhone || "",
        },
    })

    const onSubmit = (values: z.infer<typeof PhoneSchema>) => {
        startTransition(() => {
            updatePhoneNumber(values).then(async (data) => {
                if (data.error) {
                    toast.error(data.error)
                }
                if (data.success) {
                    toast.success(data.success)
                    await update({ user: { phoneNumber: values.phoneNumber } }) // Update session with new phone number
                }
            })
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5" /> Telefon Numarası
                </CardTitle>
                <CardDescription>
                    İletişim numaranızı buradan güncelleyebilirsiniz.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Telefon Numarası</Label>
                        <Input
                            {...form.register("phoneNumber")}
                            id="phoneNumber"
                            placeholder="0555 123 4567"
                            disabled={isPending}
                        />
                        {form.formState.errors.phoneNumber && (
                            <span className="text-sm text-destructive">{form.formState.errors.phoneNumber.message}</span>
                        )}
                    </div>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Güncelleniyor..." : "Numarayı Güncelle"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
