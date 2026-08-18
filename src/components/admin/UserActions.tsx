"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash, Shield, ShieldOff, Loader2 } from "lucide-react"
import { UserRole } from "@prisma/client"
import { updateUserRole, deleteUser } from "@/actions/admin"

interface UserActionsProps {
    userId: string
    currentRole: UserRole
}

export function UserActions({ userId, currentRole }: UserActionsProps) {
    const [loading, setLoading] = useState(false)

    const handleRoleChange = async (newRole: UserRole) => {
        setLoading(true)
        const res = await updateUserRole(userId, newRole)
        setLoading(false)
        if (res.error) {
            alert(res.error)
        } else {
            // Success feedback
        }
    }

    const handleDelete = async () => {
        if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return

        setLoading(true)
        const res = await deleteUser(userId)
        setLoading(false)
        if (res.error) {
            alert(res.error)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading}>
                    <span className="sr-only">Menüyü aç</span>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                <DropdownMenuItem
                    onClick={() => navigator.clipboard.writeText(userId)}
                >
                    ID Kopyala
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {currentRole === "USER" ? (
                    <DropdownMenuItem onClick={() => handleRoleChange("ADMIN")}>
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Yap
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem onClick={() => handleRoleChange("USER")}>
                        <ShieldOff className="mr-2 h-4 w-4" />
                        User Yap
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash className="mr-2 h-4 w-4" />
                    Kullanıcıyı Sil
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
