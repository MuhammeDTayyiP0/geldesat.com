import { RegisterForm } from "@/components/auth/RegisterForm"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Kayıt Ol",
}

export default function RegisterPage() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/30">
            <RegisterForm />
        </div>
    )
}
