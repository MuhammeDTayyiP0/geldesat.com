"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

interface ListingFiltersProps {
    availableAttributes: any[]
}

export function ListingFilters({ availableAttributes }: ListingFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "")
    const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "")

    // { "Vites Tipi": ["Otomatik", "Manuel"] }
    const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string[]>>({})

    useEffect(() => {
        const newAttrs: Record<string, string[]> = {}
        searchParams.forEach((value, key) => {
            if (key.startsWith("f_")) {
                const attrName = key.substring(2) // "f_Vites Tipi" -> "Vites Tipi"
                if (value) {
                    newAttrs[attrName] = value.split(",")
                }
            }
        })
        setSelectedAttrs(newAttrs)

        // Price sync
        setMinPrice(searchParams.get("minPrice") || "")
        setMaxPrice(searchParams.get("maxPrice") || "")
    }, [searchParams])

    const applyFilters = () => {
        const params = new URLSearchParams()

        if (minPrice) params.set("minPrice", minPrice)
        if (maxPrice) params.set("maxPrice", maxPrice)

        Object.entries(selectedAttrs).forEach(([key, values]) => {
            if (values.length > 0) {
                params.set(`f_${key}`, values.join(","))
            }
        })

        router.push(`?${params.toString()}`)
    }

    const handleAttrChange = (attrName: string, value: string, checked: boolean) => {
        setSelectedAttrs(prev => {
            const current = prev[attrName] || []
            let next: string[]
            if (checked) {
                next = [...current, value]
            } else {
                next = current.filter(v => v !== value)
            }
            return {
                ...prev,
                [attrName]: next
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="border rounded-lg p-4 bg-card shadow-sm">
                <h3 className="font-semibold mb-3 text-sm">Fiyat Aralığı</h3>
                <div className="flex gap-2 items-center mb-3">
                    <Input
                        placeholder="Min TL"
                        value={minPrice}
                        onChange={e => setMinPrice(e.target.value)}
                        type="number"
                        className="h-9 text-sm"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                        placeholder="Max TL"
                        value={maxPrice}
                        onChange={e => setMaxPrice(e.target.value)}
                        type="number"
                        className="h-9 text-sm"
                    />
                </div>
                <Button onClick={applyFilters} size="sm" className="w-full">Uygula</Button>
            </div>

            {availableAttributes.length > 0 && (
                <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
                    <div className="p-3 bg-muted/30 border-b font-medium text-sm">
                        Özellik Filtreleri
                    </div>
                    <Accordion type="multiple" className="w-full">
                        {availableAttributes.map((catAttr) => {
                            if (catAttr.attribute.type !== "SELECT" && catAttr.attribute.type !== "BOOLEAN") return null

                            // Options check (Some attributes might be SELECT but have no options defined properly yet)
                            let options = catAttr.attribute.options || []
                            if (catAttr.attribute.type === "BOOLEAN") options = ["Evet", "Hayır"]

                            if (options.length === 0) return null

                            // Sort options if needed

                            return (
                                <AccordionItem value={catAttr.id} key={catAttr.id} className="border-b last:border-0 px-4">
                                    <AccordionTrigger className="text-sm hover:no-underline py-3 text-left font-normal">
                                        {catAttr.attribute.name}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-2 pt-1 pb-3 max-h-60 overflow-y-auto custom-scrollbar">
                                            {options.map((opt: string) => {
                                                const currentSelected = selectedAttrs[catAttr.attribute.name] || []
                                                const isChecked = currentSelected.includes(opt)
                                                return (
                                                    <div key={opt} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`${catAttr.id}-${opt}`}
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => handleAttrChange(catAttr.attribute.name, opt, checked as boolean)}
                                                        />
                                                        <label
                                                            htmlFor={`${catAttr.id}-${opt}`}
                                                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                                                        >
                                                            {opt}
                                                        </label>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                    <div className="p-3 border-t bg-muted/10">
                        <Button onClick={applyFilters} className="w-full">Sonuçları Filtrele</Button>
                    </div>
                </div>
            )}
        </div>
    )
}
