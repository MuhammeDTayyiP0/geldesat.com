"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { TURKEY_CITIES } from "@/lib/data/locations"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function SearchFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "")
    const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "")

    const [city, setCity] = useState(searchParams.get("city") || "")
    const [district, setDistrict] = useState(searchParams.get("district") || "")

    // Reset district if city changes and current district is not valid for new city
    useEffect(() => {
        if (city && district) {
            const cityData = TURKEY_CITIES.find(c => c.name === city)
            if (cityData && !cityData.districts.includes(district)) {
                setDistrict("")
            }
        }
    }, [city, district])

    const handleFilter = () => {
        const params = new URLSearchParams(searchParams.toString())

        if (minPrice) params.set("minPrice", minPrice)
        else params.delete("minPrice")

        if (maxPrice) params.set("maxPrice", maxPrice)
        else params.delete("maxPrice")

        if (city) params.set("city", city)
        else params.delete("city")

        if (district) params.set("district", district)
        else params.delete("district")

        router.push(`/search?${params.toString()}`)
    }

    const districts = city ? TURKEY_CITIES.find(c => c.name === city)?.districts || [] : []

    return (
        <Card className="p-4 space-y-6">
            {/* Location Filters */}
            <div className="space-y-4">
                <h3 className="font-semibold">Konum</h3>
                <div className="space-y-2">
                    <Label className="text-xs">İl</Label>
                    <Select value={city} onValueChange={(val) => {
                        setCity(val === "all" ? "" : val)
                        if (val === "all") setDistrict("")
                    }}>
                        <SelectTrigger>
                            <SelectValue placeholder="Tüm İller" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm İller</SelectItem>
                            {TURKEY_CITIES.map((c) => (
                                <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs">İlçe</Label>
                    <Select
                        value={district}
                        onValueChange={(val) => setDistrict(val === "all" ? "" : val)}
                        disabled={!city}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Tüm İlçeler" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm İlçeler</SelectItem>
                            {districts.map((d) => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Fiyat Aralığı</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="space-y-1">
                        <Label htmlFor="min-price" className="text-xs">En Az (TL)</Label>
                        <Input
                            id="min-price"
                            type="number"
                            placeholder="0"
                            value={minPrice}
                            onChange={(e) => setMinPrice(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="max-price" className="text-xs">En Çok (TL)</Label>
                        <Input
                            id="max-price"
                            type="number"
                            placeholder="Max"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <Button size="sm" className="w-full" onClick={handleFilter}>
                Filtrele
            </Button>
        </Card>
    )
}
