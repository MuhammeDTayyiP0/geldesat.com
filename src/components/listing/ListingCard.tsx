"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin, Calendar, Tag } from "lucide-react"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ListingCardProps {
    listing: any
    variant?: "grid" | "list"
}

export function ListingCard({ listing, variant = "grid" }: ListingCardProps) {
    const [isImageLoaded, setIsImageLoaded] = useState(false)

    if (!listing) return null

    // Güvenli veri erişimi
    const currency = listing.currency || "TRY"
    const priceValue = listing.price || 0
    const price = new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(priceValue)
    const image = (listing.images && listing.images.length > 0) ? listing.images[0] : null
    const date = listing.createdAt ? new Date(listing.createdAt).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }) : ""
    const location = (listing.city || listing.district) ? `${listing.city || ''} ${listing.district ? `/ ${listing.district}` : ''}` : ""

    let displayTitle = listing.title;
    if (listing.category?.name && !displayTitle.toLowerCase().includes(listing.category.name.toLowerCase())) {
        displayTitle = `${listing.category.name} ${listing.title}`;
    }

    // YATAY (LISTE) GÖRÜNÜM - Arama sonuçları için Premium Tasarım
    if (variant === "list") {
        return (
            <Link href={`/ilan/${listing.id}`} className="block w-full group">
                <div className="relative flex flex-row bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1">
                    
                    {/* Görsel Alanı */}
                    <div className="w-[130px] sm:w-[240px] relative shrink-0 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                        {image ? (
                            <>
                                {!isImageLoaded && <Skeleton className="absolute inset-0 w-full h-full z-10" />}
                                <Image
                                    src={image}
                                    alt={listing.title}
                                    fill
                                    unoptimized
                                    className={cn(
                                        "object-contain p-1 transform transition-transform duration-700 ease-out group-hover:scale-105",
                                        isImageLoaded ? "opacity-100" : "opacity-0"
                                    )}
                                    onLoad={() => setIsImageLoaded(true)}
                                    loading="lazy"
                                />
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                <Tag className="w-6 h-6 sm:w-8 sm:h-8 mb-1" />
                                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Görsel Yok</span>
                            </div>
                        )}
                        {listing.category && (
                            <div className="absolute top-2 left-2 z-20">
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                                    {listing.category.name}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* İçerik Alanı */}
                    <div className="flex-1 p-3 sm:p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                                <h3 className="font-semibold text-sm sm:text-lg text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                    {displayTitle}
                                </h3>
                                <div className="text-base sm:text-2xl font-black text-primary shrink-0 leading-none mt-1 sm:mt-0 tracking-tight">
                                    {price}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 sm:mt-4">
                            {/* Özellikler - Sadece masaüstünde biraz daha fazla gösterilir */}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-2 sm:mb-4">
                                {listing.attributeValues && listing.attributeValues.slice(0, 3).map((attr: any) => (
                                    <span key={attr.id} className="inline-flex items-center px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] sm:text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700">
                                        {attr.value}
                                    </span>
                                ))}
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] sm:text-sm text-slate-400 font-medium">
                                <div className="flex items-center truncate pr-2">
                                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 text-slate-400 shrink-0" />
                                    <span className="truncate text-slate-500">{location || "Konum Belirtilmemiş"}</span>
                                </div>
                                <div className="flex items-center shrink-0 text-slate-500">
                                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                                    <span>{date}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        )
    }

    // DİKEY (GRID) GÖRÜNÜM - Varsayılan Premium Tasarım
    return (
        <Link href={`/ilan/${listing.id}`} className="block group h-full">
            <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1.5">
                
                {/* Görsel Alanı */}
                <div className="aspect-[4/3] relative bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                    {image ? (
                        <>
                            {!isImageLoaded && <Skeleton className="absolute inset-0 w-full h-full z-10 rounded-none" />}
                            <Image
                                src={image}
                                alt={listing.title}
                                fill
                                unoptimized
                                className={cn(
                                    "object-contain p-2 transform transition-transform duration-700 ease-out group-hover:scale-105",
                                    isImageLoaded ? "opacity-100" : "opacity-0"
                                )}
                                onLoad={() => setIsImageLoaded(true)}
                                loading="lazy"
                            />
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                            <Tag className="w-8 h-8 mb-2" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Görsel Yok</span>
                        </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />

                    {listing.category && (
                        <div className="absolute top-3 left-3 z-20">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                                {listing.category.name}
                            </span>
                        </div>
                    )}
                </div>

                {/* İçerik Alanı */}
                <div className="flex flex-col flex-1 p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                            {price}
                        </div>
                    </div>
                    
                    <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug mb-4 group-hover:text-primary transition-colors">
                        {displayTitle}
                    </h3>

                    <div className="mt-auto">
                        <div className="flex items-center gap-1.5 flex-wrap mb-3">
                            {listing.attributeValues && listing.attributeValues.slice(0, 2).map((attr: any) => (
                                <span key={attr.id} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                                    {attr.value}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] sm:text-xs text-slate-400 font-medium">
                            <div className="flex items-center truncate pr-2">
                                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                                <span className="truncate text-slate-500">{location || "Konum Yok"}</span>
                            </div>
                            <div className="flex items-center shrink-0 text-slate-500">
                                <Calendar className="w-3.5 h-3.5 mr-1" />
                                <span>{date}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}
