"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Edit, Eye, EyeOff, Trash2 } from "lucide-react"
import { toggleListingStatus, deleteListing } from "@/actions/listing"
import { useRouter } from "next/navigation"

interface MyListingsActionsProps {
    listingId: string
    status: "ACTIVE" | "INACTIVE"
}

export function MyListingsActions({ listingId, status }: MyListingsActionsProps) {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleToggleStatus = async () => {
        // İsteğe bağlı confirm
        /* if (!confirm(`İlanı ${status === 'ACTIVE' ? 'pasife' : 'yayına'} almak istediğinize emin misiniz?`)) return */

        setIsLoading(true)
        try {
            await toggleListingStatus(listingId)
            // Server actions revalidatePath yaptığı için router.refresh() gerekmeyebilir ama garanti olsun
            // router.refresh() 
        } catch (error) {
            alert("Bir hata oluştu")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm("Bu ilanı tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return

        setIsLoading(true)
        try {
            await deleteListing(listingId)
        } catch (error) {
            alert("Silme işlemi başarısız oldu")
        } finally {
            setIsLoading(false)
        }
    }

    const handleEdit = () => {
        router.push(`/ilan/${listingId}/duzenle`) // Rota bu olacak
    }

    return (
        <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
            <Button
                variant="outline"
                size="sm"
                className="h-9 px-2 text-muted-foreground hover:text-foreground"
                onClick={handleEdit}
                disabled={isLoading}
            >
                <Edit className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Düzenle</span>
            </Button>

            <Button
                variant="outline"
                size="sm"
                className="h-9 px-2 text-muted-foreground hover:text-foreground"
                onClick={handleToggleStatus}
                disabled={isLoading}
            >
                {status === 'ACTIVE' ? (
                    <>
                        <EyeOff className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Pasife Al</span>
                    </>
                ) : (
                    <>
                        <Eye className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Yayına Al</span>
                    </>
                )}
            </Button>

            <Button
                variant="outline"
                size="sm"
                className="h-9 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                onClick={handleDelete}
                disabled={isLoading}
            >
                <Trash2 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sil</span>
            </Button>
        </div>
    )
}
