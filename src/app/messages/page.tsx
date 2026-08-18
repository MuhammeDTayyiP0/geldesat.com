
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { MessageSquare, User, Search, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default async function MessagesPage() {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/auth/login?callbackUrl=/messages")
    }
    const currentUserId = session.user.id


    const conversations = await db.conversation.findMany({
        where: {
            OR: [
                { buyerId: currentUserId },
                { sellerId: currentUserId }
            ]
        },
        include: {
            listing: true,
            buyer: true,
            seller: true,
            messages: {
                orderBy: {
                    createdAt: 'desc'
                },
                take: 1
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    })

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl min-h-screen">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary">
                        <MessageSquare className="w-8 h-8" />
                    </div>
                    Mesajlarım
                </h1>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Mesajlarda ara..."
                        className="pl-9 bg-white border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                </div>
            </div>

            {conversations.length === 0 ? (
                <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MessageSquare className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Henüz mesajınız yok</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">İlan sahipleriyle iletişime geçin veya ilanlarınıza gelen soruları buradan takip edin.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {conversations.map((conv) => {
                        const otherUser = conv.buyerId === currentUserId ? conv.seller : conv.buyer
                        const lastMessage = conv.messages[0]
                        const isUnread = lastMessage && !lastMessage.read && lastMessage.senderId !== currentUserId

                        return (
                            <Link key={conv.id} href={`/messages/${conv.id}`}>
                                <Card className={cn(
                                    "p-0 hover:shadow-md transition-all cursor-pointer border-gray-100 overflow-hidden group",
                                    isUnread ? "bg-blue-50/40 border-l-4 border-l-blue-500" : "bg-white"
                                )}>
                                    <div className="p-4 flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-gray-100">
                                                {otherUser.image ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={otherUser.image} alt={otherUser.name || "User"} className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-7 h-7 text-gray-400" />
                                                )}
                                            </div>
                                            {isUnread && <span className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-white rounded-full"></span>}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className={cn("font-bold text-gray-900 truncate", isUnread && "text-blue-900")}>
                                                    {otherUser.name}
                                                </h3>
                                                <span className="text-xs text-gray-400 whitespace-nowrap ml-2 font-medium">
                                                    {lastMessage ? new Date(lastMessage.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : ''}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 truncate max-w-[150px]">
                                                    {conv.listing.title}
                                                </span>
                                            </div>

                                            <p className={cn(
                                                "text-sm truncate",
                                                isUnread ? "text-gray-900 font-medium" : "text-gray-500"
                                            )}>
                                                {lastMessage?.senderId === currentUserId ? <span className="text-gray-400 text-xs mr-1">Siz:</span> : ""}
                                                {lastMessage?.content || "Resim gönderildi."}
                                            </p>
                                        </div>

                                        <div className="text-gray-300 group-hover:text-primary transition-colors">
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
