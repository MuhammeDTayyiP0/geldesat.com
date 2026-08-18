import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { EditListingForm } from "@/components/listing/EditListingForm"

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user) redirect("/")

    const { id } = await params

    const listing = await db.listing.findUnique({
        where: { id },
        include: {
            attributeValues: {
                include: {
                    attribute: true
                }
            },
            category: {
                include: {
                    attributes: {
                        include: {
                            attribute: true
                        }
                    }
                }
            }
        }
    })

    if (!listing) return <div className="p-8 text-center text-red-500">İlan bulunamadı</div>
    if (listing.userId !== session.user.id) return <div className="p-8 text-center text-red-500">Yetkisiz işlem</div>

    return (
        <div className="container mx-auto py-10 max-w-2xl px-4">
            <h1 className="text-2xl font-bold mb-6">İlanı Düzenle</h1>
            <EditListingForm listing={listing} />
        </div>
    )
}
