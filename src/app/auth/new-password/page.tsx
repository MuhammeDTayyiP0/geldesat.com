import { NewPasswordForm } from "@/components/auth/NewPasswordForm"
import { Suspense } from "react"

export default function NewPasswordPage() {
    return (
        <Suspense>
            <NewPasswordForm />
        </Suspense>
    )
}
