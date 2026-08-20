
import { Suspense } from "react"
import { NewVerificationForm } from "@/components/auth/new-verification-form"
import { Loader2 } from "lucide-react"

const NewVerificationPage = () => {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <NewVerificationForm />
        </Suspense>
    )
}

export default NewVerificationPage
