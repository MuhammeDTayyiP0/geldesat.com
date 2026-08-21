"use client"

import { useState } from "react"
import Link from "next/link"
import { Bell, MessageSquare, Heart, Package, Check, CheckCheck, Filter } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { NotificationItem } from "@/actions/notification"

interface NotificationsListProps {
    initialNotifications: NotificationItem[]
    unreadCount: number
}

type FilterType = "all" | "message" | "favorite"

function getRelativeTime(dateStr: string | Date): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return "Az önce"
    if (diffMin < 60) return `${diffMin} dk önce`
    if (diffHour < 24) return `${diffHour} saat önce`
    if (diffDay < 7) return `${diffDay} gün önce`
    if (diffDay < 30) return `${Math.floor(diffDay / 7)} hafta önce`
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
}

function getNotificationIcon(type: NotificationItem["type"]) {
    switch (type) {
        case "message":
            return <MessageSquare className="h-5 w-5 text-blue-500" />
        case "favorite":
            return <Heart className="h-5 w-5 text-pink-500" />
        case "listing_approved":
            return <Package className="h-5 w-5 text-green-500" />
        case "listing_rejected":
            return <Package className="h-5 w-5 text-red-500" />
        case "system":
            return <Bell className="h-5 w-5 text-amber-500" />
        default:
            return <Bell className="h-5 w-5 text-slate-500" />
    }
}

function getNotificationBgClass(type: NotificationItem["type"], read: boolean) {
    if (read) return "bg-background hover:bg-muted/50"
    switch (type) {
        case "message":
            return "bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
        case "favorite":
            return "bg-pink-50/50 hover:bg-pink-50 dark:bg-pink-950/20 dark:hover:bg-pink-950/30"
        default:
            return "bg-amber-50/50 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
    }
}

export function NotificationsList({ initialNotifications, unreadCount }: NotificationsListProps) {
    const [filter, setFilter] = useState<FilterType>("all")

    const filteredNotifications = filter === "all"
        ? initialNotifications
        : initialNotifications.filter(n => n.type === filter)

    const messageCount = initialNotifications.filter(n => n.type === "message").length
    const favoriteCount = initialNotifications.filter(n => n.type === "favorite").length

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-xl">
                        <Bell className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Bildirimler</h1>
                        <p className="text-sm text-muted-foreground">
                            {unreadCount > 0 
                                ? `${unreadCount} okunmamış bildiriminiz var`
                                : "Tüm bildirimleriniz okundu"
                            }
                        </p>
                    </div>
                </div>
                {unreadCount > 0 && (
                    <Badge variant="destructive" className="text-sm px-3 py-1">
                        {unreadCount} yeni
                    </Badge>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                <Button
                    variant={filter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("all")}
                    className="rounded-full gap-2 shrink-0"
                >
                    <Filter className="h-3.5 w-3.5" />
                    Tümü
                    <Badge variant="secondary" className="ml-1 text-xs">{initialNotifications.length}</Badge>
                </Button>
                <Button
                    variant={filter === "message" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("message")}
                    className="rounded-full gap-2 shrink-0"
                >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Mesajlar
                    <Badge variant="secondary" className="ml-1 text-xs">{messageCount}</Badge>
                </Button>
                <Button
                    variant={filter === "favorite" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("favorite")}
                    className="rounded-full gap-2 shrink-0"
                >
                    <Heart className="h-3.5 w-3.5" />
                    Favoriler
                    <Badge variant="secondary" className="ml-1 text-xs">{favoriteCount}</Badge>
                </Button>
            </div>

            {/* Notifications List */}
            {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-muted/50 p-6 rounded-full mb-4">
                        <Bell className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold text-muted-foreground mb-1">
                        {filter === "all" ? "Henüz bildiriminiz yok" : "Bu kategoride bildirim yok"}
                    </h3>
                    <p className="text-sm text-muted-foreground/70 max-w-sm">
                        Mesaj aldığınızda veya ilanlarınız favorilere eklendiğinde burada göreceksiniz.
                    </p>
                </div>
            ) : (
                <div className="space-y-1 rounded-xl border overflow-hidden">
                    {filteredNotifications.map((notification, index) => (
                        <Link
                            key={notification.id}
                            href={notification.link}
                            className={`flex items-start gap-4 p-4 transition-all duration-150 ${getNotificationBgClass(notification.type, notification.read)} ${
                                index !== filteredNotifications.length - 1 ? "border-b" : ""
                            }`}
                        >
                            {/* Avatar / Icon */}
                            <div className="relative shrink-0">
                                {notification.senderImage ? (
                                    <Avatar className="h-11 w-11 border shadow-sm">
                                        <AvatarImage src={notification.senderImage} alt={notification.senderName} />
                                        <AvatarFallback className="bg-slate-100 text-slate-600 text-sm">
                                            {notification.senderName?.charAt(0).toUpperCase() || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                ) : (
                                    <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                )}
                                {/* Type badge */}
                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm leading-snug ${!notification.read ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                                        {notification.title}
                                    </p>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                                        {getRelativeTime(notification.createdAt)}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                    {notification.description}
                                </p>
                                {notification.listingTitle && notification.type !== "favorite" && (
                                    <p className="text-xs text-muted-foreground/70 mt-1 truncate">
                                        📋 {notification.listingTitle}
                                    </p>
                                )}
                            </div>

                            {/* Unread dot */}
                            {!notification.read && (
                                <div className="shrink-0 mt-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-200" />
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            )}

            {/* Summary footer */}
            {filteredNotifications.length > 0 && (
                <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
                    <CheckCheck className="h-4 w-4" />
                    Son 30 günün bildirimleri gösteriliyor
                </div>
            )}
        </div>
    )
}
