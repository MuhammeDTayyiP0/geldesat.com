"use client"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, LogOut, Heart, List, MessageSquare, Shield, Bell } from "lucide-react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function UserNav({ user }: { user: any }) {
    const [logoutOpen, setLogoutOpen] = useState(false)

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-slate-100 hover:ring-blue-100 transition-all p-0 overflow-hidden">
                        <Avatar className="h-full w-full">
                            <AvatarImage src={user.image} alt={user.name} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium">
                                {user.name?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
                    <div className="flex items-center gap-3 p-2 bg-slate-50/50 rounded-md mb-2">
                        <Avatar className="h-10 w-10 border shadow-sm">
                            <AvatarImage src={user.image} alt={user.name} />
                            <AvatarFallback className="bg-slate-200 text-slate-600">{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-0.5 leading-none overflow-hidden">
                            <p className="font-semibold text-sm truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {user.email}
                            </p>
                        </div>
                    </div>

                    <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer py-2.5">
                            <User className="mr-2 h-4 w-4 text-slate-500" /> Profilim
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/my-listings" className="cursor-pointer py-2.5">
                            <List className="mr-2 h-4 w-4 text-slate-500" /> İlanlarım
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/favorites" className="cursor-pointer py-2.5">
                            <Heart className="mr-2 h-4 w-4 text-slate-500" /> Favorilerim
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/messages" className="cursor-pointer py-2.5">
                            <MessageSquare className="mr-2 h-4 w-4 text-slate-500" /> Mesajlarım
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/bildirimler" className="cursor-pointer py-2.5">
                            <Bell className="mr-2 h-4 w-4 text-slate-500" /> Bildirimler
                        </Link>
                    </DropdownMenuItem>

                    {user.role === "ADMIN" && (
                        <DropdownMenuItem asChild>
                            <Link href="/admin" className="cursor-pointer py-2.5 text-blue-600 font-medium">
                                <Shield className="mr-2 h-4 w-4" /> Yönetim Paneli
                            </Link>
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator className="my-2" />

                    <DropdownMenuItem
                        className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50 py-2.5"
                        onSelect={(e) => {
                            e.preventDefault()
                            setLogoutOpen(true)
                        }}
                    >
                        <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Çıkış Yap</AlertDialogTitle>
                        <AlertDialogDescription>Oturumunuzu sonlandırmak istediğinize emin misiniz?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => signOut()} className="bg-red-600 hover:bg-red-700">Çıkış Yap</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
