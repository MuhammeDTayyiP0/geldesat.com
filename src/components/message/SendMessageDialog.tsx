"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { createConversation } from "@/actions/message"
import { Send, Loader2 } from "lucide-react"

interface SendMessageDialogProps {
    listingId: string
    receiverId: string
    listingTitle: string
}

export function SendMessageDialog({ listingId, receiverId, listingTitle }: SendMessageDialogProps) {
    const [open, setOpen] = useState(false)
    const [message, setMessage] = useState("Merhaba, ilanınız ile ilgileniyorum.")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSend = async () => {
        if (!message.trim()) return

        setLoading(true)
        const formData = new FormData()
        formData.append("content", message)
        formData.append("listingId", listingId)
        formData.append("receiverId", receiverId)

        const result = await createConversation(formData)

        if (result.error) {
            alert(result.error)
        } else if (result.conversationId) {
            setOpen(false)
            router.push(`/messages/${result.conversationId}`)
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full" size="lg">
                    <Send className="w-4 h-4 mr-2" /> Mesaj Gönder
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Satıcıya Mesaj Gönder</DialogTitle>
                    <DialogDescription>
                        <strong>{listingTitle}</strong> ilanı için mesaj gönderiyorsunuz.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleSend} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Gönder
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
