

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { LayoutDashboard, List, Users, Settings, LogOut, MessageSquarePlus } from "lucide-react"
import { AdminMobileMenu } from "@/components/admin/AdminMobileMenu"


export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user?.email) {
        redirect("/auth/login?callbackUrl=/admin")
    }

    // Check if user is admin
    const user = await db.user.findUnique({
        where: { email: session.user.email }
    })

    if (user?.role !== "ADMIN") {
        redirect("/")
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-muted/20">
            {/* Mobile Header */}
            <AdminMobileMenu />

            {/* Sidebar */}
            <aside className="w-64 bg-card border-r hidden md:flex flex-col h-screen sticky top-0">
                <div className="p-6 border-b">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Admin
                    </h1>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent text-accent-foreground">
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </Link>
                    <Link href="/admin/listings" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors">
                        <List className="w-5 h-5" />
                        İlanlar
                    </Link>
                    <Link href="/admin/categories" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors">
                        <div className="w-5 h-5 flex items-center justify-center font-bold border rounded text-xs">K</div>
                        Kategoriler
                    </Link>
                    <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors">
                        <Users className="w-5 h-5" />
                        Kullanıcılar
                    </Link>
                    <Link href="/admin/suggestions" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors">
                        <MessageSquarePlus className="w-5 h-5" />
                        Kategori Önerileri
                    </Link>
                </nav>
                <div className="p-4 border-t">
                    <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                        <LogOut className="w-5 h-5" />
                        Siteye Dön
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    )
}
