"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { sendMessage } from "@/actions/message"

interface ChatInputProps {
    conversationId: string
}

export function ChatInput({ conversationId }: ChatInputProps) {
    const [message, setMessage] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim()) return

        setLoading(true)
        // Optimistic UI update could be improved here, but for now relying on server revalidate
        const result = await sendMessage(conversationId, message)

        if (result.error) {
            alert(result.error)
        } else {
            setMessage("")
        }
        setLoading(false)
    }

    return (
        <form onSubmit={handleSend} className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
            <Button type="button" size="icon" variant="ghost" className="text-gray-400 hover:text-gray-600 rounded-full shrink-0">
                <span className="text-xl">+</span>
            </Button>

            <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Bir mesaj yazın..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 min-h-[40px] max-h-[120px] py-2"
                disabled={loading}
                autoComplete="off"
            />

            <Button
                type="submit"
                size="icon"
                disabled={loading || !message.trim()}
                className={message.trim() ? "bg-primary text-white hover:bg-primary/90 rounded-full shrink-0 transition-all" : "bg-gray-200 text-gray-400 rounded-full shrink-0 transition-all"}
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </Button>
        </form>
    )
}
