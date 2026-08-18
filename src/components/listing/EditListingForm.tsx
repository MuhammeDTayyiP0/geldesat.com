"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateListing } from "@/actions/listing"
import { useRouter } from "next/navigation"
import { TURKEY_CITIES } from "@/lib/data/locations"
import { X, Upload, Image as ImageIcon } from "lucide-react"

export function EditListingForm({ listing }: { listing: any }) {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const [selectedCity, setSelectedCity] = useState(listing.city || "")
    const [selectedDistrict, setSelectedDistrict] = useState(listing.district || "")

    // Resim State'leri
    const [existingImages, setExistingImages] = useState<string[]>(listing.images || [])
    const [newImages, setNewImages] = useState<File[]>([])
    const [previewUrls, setPreviewUrls] = useState<string[]>([])

    // Cities Data
    const cities = TURKEY_CITIES.map(c => c.name).sort()
    const districts = selectedCity
        ? TURKEY_CITIES.find(c => c.name === selectedCity)?.districts.sort() || []
        : []

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files)
            setNewImages(prev => [...prev, ...files])

            files.forEach(file => {
                const reader = new FileReader()
                reader.onloadend = () => {
                    setPreviewUrls(prev => [...prev, reader.result as string])
                }
                reader.readAsDataURL(file)
            })
        }
    }

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index))
    }

    const removeNewImage = (index: number) => {
        setNewImages(prev => prev.filter((_, i) => i !== index))
        setPreviewUrls(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)

        const formData = new FormData(e.currentTarget)

        if (!formData.get("city") && selectedCity) formData.append("city", selectedCity)
        if (!formData.get("district") && selectedDistrict) formData.append("district", selectedDistrict)

        existingImages.forEach(url => formData.append("existingImages", url))
        newImages.forEach(file => formData.append("newImages", file))

        formData.append("id", listing.id)
        const result = await updateListing(formData)

        setIsLoading(false)
        if (result.success) {
            alert("İlan güncellendi")
            router.push("/my-listings")
            router.refresh()
        } else {
            alert(result.error || "Bir hata oluştu")
        }
    }

    useEffect(() => {
        if (selectedCity && selectedCity !== listing.city) {
            const currentCityDistricts = TURKEY_CITIES.find(c => c.name === selectedCity)?.districts || []
            if (!currentCityDistricts.includes(selectedDistrict)) {
                setSelectedDistrict("")
            }
        }
    }, [selectedCity, listing.city, selectedDistrict])

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Temel Bilgiler */}
            <div className="space-y-4 border p-4 rounded-md bg-card">
                <h3 className="font-semibold text-lg border-b pb-2">Genel Bilgiler</h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Başlık</Label>
                        <Input name="title" defaultValue={listing.title} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Fiyat</Label>
                        <Input name="price" type="number" defaultValue={listing.price} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Açıklama</Label>
                        <Textarea name="description" defaultValue={listing.description} required className="min-h-[150px]" />
                    </div>
                </div>
            </div>

            {/* Fotoğraflar */}
            <div className="space-y-4 border p-4 rounded-md bg-card">
                <h3 className="font-semibold text-lg border-b pb-2 w-full flex items-center justify-between">
                    Fotoğraflar
                    <span className="text-xs font-normal text-muted-foreground">
                        {existingImages.length + newImages.length} Fotoğraf
                    </span>
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    {existingImages.map((url, index) => (
                        <div key={`existing-${index}`} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Resim ${index + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1">
                                <button
                                    type="button"
                                    onClick={() => removeExistingImage(index)}
                                    className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                                    title="Sil"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {previewUrls.map((url, index) => (
                        <div key={`new-${index}`} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Yeni Resim ${index + 1}`} className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">YENİ</span>
                            </div>
                            <div className="absolute top-1 right-1 pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={() => removeNewImage(index)}
                                    className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                                    title="İptal"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="col-span-1 aspect-square">
                        <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                            <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                            <span className="text-xs text-muted-foreground text-center px-2">Resim Ekle</span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Konum */}
            <div className="space-y-4 border p-4 rounded-md bg-card">
                <h3 className="font-semibold text-lg border-b pb-2">Konum</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                        <Label>İl</Label>
                        <Select value={selectedCity} onValueChange={setSelectedCity} name="city">
                            <SelectTrigger>
                                <SelectValue placeholder="İl Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {cities.map(city => (
                                    <SelectItem key={city} value={city}>{city}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>İlçe</Label>
                        <Select
                            value={selectedDistrict}
                            onValueChange={setSelectedDistrict}
                            name="district"
                            disabled={!selectedCity}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="İlçe Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {districts.map((d: string) => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Teknik Detaylar */}
            <div className="space-y-4 border p-4 rounded-md bg-card">
                <h3 className="font-semibold text-lg border-b pb-2">Teknik Detaylar</h3>

                {(() => {
                    // 1. Kategoriden gelenler
                    const catAttrs = listing.category?.attributes?.map((a: any) => ({
                        definition: a.attribute,
                        required: a.required
                    })) || []

                    // 2. İlanda zaten var olanlar
                    const existingAttrs = listing.attributeValues?.map((v: any) => ({
                        definition: v.attribute,
                        required: false
                    })) || []

                    // Birleştir ve Unique yap
                    const attributesMap = new Map()
                    existingAttrs.forEach((item: any) => attributesMap.set(item.definition.id, item))
                    catAttrs.forEach((item: any) => attributesMap.set(item.definition.id, item))

                    const allAttributes = Array.from(attributesMap.values())

                    if (allAttributes.length === 0) {
                        return (
                            <div className="text-muted-foreground text-sm py-2">
                                Bu kategori için tanımlanmış teknik detay bulunmamaktadır.
                            </div>
                        )
                    }

                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {allAttributes.map((attrItem: any) => {
                                const attr = attrItem.definition
                                const existingValueObj = listing.attributeValues.find((v: any) => v.attributeId === attr.id)
                                const defaultValue = existingValueObj?.value || ""

                                return (
                                    <div key={attr.id} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label>{attr.name}</Label>
                                            {attrItem.required && <span className="text-xs text-red-500">*Zorunlu</span>}
                                        </div>

                                        {attr.type === "SELECT" ? (
                                            <Select name={`attributes[${attr.id}]`} defaultValue={defaultValue}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seçiniz" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {attr.options.map((opt: string) => (
                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input
                                                name={`attributes[${attr.id}]`}
                                                defaultValue={defaultValue}
                                                type={attr.type === "NUMBER" ? "number" : "text"}
                                                required={attrItem.required}
                                            />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })()}
            </div>

            <div className="flex justify-end gap-4 pt-4 sticky bottom-0 bg-background/80 backdrop-blur p-4 border-t">
                <Button type="button" variant="outline" onClick={() => router.back()}>Vazgeç</Button>
                <Button type="submit" disabled={isLoading}>{isLoading ? "Kaydediliyor..." : "Kaydet"}</Button>
            </div>
        </form>
    )
}
