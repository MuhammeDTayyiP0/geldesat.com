"use client"

import * as React from "react"
import { Share2, Copy, Check, Twitter, Facebook, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ShareButtonProps {
    title: string
    url?: string
    className?: string
}

export function ShareButton({ title, url, className }: ShareButtonProps) {
    const [isOpen, setIsOpen] = React.useState(false) // Popover state
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false) // Drawer state
    const [hasCopied, setHasCopied] = React.useState(false)
    const [isMobile, setIsMobile] = React.useState(false)
    const [canNativeShare, setCanNativeShare] = React.useState(false)

    // URL'i al (SSR uyumlu)
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "")

    React.useEffect(() => {
        const checkMobile = () => {
            const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent
            const mobile = Boolean(
                /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
                (typeof window !== 'undefined' && window.matchMedia("(max-width: 768px)").matches)
            )
            setIsMobile(mobile)
            setCanNativeShare(mobile && typeof navigator !== "undefined" && !!navigator.share)
        }
        checkMobile()
    }, [])

    const handleNativeShare = async () => {
        try {
            await navigator.share({
                title: title,
                text: `${title} - GeldeSat`,
                url: shareUrl,
            })
        } catch (error) {
            console.error("Share failed:", error)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl)
        setHasCopied(true)
        toast.success("Bağlantı kopyalandı")
        setTimeout(() => setHasCopied(false), 2000)
    }

    const shareToSocial = (platform: 'whatsapp' | 'twitter' | 'facebook') => {
        let href = ''
        const text = encodeURIComponent(`${title} - GeldeSat`)
        const u = encodeURIComponent(shareUrl)

        switch (platform) {
            case 'whatsapp':
                href = `https://wa.me/?text=${text}%20${u}`
                break
            case 'twitter':
                href = `https://twitter.com/intent/tweet?text=${text}&url=${u}`
                break
            case 'facebook':
                href = `https://www.facebook.com/sharer/sharer.php?u=${u}`
                break
        }

        window.open(href, '_blank', 'width=600,height=400')
        // Close popover or drawer
        setIsOpen(false)
        setIsDrawerOpen(false)
    }

    const ShareContent = () => (
        <div className="grid gap-4 py-4">
            <div className="flex gap-4 justify-center">
                <Button variant="outline" size="lg" onClick={() => shareToSocial('whatsapp')} className="flex flex-col gap-1 h-auto py-2 hover:text-green-600 hover:bg-green-50">
                    <MessageCircle className="h-6 w-6" />
                    <span className="text-xs">WhatsApp</span>
                </Button>
                <Button variant="outline" size="lg" onClick={() => shareToSocial('twitter')} className="flex flex-col gap-1 h-auto py-2 hover:text-blue-400 hover:bg-blue-50">
                    <Twitter className="h-6 w-6" />
                    <span className="text-xs">Twitter</span>
                </Button>
                <Button variant="outline" size="lg" onClick={() => shareToSocial('facebook')} className="flex flex-col gap-1 h-auto py-2 hover:text-blue-600 hover:bg-blue-50">
                    <Facebook className="h-6 w-6" />
                    <span className="text-xs">Facebook</span>
                </Button>
            </div>

            <div className="flex items-center space-x-2 px-4 md:px-0">
                <div className="grid flex-1 gap-2">
                    <div className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm flex items-center text-muted-foreground overflow-hidden whitespace-nowrap">
                        {shareUrl}
                    </div>
                </div>
                <Button size="icon" variant="secondary" onClick={copyToClipboard} className="shrink-0">
                    {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    )

    // 1. Mobil + Native Share Var: Native Buton
    if (canNativeShare) {
        return (
            <Button
                variant="outline"
                className={cn("shrink-0 h-10 w-10 sm:h-auto sm:w-auto p-0 sm:px-4 gap-2", className)}
                onClick={handleNativeShare}
                title="Paylaş"
            >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Paylaş</span>
            </Button>
        )
    }

    // 2. Mobil + Native Share Yok: Drawer
    if (isMobile) {
        return (
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn("shrink-0 h-12 w-12 p-0 gap-2", className)} // Mobilde büyük
                        title="Paylaş"
                    >
                        <Share2 className="h-5 w-5" />
                        <span className="hidden sm:inline">Paylaş</span>
                    </Button>
                </DrawerTrigger>
                <DrawerContent>
                    <DrawerHeader className="text-left">
                        <DrawerTitle>İlanı Paylaş</DrawerTitle>
                        <DrawerDescription>
                            Bu ilanı arkadaşlarınızla paylaşın.
                        </DrawerDescription>
                    </DrawerHeader>
                    <ShareContent />
                    <DrawerFooter className="pt-2">
                        <DrawerClose asChild>
                            <Button variant="outline">İptal</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        )
    }

    // 3. Desktop: Popover
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("shrink-0 gap-2", className)}>
                    <Share2 className="h-4 w-4" />
                    <span>Paylaş</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px]">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">İlanı Paylaş</h4>
                    <p className="text-sm text-muted-foreground">
                        Sosyal medyada paylaşın veya linki kopyalayın.
                    </p>
                </div>
                <ShareContent />
            </PopoverContent>
        </Popover>
    )
}
