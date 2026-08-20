"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { MessageSquare, User, Search, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getConversations } from "@/actions/message"

export interface SerializedConversation {
    id: string
    listingId: string
    listing: {
        id: string
        title: string
        price: number
        currency: string
        images: string[]
    }
    buyerId: string
    buyer: {
        id: string
        name: string | null
        image: string | null
    }
    sellerId: string
    seller: {
        id: string
        name: string | null
        image: string | null
    }
    updatedAt: Date | string
    messages: Array<{
        id: string
        content: string
        senderId: string
        receiverId: string
        read: boolean
        createdAt: Date | string
    }>
    unreadCount: number
}

interface ConversationListProps {
    initialConversations: SerializedConversation[]
    currentUserId: string
}

function formatMessageTime(dateInput: Date | string) {
    if (!dateInput) return ""
    const date = new Date(dateInput)
    const now = new Date()

    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()
    if (isYesterday) {
        return "Dün"
    }

    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

export function ConversationList({ initialConversations, currentUserId }: ConversationListProps) {
    const [conversations, setConversations] = useState<SerializedConversation[]>(initialConversations)
    const [searchQuery, setSearchQuery] = useState("")

    // Real-time polling every 2 seconds
    useEffect(() => {
        let isMounted = true
        const fetchLatest = async () => {
            try {
                const res = await getConversations()
                if (!isMounted || !res.success || !res.conversations) return

                setConversations(res.conversations as SerializedConversation[])
            } catch (err) {
                console.error("Fetch conversations error:", err)
            }
        }

        const interval = setInterval(fetchLatest, 2000)
        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [])

    // Filter conversations based on search query
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations
        const q = searchQuery.toLowerCase()

        return conversations.filter(conv => {
            const otherUser = conv.buyerId === currentUserId ? conv.seller : conv.buyer
            const userName = (otherUser.name || "").toLowerCase()
            const listingTitle = (conv.listing.title || "").toLowerCase()
            const lastMsgContent = (conv.messages[0]?.content || "").toLowerCase()

            return userName.includes(q) || listingTitle.includes(q) || lastMsgContent.includes(q)
        })
    }, [conversations, searchQuery, currentUserId])

    return (
        <div>
            {/* Header & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-8 gap-4">
                <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800 dark:text-gray-100">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary flex items-center justify-center">
                        <MessageSquare className="w-7 h-7" />
                    </div>
                    <span>Mesajlarım</span>
                </h1>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Mesajlarda ara..."
                        className="pl-10 bg-white dark:bg-card border-gray-200 dark:border-gray-800 rounded-xl focus:border-primary focus:ring-primary/20 shadow-sm"
                    />
                </div>
            </div>

            {/* Conversations List */}
            {filteredConversations.length === 0 ? (
                <div className="text-center py-20 bg-gray-50/70 dark:bg-card/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <MessageSquare className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">
                        {searchQuery ? "Sonuç bulunamadı" : "Henüz mesajınız yok"}
                    </h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        {searchQuery
                            ? "Arama kriterlerinize uygun sohbet bulunamadı."
                            : "İlan sahipleriyle iletişime geçin veya ilanlarınıza gelen soruları buradan anlık olarak takip edin."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredConversations.map((conv) => {
                        const otherUser = conv.buyerId === currentUserId ? conv.seller : conv.buyer
                        const lastMessage = conv.messages[0]
                        const isUnread = conv.unreadCount > 0 || (lastMessage && !lastMessage.read && lastMessage.senderId !== currentUserId)

                        return (
                            <Link key={conv.id} href={`/messages/${conv.id}`} className="block group">
                                <Card className={cn(
                                    "p-0 hover:shadow-md transition-all duration-200 cursor-pointer border rounded-2xl overflow-hidden",
                                    isUnread
                                        ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-primary border-blue-200/80 dark:border-blue-900/60"
                                        : "bg-white dark:bg-card border-gray-100 dark:border-gray-800/80 hover:border-gray-200 dark:hover:border-gray-700"
                                )}>
                                    <div className="p-4 flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <div className="w-13 h-13 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-200/80 dark:border-gray-700">
                                                {otherUser.image ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={otherUser.image}
                                                        alt={otherUser.name || "User"}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <User className="w-6 h-6 text-gray-400" />
                                                )}
                                            </div>
                                            {isUnread && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary border-2 border-white dark:border-card rounded-full animate-pulse"></span>
                                            )}
                                        </div>

                                        {/* Content info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className={cn(
                                                    "font-bold text-sm truncate",
                                                    isUnread ? "text-primary font-semibold" : "text-gray-900 dark:text-gray-100"
                                                )}>
                                                    {otherUser.name || "Kullanıcı"}
                                                </h3>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 font-medium">
                                                    {lastMessage ? formatMessageTime(lastMessage.createdAt) : ""}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-muted-foreground truncate max-w-[200px]">
                                                    {conv.listing.title}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <p className={cn(
                                                    "text-xs truncate leading-relaxed",
                                                    isUnread ? "text-gray-900 dark:text-gray-100 font-semibold" : "text-muted-foreground"
                                                )}>
                                                    {lastMessage?.senderId === currentUserId ? (
                                                        <span className="text-muted-foreground font-normal mr-1">Siz:</span>
                                                    ) : null}
                                                    {lastMessage?.content || "Yeni bir sohbet başlatıldı."}
                                                </p>

                                                {conv.unreadCount > 0 && (
                                                    <span className="shrink-0 px-2 py-0.5 text-[11px] font-bold bg-primary text-white rounded-full">
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="text-gray-300 dark:text-gray-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
