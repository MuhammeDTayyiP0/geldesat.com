"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { reset } from "@/actions/reset-password"

const ResetSchema = z.object({
    email: z.string().email({
        message: "Geçerli bir email adresi giriniz"
    })
})

export function ResetForm() {
    const [isPending, startTransition] = useTransition()
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [sentEmail, setSentEmail] = useState("")
    const router = useRouter()

    const form = useForm<z.infer<typeof ResetSchema>>({
        resolver: zodResolver(ResetSchema),
        defaultValues: {
            email: "",
        },
    })

    const onSubmit = (values: z.infer<typeof ResetSchema>) => {
        startTransition(() => {
            reset(values).then((data) => {
                if (data?.error) {
                    toast.error(data.error)
                }
                if (data?.success) {
                    setSentEmail(values.email)
                    setShowSuccessModal(true)
                }
            })
        })
    }

    const handleSuccessConfirm = () => {
        setShowSuccessModal(false)
        router.push("/auth/login")
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 pb-6 text-center">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">
                        Şifremi Unuttum
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Email adresinizi girin, size şifre sıfırlama talimatlarını gönderelim.
                    </p>
                </div>

                <div className="p-8 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-700">Email Adresi</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                disabled={isPending}
                                                placeholder="ornek@site.com"
                                                type="email"
                                                className="h-11"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-medium shadow-md hover:shadow-lg transition-all"
                                disabled={isPending}
                            >
                                {isPending ? "Gönderiliyor..." : "Sıfırlama Linki Gönder"}
                            </Button>
                        </form>
                    </Form>

                    <div className="mt-6 text-center">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m15 18-6-6 6-6" /></svg>
                            Giriş sayfasına dön
                        </Link>
                    </div>
                </div>
            </div>

            <AlertDialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Email Gönderildi</AlertDialogTitle>
                        <AlertDialogDescription>
                            Şifre sıfırlama bağlantısı <strong>{sentEmail}</strong> adresine gönderildi.
                            Lütfen gelen kutunuzu (veya spam klasörünü) kontrol edin.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleSuccessConfirm}>
                            Tamam, Giriş Yap
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
