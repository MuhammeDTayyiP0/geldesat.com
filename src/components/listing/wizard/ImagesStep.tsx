"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Upload, Image as ImageIcon, GripVertical, Loader2, AlertCircle } from "lucide-react"
import Image from "next/image"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ImageState {
    id: string
    file?: File
    preview: string
    serverUrl?: string
    status: 'pending' | 'uploading' | 'complete' | 'error'
    filename?: string
}

interface ImagesStepProps {
    onNext: (images: ImageState[]) => void
    onBack: () => void
    initialImages?: ImageState[]
}

function SortableImage({ image, removeImage, index }: { image: ImageState, removeImage: (id: string, filename?: string) => void, index: number }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: image.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div ref={setNodeRef} style={style} className="relative group aspect-square">
            <Card className={`h-full w-full overflow-hidden relative border-2 ${image.status === 'error' ? 'border-red-500' : 'border-transparent'}`}>
                {/* Drag Handle - Only show if complete */}
                {image.status === 'complete' && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="absolute top-2 left-2 z-10 p-1 bg-black/50 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                    >
                        <GripVertical className="h-4 w-4" />
                    </div>
                )}

                {/* Status Overlays */}
                {image.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center flex-col gap-2 text-white">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-xs font-medium">Yükleniyor...</span>
                    </div>
                )}

                {image.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/20 z-20 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                )}


                <Image
                    src={image.preview}
                    alt="Preview"
                    fill
                    unoptimized
                    className={`object-cover ${image.status === 'uploading' ? 'blur-sm' : ''}`}
                />


                <button
                    onClick={() => removeImage(image.id, image.filename)}
                    type="button"
                    className="absolute top-1 right-1 z-30 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-sm"
                >
                    <X className="h-3.5 w-3.5" />
                </button>

                {index === 0 && image.status === 'complete' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[10px] py-1 text-center font-bold tracking-wide">
                        KAPAK
                    </div>
                )}
            </Card>
        </div>
    )
}

export function ImagesStep({ onNext, onBack, initialImages = [] }: ImagesStepProps) {
    const [images, setImages] = useState<ImageState[]>(initialImages)

    // Upload function
    const uploadFile = async (file: File, id: string) => {
        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) throw new Error("Upload failed")

            const data = await res.json()

            setImages(prev => prev.map(img => {
                if (img.id === id) {
                    return {
                        ...img,
                        status: 'complete',
                        serverUrl: data.url,
                        filename: data.filename
                    }
                }
                return img
            }))

        } catch (error) {
            console.error("Upload failed", error)
            setImages(prev => prev.map(img => {
                if (img.id === id) return { ...img, status: 'error' }
                return img
            }))
        }
    }

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const onDrop = useCallback((acceptedFiles: File[]) => {
        acceptedFiles.forEach(file => {
            const id = Math.random().toString(36).substring(7)
            const preview = URL.createObjectURL(file)

            // Add to state immediately
            setImages(prev => [...prev, {
                id,
                file,
                preview,
                status: 'uploading'
            }])

            // Start upload
            uploadFile(file, id)
        })
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.webp']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
    })

    const removeImage = async (id: string, filename?: string) => {
        // If it has a filename, delete from server
        if (filename) {
            try {
                // Fire and forget delete request to avoid UI lag
                fetch("/api/upload", {
                    method: "DELETE",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename })
                })
            } catch (e) {
                console.error("Delete failed", e)
            }
        }

        // Revoke URL (only if created locally)
        const img = images.find(i => i.id === id)
        if (img?.preview && img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)

        setImages(prev => prev.filter(item => item.id !== id))
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            setImages((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id)
                const newIndex = items.findIndex((item) => item.id === over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }

    const handleNext = () => {
        const completedImages = images.filter(i => i.status === 'complete' && i.serverUrl)
        if (completedImages.length === 0) {
            alert("Lütfen en az bir fotoğraf yükleyiniz ve yüklemenin tamamlandığından emin olunuz.")
            return
        }

        // Check if any is still uploading
        if (images.some(i => i.status === 'uploading')) {
            alert("Bazı fotoğraflar hala yükleniyor, lütfen bekleyiniz.")
            return
        }

        // Pass full state
        onNext(images)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold">Fotoğraflar</h2>
                    <p className="text-sm text-muted-foreground">İlanınız için en fazla 10 fotoğraf yükleyebilirsiniz.</p>
                </div>
                <Button variant="ghost" onClick={onBack} size="sm">Geri Dön</Button>
            </div>

            {/* Dropzone Area */}
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 relative overflow-hidden group
          ${isDragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"}
        `}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-3 relative z-10">
                    <div className={`p-4 rounded-full transition-colors duration-300 ${isDragActive ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-500 group-hover:scale-110'}`}>
                        <Upload className="h-8 w-8" />
                    </div>
                    {isDragActive ? (
                        <p className="text-primary font-bold text-lg">Fotoğrafları buraya bırakın...</p>
                    ) : (
                        <div className="space-y-1">
                            <p className="font-semibold text-lg text-slate-700">Fotoğrafları Sürükleyin veya Seçin</p>
                            <p className="text-sm text-muted-foreground">PNG, JPG, WEBP (Maksimum 10MB)</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Grid */}
            {images.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={images.map(f => f.id)}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {images.map((image, index) => (
                                <SortableImage
                                    key={image.id}
                                    image={image}
                                    index={index}
                                    removeImage={removeImage}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {images.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 bg-slate-50 rounded-xl border border-slate-100">
                    <ImageIcon className="h-16 w-16 mb-3" />
                    <p className="text-lg font-medium">Henüz fotoğraf yüklenmedi</p>
                </div>
            )}

            <div className="flex justify-end pt-6 border-t">
                <Button
                    onClick={handleNext}
                    size="lg"
                    disabled={images.length === 0 || images.some(i => i.status === 'uploading')}
                    className="px-8 font-bold shadow-lg shadow-primary/20"
                >
                    {images.some(i => i.status === 'uploading') ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yükleniyor...
                        </>
                    ) : (
                        `Devam Et (${images.length} Fotoğraf)`
                    )}
                </Button>
            </div>
        </div>
    )
}
