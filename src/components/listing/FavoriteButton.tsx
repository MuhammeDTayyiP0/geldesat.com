"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { toggleFavorite } from "@/actions/favorite"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
    listingId: string
    isFavorited: boolean
    className?: string
    showText?: boolean
}

export function FavoriteButton({ listingId, isFavorited: initialIsFavorited, className, showText = false }: FavoriteButtonProps) {
    const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
    const [loading, setLoading] = useState(false)

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault() // Prevent link navigation if inside a link
        e.stopPropagation()

        if (loading) return

        setLoading(true)
        // Optimistic update
        setIsFavorited(!isFavorited)

        const result = await toggleFavorite(listingId)

        if (result?.error) {
            setIsFavorited(isFavorited) // Revert
            if (result.needsAuth) {
                window.location.href = `/auth/login?callbackUrl=/ilan/${listingId}`
            } else {
                alert(result.error)
            }
        } else if (result && typeof result.favorite === 'boolean') {
            setIsFavorited(result.favorite)
        }

        setLoading(false)
    }

    return (
        <Button
            variant={showText ? "outline" : "ghost"}
            size={showText ? "default" : "icon"}
            className={cn("transition-colors", isFavorited && "text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200", className)}
            onClick={handleToggle}
            disabled={loading}
        >
            <Heart className={cn("w-5 h-5", showText && "mr-2", isFavorited && "fill-current")} />
            {showText && (isFavorited ? "Favorilerden Çıkar" : "Favorilere Ekle")}
        </Button>
    )
}
