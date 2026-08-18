"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation" // Changed from router to navigation
import { completeProfile } from "@/actions/complete-profile"
import { useSession, signOut } from "next-auth/react"

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const PhoneSchema = z.object({
    phoneNumber: z.string().min(10, {
        message: "Geçerli bir telefon numarası giriniz"
    }).regex(/^[0-9+\s()-]+$/, {
        message: "Sadece rakam girebilirsiniz"
    })
})

export function CompleteProfileForm() {
    const [isPending, startTransition] = useTransition()
    const { update } = useSession()
    const router = useRouter()

    const form = useForm<z.infer<typeof PhoneSchema>>({
        resolver: zodResolver(PhoneSchema),
        defaultValues: {
            phoneNumber: "",
        },
    })

    const onSubmit = (values: z.infer<typeof PhoneSchema>) => {
        startTransition(() => {
            completeProfile(values).then(async (data) => {
                if (data?.error) {
                    toast.error(data.error)
                }
                if (data?.success) {
                    toast.success("Telefon numarası kaydedildi!")
                    // Update session client-side to reflect change immediately
                    await update()
                    router.push("/") // Redirect to home or dashboard
                    router.refresh()
                }
            })
        })
    }

    return (
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">Profili Tamamla</CardTitle>
                <CardDescription>
                    Devam etmek için lütfen telefon numaranızı ekleyin.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Telefon Numarası</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            disabled={isPending}
                                            placeholder="0555 123 4567"
                                            className="h-11 cursor-text"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-medium shadow-md cursor-pointer"
                            disabled={isPending}
                        >
                            {isPending ? "Kaydediliyor..." : "Kaydet ve Devam Et"}
                        </Button>
                    </form>
                </Form>

                <div className="mt-6 text-center">
                    <Button
                        variant="link"
                        className="text-slate-500 hover:text-red-600 transition-colors"
                        onClick={() => signOut()}
                    >
                        Farklı bir hesapla giriş yap veya çıkış yap
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
