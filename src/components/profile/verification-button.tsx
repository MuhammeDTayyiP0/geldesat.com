"use client"

import { useState } from "react"
import { resendVerificationEmail } from "@/actions/verification"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export const VerificationButton = () => {
    const [isLoading, setIsLoading] = useState(false)

    const onClick = async () => {
        setIsLoading(true)
        try {
            const data = await resendVerificationEmail()
            if (data.error) {
                toast.error(data.error)
            } else {
                toast.success(data.success)
            }
        } catch {
            toast.error("Bir şeyler ters gitti.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            onClick={onClick}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="text-xs h-7 ml-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
        >
            {isLoading ? "Gönderiliyor..." : "Doğrulama Linki Gönder"}
        </Button>
    )
}
