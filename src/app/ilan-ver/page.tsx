"use client"

import { useState } from "react"
import { CategoryStep } from "@/components/listing/wizard/CategoryStep"
import { DetailsStep } from "@/components/listing/wizard/DetailsStep"
import { Card } from "@/components/ui/card"
import { ImagesStep } from "@/components/listing/wizard/ImagesStep"
import { PreviewStep } from "@/components/listing/wizard/PreviewStep"



interface ImageState {
    id: string
    file?: File
    preview: string
    serverUrl?: string
    status: 'pending' | 'uploading' | 'complete' | 'error'
    filename?: string
}

export default function PostListingPage() {
    const [step, setStep] = useState<"category" | "details" | "images" | "preview">("category")
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [listingDetails, setListingDetails] = useState<any>(null)
    const [listingImages, setListingImages] = useState<ImageState[]>([])
    const [isPublished, setIsPublished] = useState(false)

    const handleCategorySelect = (categoryId: string) => {
        setSelectedCategoryId(categoryId)
        setStep("details")
    }

    const handleDetailsSubmit = (data: any) => {
        setListingDetails(data)
        setStep("images")
    }

    const handleImagesSubmit = (images: ImageState[]) => {
        setListingImages(images)
        setStep("preview")
    }

    // Cleanup on unmount if not published
    // Note: This mainly handles client-side navigation. Browser close is harder to catch reliably.
    /* 
    useEffect(() => {
        return () => {
            if (!isPublished && listingImages.length > 0) {
                 // Clean up uploaded images
                 listingImages.forEach(img => {
                     if (img.filename) {
                         const blob = new Blob([JSON.stringify({ filename: img.filename })], { type: 'application/json' });
                         navigator.sendBeacon('/api/upload/delete', blob);
                     }
                 })
            }
        }
    }, [isPublished, listingImages]) 
    */
    // The above effect is risky if it triggers on simple re-renders or step changes. 
    // Instead, we trust the "Cleanup" button or cron jobs for strictly abandoned files, 
    // OR we only trigger if we are leaving the route. 
    // For this specific request, let's implement a robust "Cancel" button in the UI that does cleanup.

    const [isSubmitting, setIsSubmitting] = useState(false)

    const handlePublish = async () => {
        if (!selectedCategoryId || !listingDetails) return

        // Validate all images are uploaded
        const notUploaded = listingImages.filter(i => i.status !== 'complete' || !i.serverUrl)
        if (notUploaded.length > 0) {
            alert("Bazı resimler henüz yüklenmedi. Lütfen bekleyiniz.")
            return
        }

        setIsSubmitting(true)

        try {
            const formData = new FormData()
            formData.append("categoryId", selectedCategoryId)
            formData.append("title", listingDetails.title)
            formData.append("description", listingDetails.description)
            formData.append("price", listingDetails.price.toString())
            formData.append("city", listingDetails.city)
            formData.append("district", listingDetails.district)

            // Append attributes
            if (listingDetails.attributes) {
                Object.entries(listingDetails.attributes).forEach(([key, value]) => {
                    formData.append(`attributes[${key}]`, value as string)
                })
            }

            // Append uploaded image URLs
            listingImages.forEach((img) => {
                if (img.serverUrl) {
                    formData.append("uploadedImages", img.serverUrl)
                }
            })

            // Dynamic import to avoid client-side build issues with fs/promises if any
            const { createListing } = await import("@/actions/listing")
            const result = await createListing(formData)

            if (result.error) {
                alert(result.error)
            } else {
                setIsPublished(true)
                // alert("Tebrikler! İlanınız başarıyla yayına alındı.")
                window.location.href = "/my-listings"
            }
        } catch (error) {
            console.error("Publish Error:", error)
            alert("Bir hata oluştu: " + (error instanceof Error ? error.message : "Bilinmeyen hata"))
        } finally {
            setIsSubmitting(false)
        }
    }

    // Explicit cancel handler
    const handleCancel = async () => {
        if (confirm("İlan vermekten vazgeçmek üzeresiniz. Yüklenen resimler silinecektir. Onaylıyor musunuz?")) {
            // Delete images
            for (const img of listingImages) {
                if (img.filename) {
                    await fetch('/api/upload', {
                        method: 'DELETE',
                        body: JSON.stringify({ filename: img.filename })
                    }).catch(console.error)
                }
            }
            window.location.href = "/"
        }
    }

    const steps = [
        { id: "category", label: "Kategori" },
        { id: "details", label: "İlan Detayları" },
        { id: "images", label: "Fotoğraflar" },
        { id: "preview", label: "Önizleme" },
    ]

    const currentStepIndex = steps.findIndex(s => s.id === step)

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <h1 className="text-3xl font-bold mb-8 text-center text-primary">Ücretsiz İlan Ver</h1>

            {/* Stepper */}
            <div className="mb-8">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded"></div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded transition-all duration-300" style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}></div>

                    {steps.map((s, i) => {
                        const isCompleted = i < currentStepIndex
                        const isCurrent = i === currentStepIndex

                        return (
                            <div key={s.id} className="flex flex-col items-center gap-2 bg-background px-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors duration-300 border-2 ${isCurrent ? 'border-primary bg-primary text-primary-foreground' : isCompleted ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-background text-gray-500'}`}>
                                    {isCompleted ? '✓' : i + 1}
                                </div>
                                <span className={`text-xs font-medium ${isCurrent ? 'text-primary' : 'text-gray-500'}`}>{s.label}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <Card className="p-8 shadow-lg border-0 bg-white relative">
                {/* global cancel button */}
                <button onClick={handleCancel} className="absolute top-4 right-4 text-xs text-red-500 hover:underline">
                    İptal Et
                </button>

                {step === "category" && (
                    <CategoryStep onSelect={handleCategorySelect} />
                )}

                {step === "details" && selectedCategoryId && (
                    <DetailsStep
                        onNext={handleDetailsSubmit}
                        onBack={() => setStep("category")}
                        categoryId={selectedCategoryId}
                        initialData={listingDetails}
                    />
                )}

                {step === "images" && (
                    <ImagesStep
                        onNext={handleImagesSubmit}
                        onBack={() => setStep("details")}
                        initialImages={listingImages}
                    />
                )}

                {step === "preview" && (
                    <PreviewStep
                        data={listingDetails}
                        images={listingImages}
                        onPublish={handlePublish}
                        onBack={() => setStep("images")}
                        isSubmitting={isSubmitting}
                    />
                )}
            </Card>
        </div>
    )
}

