
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { User, Send, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ChatInput } from "@/components/message/ChatInput" // We will create this
import { MessageList } from "@/components/message/MessageList" // We will create this

interface ChatPageProps {
    params: {
        id: string
    }
}

export default async function ChatPage({ params }: ChatPageProps) {
    const { id } = await params
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/auth/login")
    }

    const conversation = await db.conversation.findUnique({
        where: { id },
        include: {
            listing: true,
            buyer: true,
            seller: true,
            messages: {
                orderBy: {
                    createdAt: 'asc'
                }
            }
        }
    })

    if (!conversation) {
        notFound()
    }

    // Security check: Only participants can view
    if (conversation.buyerId !== session.user.id && conversation.sellerId !== session.user.id) {
        redirect("/messages")
    }

    const otherUser = conversation.buyerId === session.user.id ? conversation.seller : conversation.buyer

    return (
        <div className="container mx-auto px-4 py-6 h-[calc(100vh-80px)] flex flex-col max-w-4xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/messages">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </Button>

                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {otherUser.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={otherUser.image} alt={otherUser.name || "User"} className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                    )}
                </div>

                <div className="flex-1">
                    <h2 className="font-semibold text-lg leading-none mb-1">{otherUser.name}</h2>
                    <Link href={`/ilan/${conversation.listingId}`} className="text-sm text-primary hover:underline">
                        {conversation.listing.title}
                    </Link>
                </div>

                <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-foreground">
                        {parseFloat(conversation.listing.price.toString()).toLocaleString('tr-TR')} {conversation.listing.currency}
                    </p>
                </div>
            </div>

            {/* Chat Area */}
            <Card className="flex-1 flex flex-col overflow-hidden mb-4">
                <MessageList
                    messages={conversation.messages}
                    currentUserId={session.user.id}
                    conversationId={conversation.id}
                />

                <div className="p-4 border-t bg-background">
                    <ChatInput conversationId={conversation.id} />
                </div>
            </Card>
        </div>
    )
}
