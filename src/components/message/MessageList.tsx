"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { getNewMessages } from "@/actions/message"

interface Message {
    id: string
    content: string
    senderId: string
    createdAt: Date
    read: boolean
}

interface MessageListProps {
    messages: Message[]
    currentUserId: string
    conversationId?: string // Make optional for backward compatibility if needed, but best required
}

export function MessageList({ messages: initialMessages, currentUserId, conversationId }: MessageListProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const bottomRef = useRef<HTMLDivElement>(null)
    const [isPolling, setIsPolling] = useState(true)

    useEffect(() => {
        setMessages(initialMessages)
    }, [initialMessages])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Polling effect
    useEffect(() => {
        if (!conversationId) return

        const interval = setInterval(async () => {
            const lastMessage = messages[messages.length - 1]
            const lastId = lastMessage?.id

            const res = await getNewMessages(conversationId, lastId)

            if (res.success && res.messages && res.messages.length > 0) {
                setMessages(prev => {
                    // Filter out duplicates just in case
                    const newUnique = res.messages.filter((nm: any) => !prev.some(pm => pm.id === nm.id))
                    return [...prev, ...newUnique]
                })
            }

            // Update read status for my messages
            const response = res as any
            if (response.readMessageIds && response.readMessageIds.length > 0) {
                setMessages(prev => prev.map(m => {
                    if (response.readMessageIds.includes(m.id)) {
                        return { ...m, read: true }
                    }
                    return m
                }))
            }
        }, 1000) // Poll every 1 second

        return () => clearInterval(interval)
    }, [conversationId, messages]) // Depend on messages to get latest lastId

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
            {messages.map((msg, index) => {
                const isMe = msg.senderId === currentUserId
                const isNextSame = messages[index + 1]?.senderId === msg.senderId
                const isPrevSame = messages[index - 1]?.senderId === msg.senderId

                return (
                    <div
                        key={msg.id}
                        className={cn(
                            "flex flex-col",
                            isMe ? "items-end" : "items-start",
                            !isNextSame && "mb-3"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[75%] px-4 py-2 text-sm shadow-sm relative group transition-all",
                                isMe
                                    ? "bg-primary text-white rounded-2xl rounded-tr-sm"
                                    : "bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm",
                                isPrevSame && "mt-0.5",
                                isPrevSame && isMe && "rounded-tr-2xl",
                                isPrevSame && !isMe && "rounded-tl-2xl"
                            )}
                        >
                            <p className="leading-relaxed">{msg.content}</p>
                            <span className={cn(
                                "text-[10px] block text-right mt-1 opacity-70 select-none",
                                isMe ? "text-blue-100" : "text-gray-400"
                            )}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isMe && (
                                    <span className="ml-1 inline-block">
                                        {msg.read ? "✓✓" : "✓"}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                )
            })}
            <div ref={bottomRef} />
        </div>
    )
}
