"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { getNewMessages, markMessagesAsRead } from "@/actions/message"
import { Check, CheckCheck, ChevronDown } from "lucide-react"

interface Message {
    id: string
    content: string
    senderId: string
    createdAt: Date | string
    read: boolean
}

interface MessageListProps {
    messages: Message[]
    currentUserId: string
    conversationId?: string
}

export function MessageList({ messages: initialMessages, currentUserId, conversationId }: MessageListProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages)
    const [isNearBottom, setIsNearBottom] = useState(true)
    const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isInitialMount = useRef(true)
    const prevMessagesLength = useRef(initialMessages.length)

    // Scroll to bottom helper (ONLY scrolls the chat container, NEVER the window)
    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        if (!containerRef.current) return
        containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior
        })
        setHasNewMessagesBelow(false)
    }, [])

    // Track scroll position to know if user is reading previous messages
    const handleScroll = () => {
        if (!containerRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current
        const distanceToBottom = scrollHeight - scrollTop - clientHeight
        const nearBottom = distanceToBottom < 120
        setIsNearBottom(nearBottom)
        if (nearBottom) {
            setHasNewMessagesBelow(false)
        }
    }

    // Initial mount: scroll to bottom instantly without smooth animation
    useEffect(() => {
        if (isInitialMount.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight
            isInitialMount.current = false
        }
    }, [])

    // Initial update when initialMessages prop changes
    useEffect(() => {
        setMessages(initialMessages)
        prevMessagesLength.current = initialMessages.length
    }, [initialMessages])

    // Mark messages as read on mount and on window focus
    useEffect(() => {
        if (!conversationId) return

        markMessagesAsRead(conversationId)

        const handleFocus = () => {
            markMessagesAsRead(conversationId)
        }

        window.addEventListener("focus", handleFocus)
        return () => window.removeEventListener("focus", handleFocus)
    }, [conversationId])

    // Listen to local 'message-sent' event from ChatInput for zero-latency optimistic display
    useEffect(() => {
        const handleMessageSent = (e: any) => {
            if (e.detail) {
                const newMsg = e.detail
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev
                    return [...prev, newMsg]
                })
                setTimeout(() => scrollToBottom("smooth"), 30)
            }
        }

        window.addEventListener("message-sent", handleMessageSent)
        return () => window.removeEventListener("message-sent", handleMessageSent)
    }, [scrollToBottom])

    // Polling effect for new incoming messages and read receipts
    useEffect(() => {
        if (!conversationId) return

        let isMounted = true

        const poll = async () => {
            try {
                const res = await getNewMessages(conversationId)
                if (!isMounted || !res.success || !res.messages) return

                setMessages(prev => {
                    const isLengthDifferent = res.messages.length !== prev.length
                    const hasDifferentContentOrRead = res.messages.some((m: any, idx: number) => {
                        const pm = prev[idx]
                        return !pm || pm.id !== m.id || pm.read !== m.read || pm.content !== m.content
                    })

                    if (!isLengthDifferent && !hasDifferentContentOrRead) {
                        return prev
                    }

                    if (res.messages.length > prev.length) {
                        const newItems = res.messages.slice(prev.length)
                        const sentByMe = newItems.some((m: any) => m.senderId === currentUserId)

                        if (sentByMe || isNearBottom) {
                            setTimeout(() => scrollToBottom("smooth"), 40)
                        } else {
                            setHasNewMessagesBelow(true)
                        }
                    }

                    return res.messages
                })
            } catch (err) {
                console.error("Polling error:", err)
            }
        }

        const interval = setInterval(poll, 1500)
        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [conversationId, currentUserId, isNearBottom, scrollToBottom])

    return (
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50/50">
            {/* Scrollable chat messages container */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-2"
            >
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
                                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                <div className={cn(
                                    "text-[10px] flex items-center justify-end gap-1 mt-1 opacity-80 select-none",
                                    isMe ? "text-blue-100" : "text-gray-400"
                                )}>
                                    <span>
                                        {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isMe && (
                                        <span
                                            className="inline-flex items-center"
                                            title={msg.read ? "Görüldü" : "İletildi"}
                                        >
                                            {msg.read ? (
                                                <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[2.5]" />
                                            ) : (
                                                <Check className="w-3.5 h-3.5 text-blue-200/80 stroke-[2.5]" />
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Floating scroll-to-bottom button when scrolled up & new messages arrive */}
            {hasNewMessagesBelow && (
                <button
                    onClick={() => scrollToBottom("smooth")}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-full shadow-lg hover:bg-primary/90 flex items-center gap-1.5 animate-bounce z-10 transition-all"
                >
                    <span>Yeni mesajlar</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    )
}
