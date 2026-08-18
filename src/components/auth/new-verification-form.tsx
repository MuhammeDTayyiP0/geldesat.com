"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BeatLoader } from "react-spinners"
import Link from "next/link"

import { newVerification } from "@/actions/new-verification"

export const NewVerificationForm = () => {
    const [error, setError] = useState<string | undefined>()
    const [success, setSuccess] = useState<string | undefined>()

    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const onSubmit = useCallback(() => {
        if (success || error) return

        if (!token) {
            setError("Token bulunamadı!")
            return
        }

        newVerification(token)
            .then((data) => {
                setSuccess(data.success)
                setError(data.error)
            })
            .catch(() => {
                setError("Bir şeyler ters gitti!")
            })
    }, [token, success, error])

    useEffect(() => {
        onSubmit()
    }, [onSubmit])

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900">E-posta Doğrulama</h2>
                    <p className="mt-2 text-gray-600">Hesabınız doğrulanıyor...</p>
                </div>

                <div className="flex items-center justify-center w-full my-8">
                    {!success && !error && (
                        <BeatLoader />
                    )}
                    {success && (
                        <div className="p-3 text-sm text-center text-green-500 bg-green-100 rounded-md w-full">
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="p-3 text-sm text-center text-red-500 bg-red-100 rounded-md w-full">
                            {error}
                        </div>
                    )}
                </div>

                <div className="text-center">
                    <Link
                        href="/auth/login"
                        className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                        Giriş Sayfasına Dön
                    </Link>
                </div>
            </div>
        </div>
    )
}
