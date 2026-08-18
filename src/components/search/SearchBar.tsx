"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

export function SearchBar({ className }: { className?: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [query, setQuery] = useState(searchParams.get("q") || "")

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return

        const params = new URLSearchParams(searchParams.toString())
        params.set("q", query)
        router.push(`/search?${params.toString()}`)
    }

    return (
        <form onSubmit={handleSearch} className={className}>
            <div className="relative">
                <Input
                    placeholder="Kelime, ilan no veya mağaza adı ile ara..."
                    className="w-full pl-4 pr-10 bg-muted/50 border-muted-foreground/20 focus-visible:ring-primary"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0 top-0 h-full text-muted-foreground hover:text-primary"
                >
                    <Search className="h-5 w-5" />
                </Button>
            </div>
        </form>
    )
}
