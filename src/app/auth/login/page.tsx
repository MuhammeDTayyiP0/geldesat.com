import { Suspense } from "react"
import { Metadata } from "next"
import { LoginForm } from "@/components/auth/LoginForm"

export const metadata: Metadata = {
    title: "Giriş Yap",
}

export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/30">
            <Suspense fallback={<div>Yükleniyor...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    )
}
