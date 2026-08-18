"use client"

import { useState } from "react"
import Link from "next/link"
import { LayoutDashboard, List, Users, MessageSquarePlus, LogOut, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export function AdminMobileMenu() {
    const [open, setOpen] = useState(false)

    return (
        <div className="md:hidden flex items-center justify-between p-4 bg-card border-b">
            <div className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Admin Paneli
            </div>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="w-6 h-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                    <SheetHeader className="p-6 border-b text-left">
                        <SheetTitle className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-xl font-bold">
                            Yönetim Paneli
                        </SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col h-full">
                        <nav className="flex-1 p-4 space-y-2">
                            <Link
                                href="/admin"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                <LayoutDashboard className="w-5 h-5" />
                                Dashboard
                            </Link>
                            <Link
                                href="/admin/listings"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                <List className="w-5 h-5" />
                                İlanlar
                            </Link>
                            <Link
                                href="/admin/categories"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                <div className="w-5 h-5 flex items-center justify-center font-bold border rounded text-xs border-current">K</div>
                                Kategoriler
                            </Link>
                            <Link
                                href="/admin/users"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                <Users className="w-5 h-5" />
                                Kullanıcılar
                            </Link>
                            <Link
                                href="/admin/suggestions"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                <MessageSquarePlus className="w-5 h-5" />
                                Kategori Önerileri
                            </Link>
                        </nav>

                        <div className="p-4 border-t mb-8">
                            <Link
                                href="/"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                Siteye Dön
                            </Link>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
