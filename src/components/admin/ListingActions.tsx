"use client"

import { Button } from "@/components/ui/button"
import { Trash, CheckCircle, XCircle } from "lucide-react"
import { deleteListing, updateListingStatus } from "@/actions/admin"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface ListingActionsProps {
    listingId: string
    currentStatus: string
}

export function ListingActions({ listingId, currentStatus }: ListingActionsProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        if (!confirm("Bu ilanı silmek istediğinize emin misiniz?")) return
        setLoading(true)
        const res = await deleteListing(listingId)
        if (res.error) alert(res.error)
        setLoading(false)
    }

    const handleStatusChange = async (status: "ACTIVE" | "INACTIVE") => {
        setLoading(true)
        const res = await updateListingStatus(listingId, status)
        if (res.error) alert(res.error)
        setLoading(false)
    }

    return (
        <div className="flex justify-end gap-2">
            {currentStatus !== "ACTIVE" && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={loading}
                    title="Yayınla"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                    <CheckCircle className="w-4 h-4" />
                </Button>
            )}
            {currentStatus === "ACTIVE" && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleStatusChange("INACTIVE")}
                    disabled={loading}
                    title="Yayından Kaldır"
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                    <XCircle className="w-4 h-4" />
                </Button>
            )}
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={loading}
                title="Sil"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
                <Trash className="w-4 h-4" />
            </Button>
        </div>
    )
}
