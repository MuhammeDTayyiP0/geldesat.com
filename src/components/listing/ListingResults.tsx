"use client"

import { useState } from "react"
import { ListingCard } from "./ListingCard"
import { LayoutGrid, List as ListIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ListingResultsProps {
    listings: any[]
}

export function ListingResults({ listings }: ListingResultsProps) {
    const [view, setView] = useState<"grid" | "list">("list") // Default LIST view

    return (
        <div>
            <div className="flex justify-end mb-4">
                <div className="flex items-center gap-1 border rounded-md p-1 bg-white shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", view === "list" && "bg-slate-100 text-blue-600")}
                        onClick={() => setView("list")}
                        title="Liste Görünümü"
                    >
                        <ListIcon className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", view === "grid" && "bg-slate-100 text-blue-600")}
                        onClick={() => setView("grid")}
                        title="Vitrin Görünümü"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className={cn(
                "grid gap-4",
                view === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
            )}>
                {listings.map(listing => (
                    <ListingCard key={listing.id} listing={listing} variant={view} />
                ))}
            </div>
        </div>
    )
}
