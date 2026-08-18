"use client"

import * as React from "react"
import Image from "next/image"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    type CarouselApi,
} from "@/components/ui/carousel"
import { Maximize2, XIcon, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { createPortal } from "react-dom"

interface ListingGalleryProps {
    images: string[]
    title: string
}

export function ListingGallery({ images, title }: ListingGalleryProps) {
    const [api, setApi] = React.useState<CarouselApi>()
    const [fullscreenApi, setFullscreenApi] = React.useState<CarouselApi>()
    const [current, setCurrent] = React.useState(0)
    const [isFullscreen, setIsFullscreen] = React.useState(false)
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Normal carousel sync
    React.useEffect(() => {
        if (!api) return
        setCurrent(api.selectedScrollSnap())
        api.on("select", () => {
            setCurrent(api.selectedScrollSnap())
        })
    }, [api])

    // Fullscreen carousel sync
    React.useEffect(() => {
        if (!fullscreenApi) return
        fullscreenApi.on("select", () => {
            setCurrent(fullscreenApi.selectedScrollSnap())
        })
    }, [fullscreenApi])

    // Sync fullscreen starting index when opened
    React.useEffect(() => {
        if (isFullscreen && fullscreenApi) {
            fullscreenApi.scrollTo(current, true)
        }
    }, [isFullscreen, fullscreenApi, current])

    // Body scroll lock
    React.useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isFullscreen])

    // Esc key listener
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsFullscreen(false)
            }
        }
        if (isFullscreen) {
            window.addEventListener('keydown', handleKeyDown)
        }
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isFullscreen])

    const handleThumbnailClick = (index: number) => {
        api?.scrollTo(index)
    }

    if (!images || images.length === 0) {
        return (
            <div className="aspect-[16/9] md:aspect-[2/1] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-2xl border-2 border-dashed">
                <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium">Görsel Bulunamadı</p>
            </div>
        )
    }

    const renderFullscreenOverlay = () => {
        if (!isFullscreen) return null

        return createPortal(
            <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
                {/* Top Bar */}
                <div className="absolute top-0 left-0 w-full p-4 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                    <div className="text-white/90 font-medium tracking-widest text-sm pointer-events-auto bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-md">
                        {current + 1} <span className="opacity-50">/</span> {images.length}
                    </div>
                    <button 
                        onClick={() => setIsFullscreen(false)} 
                        className="pointer-events-auto p-2.5 bg-white/10 hover:bg-white/25 text-white rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-95"
                        aria-label="Kapat"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Main Viewer */}
                <div className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center">
                    <Carousel setApi={setFullscreenApi} opts={{ startIndex: current, loop: true }} className="w-full">
                        <CarouselContent>
                            {images.map((img, idx) => (
                                <CarouselItem key={idx}>
                                    <div className="relative w-full h-[100dvh] flex items-center justify-center p-0 md:p-12 pb-24 md:pb-24">
                                        <Image
                                            src={img}
                                            alt={`${title} - Büyük Görsel ${idx + 1}`}
                                            fill
                                            unoptimized
                                            className="object-contain"
                                            priority={idx === current || Math.abs(idx - current) <= 1}
                                        />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        
                        <div className="hidden md:block">
                            <CarouselPrevious className="left-8 bg-white/10 hover:bg-white/30 border-none text-white h-14 w-14 backdrop-blur-sm transition-all hover:scale-110 active:scale-95" />
                            <CarouselNext className="right-8 bg-white/10 hover:bg-white/30 border-none text-white h-14 w-14 backdrop-blur-sm transition-all hover:scale-110 active:scale-95" />
                        </div>
                    </Carousel>
                </div>

                {/* Bottom Thumbnails Filmstrip */}
                {images.length > 1 && (
                    <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex justify-center gap-2 md:gap-3 overflow-x-auto z-50">
                        {images.map((img, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => fullscreenApi?.scrollTo(idx)} 
                                className={cn(
                                    "w-16 h-16 md:w-20 md:h-20 relative rounded-lg overflow-hidden flex-shrink-0 transition-all duration-300", 
                                    current === idx 
                                        ? "ring-2 ring-white scale-110 shadow-xl opacity-100" 
                                        : "opacity-40 hover:opacity-100 grayscale hover:grayscale-0"
                                )}
                            >
                                 <Image src={img} fill unoptimized className="object-cover" alt="" />
                            </button>
                        ))}
                    </div>
                )}
            </div>,
            document.body
        )
    }

    return (
        <div className="space-y-4">
            {/* Büyük Resim Slider */}
            <div className="bg-black/5 dark:bg-black/20 rounded-xl overflow-hidden border shadow-sm relative group cursor-pointer" onClick={() => setIsFullscreen(true)}>
                <Carousel setApi={setApi} className="w-full pointer-events-none sm:pointer-events-auto">
                    <CarouselContent>
                        {images.map((img, idx) => (
                            <CarouselItem key={idx}>
                                <div className="aspect-[16/10] md:aspect-[16/9] relative flex items-center justify-center bg-black">
                                    <Image
                                        src={img}
                                        alt={`${title} - Görsel ${idx + 1}`}
                                        fill
                                        unoptimized
                                        className="object-contain"
                                        priority={idx === 0}
                                    />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <div onClick={(e) => e.stopPropagation()} className="hidden sm:block">
                        <CarouselPrevious className="left-4 bg-white/10 hover:bg-white/90 border-none text-white hover:text-black opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CarouselNext className="right-4 bg-white/10 hover:bg-white/90 border-none text-white hover:text-black opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </Carousel>
                <div className="absolute top-4 right-4 bg-black/50 text-white p-2 md:p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm backdrop-blur-sm">
                    <Maximize2 className="w-5 h-5" />
                </div>
                <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none z-10 font-medium tracking-wide backdrop-blur-sm">
                    {current + 1} / {images.length}
                </div>
            </div>

            {/* Küçük Resimler (Thumbnails) */}
            {images.length > 1 && (
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleThumbnailClick(idx)}
                            className={cn(
                                "relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:ring-2 hover:ring-primary cursor-pointer",
                                current === idx ? "border-primary ring-2 ring-primary/20 opacity-100 scale-105 shadow-sm" : "border-transparent opacity-60 hover:opacity-100"
                            )}
                        >
                            <Image
                                src={img}
                                alt={`Thumbnail ${idx + 1}`}
                                fill
                                unoptimized
                                className="object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}

            {mounted && renderFullscreenOverlay()}
        </div>
    )
}
