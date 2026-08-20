"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { sendMessage } from "@/actions/message"

interface ChatInputProps {
    conversationId: string
}

export function ChatInput({ conversationId }: ChatInputProps) {
    const [message, setMessage] = useState("")
    const [sending, setSending] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        const textToSend = message.trim()
        if (!textToSend || sending) return

        setSending(true)
        setMessage("")

        // Keep input focused immediately on desktop and mobile
        inputRef.current?.focus()

        const result = await sendMessage(conversationId, textToSend)

        if (result.error) {
            alert(result.error)
            setMessage(textToSend) // restore text if send failed
        } else if (result.message) {
            window.dispatchEvent(new CustomEvent("message-sent", { detail: result.message }))
        }

        setSending(false)
        // Maintain focus after send finishes
        setTimeout(() => {
            inputRef.current?.focus()
        }, 10)
    }

    return (
        <form onSubmit={handleSend} className="flex items-center gap-2 bg-gray-50 dark:bg-card p-2 rounded-2xl border border-gray-200 dark:border-gray-800 focus-within:border-primary/50 transition-colors">
            <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Bir mesaj yazın..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 h-10 py-2 text-[16px] md:text-sm"
                autoComplete="off"
            />

            <Button
                type="submit"
                size="icon"
                disabled={sending || !message.trim()}
                className={message.trim() ? "bg-primary text-white hover:bg-primary/90 rounded-full shrink-0 transition-all shadow-sm" : "bg-gray-200 dark:bg-gray-800 text-gray-400 rounded-full shrink-0 transition-all"}
            >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </Button>
        </form>
    )
}

