
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
import { Button } from "@/components/ui/button"
import { Edit, Trash, ExternalLink } from "lucide-react"
import Link from "next/link"
import { ListingActions } from "@/components/admin/ListingActions"

export default async function AdminListingsPage() {
    const listings = await db.listing.findMany({
        include: {
            user: true,
            category: true
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 50
    })

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">İlan Yönetimi</h1>
            </div>

            <div className="border rounded-lg bg-card text-card-foreground">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>İlan ID</TableHead>
                            <TableHead>Başlık</TableHead>
                            <TableHead>Satıcı</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Fiyat</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Tarih</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {listings.map((listing) => (
                            <TableRow key={listing.id}>
                                <TableCell className="font-mono text-xs">{listing.id.slice(0, 8)}...</TableCell>
                                <TableCell className="max-w-[200px] truncate" title={listing.title}>
                                    <Link href={`/ilan/${listing.id}`} className="hover:underline flex items-center gap-1" target="_blank">
                                        {listing.title} <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                    </Link>
                                </TableCell>
                                <TableCell>{listing.user.name}</TableCell>
                                <TableCell>{listing.category.name}</TableCell>
                                <TableCell>
                                    {parseFloat(listing.price.toString()).toLocaleString('tr-TR')} {listing.currency}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"}>
                                        {listing.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{new Date(listing.createdAt).toLocaleDateString('tr-TR')}</TableCell>
                                <TableCell className="text-right">
                                    <ListingActions listingId={listing.id} currentStatus={listing.status} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
