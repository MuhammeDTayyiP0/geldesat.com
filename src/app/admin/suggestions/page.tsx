"use client"

import { useEffect, useState } from "react"
import { getSuggestions, approveSuggestion, rejectSuggestion } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SuggestionsPage() {
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Approval Dialog
    const [selectedSug, setSelectedSug] = useState<any>(null)
    const [slug, setSlug] = useState("")
    const [approveLoading, setApproveLoading] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        // Not: Server action client component'te çağrılabilir ama async/await ile.
        const data = await getSuggestions()
        setSuggestions(data)
        setLoading(false)
    }

    const openApprove = (sug: any) => {
        // Auto convert name to slug (basit slugify)
        const autoSlug = sug.categoryName.toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")

        setSlug(autoSlug)
        setSelectedSug(sug)
    }

    const handleApprove = async () => {
        if (!selectedSug) return
        setApproveLoading(true)
        const res = await approveSuggestion(selectedSug.id, slug)
        setApproveLoading(false)
        if (res.error) {
            alert(res.error)
        } else {
            setSelectedSug(null)
            loadData()
        }
    }

    const handleReject = async (id: string) => {
        if (!confirm("Bu öneriyi reddetmek istediğinize emin misiniz?")) return
        await rejectSuggestion(id)
        loadData()
    }

    if (loading) return <div className="p-8">Yükleniyor...</div>

    return (
        <div className="p-8 space-y-6">
            <h1 className="text-3xl font-bold">Kategori Önerileri</h1>

            {suggestions.length === 0 ? (
                <div className="text-muted-foreground border p-8 rounded-lg text-center bg-gray-50">Bekleyen öneri yok.</div>
            ) : (
                <div className="grid gap-4">
                    {suggestions.map((sug) => (
                        <Card key={sug.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle>{sug.categoryName}</CardTitle>
                                        <CardDescription>
                                            Öneren: {sug.user?.name || sug.user?.email} • {new Date(sug.createdAt).toLocaleDateString()}
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => openApprove(sug)}>
                                            <Check className="w-4 h-4 mr-1" /> Onayla
                                        </Button>
                                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(sug.id)}>
                                            <X className="w-4 h-4 mr-1" /> Reddet
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm space-y-1">
                                    <div><strong>Ekleneceği Yer:</strong> {sug.parent ? sug.parent.name : "Ana Kategori (Root)"}</div>
                                    {sug.description && (
                                        <div className="bg-muted p-2 rounded text-muted-foreground mt-2 text-xs">
                                            "{sug.description}"
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!selectedSug} onOpenChange={(o) => !o && setSelectedSug(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kategoriyi Onayla ve Oluştur</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-3 bg-muted rounded text-sm space-y-1">
                            <div><strong>Önerilen İsim:</strong> {selectedSug?.categoryName}</div>
                            <div><strong>Ekleneceği Parent:</strong> {selectedSug?.parent?.name || "Ana Kategori"}</div>
                        </div>

                        <div className="space-y-2">
                            <Label>Slug (URL Kısmı)</Label>
                            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                            <p className="text-xs text-muted-foreground">URL'de görünecek benzersiz isim. Türkçe karakter kullanmayın, boşluk yerine tire kullanın.</p>
                        </div>

                        <Button className="w-full" onClick={handleApprove} disabled={approveLoading}>
                            {approveLoading ? "Kategori Oluşturuluyor..." : "Kategoriyi Oluştur ve Onayla"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
