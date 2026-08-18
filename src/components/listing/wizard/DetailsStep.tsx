"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useState, useEffect } from "react"
import { getCategoryPath } from "@/actions/category"
import { Label } from "@/components/ui/label"
import { TURKEY_CITIES } from "@/lib/data/locations"

const listingSchema = z.object({
    title: z.string().min(5, "Başlık en az 5 karakter olmalıdır").max(100, "Başlık çok uzun"),
    price: z.coerce.number().min(0, "Fiyat 0'dan küçük olamaz"),
    description: z.string().min(5, "Açıklama en az 5 karakter olmalıdır"),
    city: z.string().min(1, "Lütfen bir şehir seçiniz"),
    district: z.string().min(1, "Lütfen bir ilçe seçiniz"),
})

type ListingFormValues = z.infer<typeof listingSchema>


interface DetailsStepProps {
    onNext: (data: any) => void
    onBack: () => void
    categoryId: string
    initialData?: any
}

export function DetailsStep({ onNext, onBack, categoryId, initialData }: DetailsStepProps) {
    const [attributes, setAttributes] = useState<any[]>([])
    const [attributeValues, setAttributeValues] = useState<Record<string, any>>(initialData?.attributes || {})

    const form = useForm<ListingFormValues>({
        // resolver: zodResolver(listingSchema),
        defaultValues: initialData || {
            title: "",
            price: "",
            description: "",
            city: "",
            district: "",
        },
    })


    useEffect(() => {
        const loadAttributes = async () => {
            const res = await getCategoryPath(categoryId)
            if (res.success && res.data) {
                setAttributes(res.data.attributes)
            }
        }
        loadAttributes()
    }, [categoryId])


    const onSubmit = (data: ListingFormValues) => {
        try {
            console.log("Submit Başladı, Verilen Data:", data)

            // Manual Validation
            const result = listingSchema.safeParse(data)
            if (!result.success) {
                // Zod hatalarını güvenli şekilde al
                const errorMsg = (result.error as any).errors?.[0]?.message || JSON.stringify(result.error)
                alert(`Lütfen formu kontrol ediniz: ${errorMsg}`)
                return
            }

            console.log("Attributes:", attributes)
            console.log("AttributeValues:", attributeValues)

            // Validate required attributes
            if (attributes && Array.isArray(attributes)) {
                const missingAttributes = attributes.filter(attrItem => {
                    const attr = attrItem.attribute
                    return attrItem.required && (!attributeValues[attr.id] || attributeValues[attr.id] === "")
                })

                if (missingAttributes.length > 0) {
                    const missingNames = missingAttributes.map(item => item.attribute.name).join(", ")
                    alert(`Lütfen şu alanları doldurun: ${missingNames}`)
                    return
                }
            }

            console.log("onNext Çağrılıyor...")
            onNext({
                ...data,
                attributes: attributeValues || {}
            })
            console.log("onNext Çağrıldı.")

        } catch (error) {
            console.error("CRITICAL SUBMIT ERROR:", error)
            alert("BİR HATA OLUŞTU: " + error)
        }
    }

    const onInvalid = (errors: any) => {
        console.log("Form errors:", errors)
        const firstError = Object.values(errors)[0] as any
        if (firstError) {
            alert(`Lütfen formu kontrol ediniz: ${firstError.message}`)
        }
    }

    const handleManualSubmit = async (e: React.MouseEvent) => {
        e.preventDefault()
        console.log("Manuel submit - trigger ile deneniyor")

        try {
            const isValid = await form.trigger()
            console.log("Form Validasyon Sonucu:", isValid)

            if (isValid) {
                const data = form.getValues()
                console.log("Veri:", data)
                onSubmit(data)
            } else {
                console.log("Hatalar:", form.formState.errors)
                onInvalid(form.formState.errors)
            }
        } catch (error) {
            console.error("DEBUG HATASI:", error)
            alert("Bir hata oluştu: " + error)
        }
    }

    return (
        <div className="space-y-8">
            {/* ... header ... */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">İlan Detayları</h2>
                    <p className="text-sm text-gray-500 mt-1">İlanınızla ilgili temel bilgileri giriniz.</p>
                </div>
                <Button variant="outline" onClick={onBack} size="sm" className="hover:bg-gray-50 border-gray-300">
                    ← Kategori Değiştir
                </Button>
            </div>

            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        console.log("NATIVE FORM SUBMIT TETİKLENDİ")
                        const data = form.getValues()
                        onSubmit(data)
                    }}
                    noValidate
                    className="space-y-8"
                >
                    {/* ... fields ... */}

                    {/* Basic Info Section */}
                    <div className="grid grid-cols-1 gap-6 p-6 bg-gray-50 rounded-xl border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-2">Temel Bilgiler</h3>
                        <div className="grid grid-cols-1 gap-6">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700 font-medium">İlan Başlığı</FormLabel>
                                        <FormControl>
                                            <Input className="h-12 text-lg bg-white border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Örn: Sahibinden temiz 2020 model..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700 font-medium">Fiyat (TL)</FormLabel>
                                        <FormControl>
                                            <Input className="h-12 text-lg font-semibold bg-white border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" type="number" min={0} placeholder="0" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* Location Section */}
                    <div className="grid grid-cols-1 gap-6 p-6 bg-gray-50 rounded-xl border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-2">Konum Bilgileri</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-gray-700 font-medium">İl</FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val)
                                                form.setValue("district", "")
                                            }}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-12 bg-white border-gray-300">
                                                    <SelectValue placeholder="İl seçiniz" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {TURKEY_CITIES.map((city) => (
                                                    <SelectItem key={city.name} value={city.name}>
                                                        {city.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="district"
                                render={({ field }) => {
                                    const selectedCity = form.watch("city")
                                    const districts = TURKEY_CITIES.find(c => c.name === selectedCity)?.districts || []

                                    return (
                                        <FormItem>
                                            <FormLabel className="text-gray-700 font-medium">İlçe</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                disabled={!selectedCity}
                                                key={selectedCity} // Force re-render on city change to update content or reset
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-12 bg-white border-gray-300">
                                                        <SelectValue placeholder="İlçe seçiniz" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {districts.map((district) => (
                                                        <SelectItem key={district} value={district}>
                                                            {district}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )
                                }}
                            />
                        </div>
                    </div>

                    {/* Dynamic Attributes Section */}
                    {attributes.length > 0 && (
                        <div className="grid grid-cols-1 gap-6 p-6 bg-gray-50 rounded-xl border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-2">Teknik Detaylar</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {attributes.map((attrItem: any) => {
                                    const attr = attrItem.attribute;
                                    return (
                                        <FormItem key={attr.id} className="space-y-2">
                                            <Label className="text-gray-700 font-medium">
                                                {attr.name} {attrItem.required && <span className="text-red-500">*</span>}
                                            </Label>

                                            {attr.type === 'SELECT' && attr.options ? (
                                                <Select
                                                    onValueChange={(val) => setAttributeValues(prev => ({ ...prev, [attr.id]: val }))}
                                                >
                                                    <SelectTrigger className="h-11 bg-white border-gray-300">
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
                                                    className="h-11 bg-white border-gray-300"
                                                    placeholder={attr.name}
                                                    type={attr.type === 'NUMBER' ? 'number' : 'text'}
                                                    onChange={(e) => setAttributeValues(prev => ({ ...prev, [attr.id]: e.target.value }))}
                                                />
                                            )}
                                        </FormItem>
                                    )
                                })}
                            </div>
                        </div>
                    )}


                    {/* Description Section */}
                    <div className="grid grid-cols-1 gap-6 p-6 bg-gray-50 rounded-xl border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-2">İlan Açıklaması</h3>
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Textarea
                                            placeholder="İlanınızla ilgili detaylı bilgi verin... (Kozmetik durumu, bakımları, eksikleri vb.)"
                                            className="min-h-[200px] text-base leading-relaxed bg-white border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 p-4 transition-all"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="flex justify-end pt-6 relative z-10">
                        <Button
                            type="submit"
                            size="lg"
                            className="w-full md:w-auto px-12 h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
                        >
                            Devam Et →
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
