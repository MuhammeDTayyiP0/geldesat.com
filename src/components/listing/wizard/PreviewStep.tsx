"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
// import { Separator } from "@/components/ui/separator" 
import Image from "next/image"
import { CheckCircle2, ChevronLeft } from "lucide-react"



interface ImageState {
    id: string
    file?: File
    preview: string
    serverUrl?: string
    status: 'pending' | 'uploading' | 'complete' | 'error'
    filename?: string
}

interface PreviewStepProps {
    data: any
    images: ImageState[]
    onPublish: () => void
    onBack: () => void
    isSubmitting?: boolean
}

export function PreviewStep({ data, images, onPublish, onBack, isSubmitting = false }: PreviewStepProps) {
    // Helper to get preview URL for the first image (cover)
    const coverImage = images.length > 0 ? images[0].preview : null

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b">
                <h2 className="text-xl font-semibold">Ön İzleme ve Onay</h2>
                <Button variant="ghost" onClick={onBack} size="sm">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Düzenle
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Image Preview */}
                <div className="space-y-4">
                    <h3 className="font-medium text-lg">Görseller</h3>
                    {coverImage ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden border">
                            <Image
                                src={coverImage}
                                alt="Kapak Fotoğrafı"
                                fill
                                unoptimized
                                className="object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 text-xs rounded">
                                Kapak
                            </div>
                        </div>
                    ) : (
                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                            Görsel yok
                        </div>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                        {images.slice(1, 5).map((img, i) => (
                            <div key={i} className="relative aspect-square rounded overflow-hidden border">

                                <Image
                                    src={img.preview}
                                    alt={`Preview ${i}`}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                />

                            </div>
                        ))}


                        {images.length > 5 && (
                            <div className="relative aspect-square rounded overflow-hidden bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                                +{images.length - 5}
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Preview */}
                <div className="space-y-4">
                    <h3 className="font-medium text-lg">İlan Bilgileri</h3>
                    <Card className="p-4 space-y-4">
                        <div>
                            <span className="text-sm text-muted-foreground block">İlan Başlığı</span>
                            <p className="font-semibold text-lg">{data.title}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-sm text-muted-foreground block">Fiyat</span>
                                <p className="font-semibold text-xl text-primary">{parseFloat(data.price).toLocaleString('tr-TR')} TL</p>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground block">Konum</span>
                                <p className="font-medium">{data.city} / {data.district}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-sm text-muted-foreground block">Açıklama</span>
                            <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                                {data.description}
                            </p>
                        </div>
                    </Card>

                    <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3 text-sm">
                        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Yayına Hazır!</p>
                            <p>İlanınızı kontrol ettiyseniz yayınla butonuna basarak işlemi tamamlayabilirsiniz.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-6 border-t">
                <Button onClick={onPublish} size="lg" className="px-8" disabled={isSubmitting}>
                    {isSubmitting ? "Yayınlanıyor..." : "İlanı Yayınla"}
                </Button>
            </div>
        </div>
    )
}
