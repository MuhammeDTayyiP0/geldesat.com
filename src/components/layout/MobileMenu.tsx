"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, PlusCircle, Search, User, List, Heart, Shield, LogOut, LogIn, UserPlus, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { signOut } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SearchBar } from "@/components/search/SearchBar"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface MobileMenuProps {
    user: any
}

export function MobileMenu({ user }: MobileMenuProps) {
    const [open, setOpen] = useState(false)

    return (
        <div className="md:hidden flex items-center gap-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:bg-muted/50">
                        <Search className="h-5 w-5" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="p-4 pt-10 sm:max-w-[425px] top-[20%] translate-y-0">
                    <DialogHeader>
                        <DialogTitle className="text-left mb-2">Arama Yap</DialogTitle>
                    </DialogHeader>
                    <SearchBar className="w-full" />
                </DialogContent>
            </Dialog>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button size="icon" variant="ghost" className="hover:bg-muted/50">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] flex flex-col p-0">
                    {/* Header Section */}
                    <div className="p-6 bg-muted/30 border-b">
                        {user ? (
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                    <AvatarImage src={user.image} alt={user.name} />
                                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                                        {user.name?.charAt(0).toUpperCase() || "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="font-semibold text-lg truncate">{user.name}</span>
                                    <span className="text-sm text-muted-foreground truncate">{user.email}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <h3 className="font-bold text-lg">Hoş Geldiniz</h3>
                                <p className="text-sm text-muted-foreground">İlan vermek ve fırsatları kaçırmamak için giriş yapın.</p>
                            </div>
                        )}
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto py-4">
                        <div className="px-4 space-y-1">
                            <Button asChild variant="ghost" className="w-full justify-start h-12 text-base font-normal" onClick={() => setOpen(false)}>
                                <Link href="/" className="flex items-center gap-3">
                                    <Home className="h-5 w-5 text-muted-foreground" />
                                    Ana Sayfa
                                </Link>
                            </Button>

                            {user && (
                                <>
                                    <Button asChild variant="ghost" className="w-full justify-start h-12 text-base font-normal" onClick={() => setOpen(false)}>
                                        <Link href="/profile" className="flex items-center gap-3">
                                            <User className="h-5 w-5 text-muted-foreground" />
                                            Profilim
                                        </Link>
                                    </Button>
                                    <Button asChild variant="ghost" className="w-full justify-start h-12 text-base font-normal" onClick={() => setOpen(false)}>
                                        <Link href="/my-listings" className="flex items-center gap-3">
                                            <List className="h-5 w-5 text-muted-foreground" />
                                            İlanlarım
                                        </Link>
                                    </Button>
                                    <Button asChild variant="ghost" className="w-full justify-start h-12 text-base font-normal" onClick={() => setOpen(false)}>
                                        <Link href="/favorites" className="flex items-center gap-3">
                                            <Heart className="h-5 w-5 text-muted-foreground" />
                                            Favorilerim
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>

                        <Separator className="my-4" />

                        <div className="px-4 space-y-1">
                            <Button asChild className="w-full justify-start h-12 text-base font-semibold bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary mb-2" onClick={() => setOpen(false)}>
                                <Link href="/ilan-ver" className="flex items-center gap-3">
                                    <PlusCircle className="h-5 w-5" />
                                    Ücretsiz İlan Ver
                                </Link>
                            </Button>

                            {user?.role === "ADMIN" && (
                                <Button asChild variant="ghost" className="w-full justify-start h-12 text-base font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setOpen(false)}>
                                    <Link href="/admin" className="flex items-center gap-3">
                                        <Shield className="h-5 w-5" />
                                        Yönetim Paneli
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div className="p-4 border-t bg-muted/10">
                        {!user ? (
                            <div className="grid grid-cols-2 gap-3">
                                <Button asChild variant="outline" className="w-full h-11" onClick={() => setOpen(false)}>
                                    <Link href="/auth/login" className="flex items-center gap-2">
                                        <LogIn className="h-4 w-4" /> Giriş Yap
                                    </Link>
                                </Button>
                                <Button asChild className="w-full h-11 font-bold" onClick={() => setOpen(false)}>
                                    <Link href="/auth/register" className="flex items-center gap-2">
                                        <UserPlus className="h-4 w-4" /> Kayıt Ol
                                    </Link>
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="destructive"
                                className="w-full h-11 justify-start"
                                onClick={() => {
                                    setOpen(false)
                                    signOut()
                                }}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Güvenli Çıkış
                            </Button>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
