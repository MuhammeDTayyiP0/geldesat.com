"use client"

import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { getUnreadMessageCount } from "@/actions/notification"

interface NotificationBellProps {
    initialCount?: number
}

export function NotificationBell({ initialCount = 0 }: NotificationBellProps) {
    const [count, setCount] = useState(initialCount)
    const [isPending, startTransition] = useTransition()

    // Poll for new messages every 3 seconds
    useEffect(() => {
        const fetchCount = () => {
            startTransition(async () => {
                const newCount = await getUnreadMessageCount()
                setCount(newCount)
            })
        }

        // Initial fetch
        fetchCount()

        const interval = setInterval(fetchCount, 3000)
        return () => clearInterval(interval)
    }, [])

    const hasUnread = count > 0

    return (
        <Button
            asChild
            variant="ghost"
            size="icon"
            className={`relative h-10 w-10 rounded-full transition-all ${
                hasUnread 
                    ? "text-red-500 hover:text-red-600 hover:bg-red-50" 
                    : "text-muted-foreground hover:bg-muted/80"
            }`}
        >
            <Link href="/messages">
                <MessageSquare className={`h-5 w-5 ${hasUnread ? "fill-red-500/20" : ""}`} />
                {hasUnread && (
                    <>
                        {/* Pulsing red glow behind the badge */}
                        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px]">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                {count > 99 ? "99+" : count}
                            </span>
                        </span>
                    </>
                )}
            </Link>
        </Button>
    )
}

