
import { db } from "@/lib/db"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User } from "lucide-react"
import { UserActions } from "@/components/admin/UserActions"

export default async function AdminUsersPage() {
    const users = await db.user.findMany({
        orderBy: {
            createdAt: 'desc'
        },
        take: 100
    })

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Kullanıcı Yönetimi</h1>
                <Badge variant="outline" className="text-lg py-1 px-4">{users.length} Kayıtlı Üye</Badge>
            </div>

            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="w-[100px]">Avatar</TableHead>
                            <TableHead>Ad Soyad</TableHead>
                            <TableHead>İletişim</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Kayıt Tarihi</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                <TableCell>
                                    <Avatar className="h-10 w-10 border border-gray-100">
                                        <AvatarImage src={user.image || ""} alt={user.name || ""} />
                                        <AvatarFallback className="bg-primary/10 text-primary">
                                            {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                                        </AvatarFallback>
                                    </Avatar>
                                </TableCell>
                                <TableCell className="font-medium text-gray-900">
                                    {user.name || "İsimsiz Kullanıcı"}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{user.email}</span>
                                        {user.phoneNumber && (
                                            <span className="text-xs text-muted-foreground">{user.phoneNumber}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={user.role === "ADMIN" ? "default" : "secondary"}
                                        className={user.role === "ADMIN" ? "bg-purple-600 hover:bg-purple-700" : ""}
                                    >
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {new Date(user.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="text-right">
                                    <UserActions userId={user.id} currentRole={user.role} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
