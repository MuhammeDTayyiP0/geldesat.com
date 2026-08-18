"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { PlusCircle } from "lucide-react"
import { createCategory } from "@/actions/category"

interface AddCategoryDialogProps {
    parentId?: string | null
    parentName?: string
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function AddCategoryDialog({ parentId, parentName, trigger, onSuccess }: AddCategoryDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        if (parentId) formData.append("parentId", parentId)

        const res = await createCategory(formData)
        setLoading(false)

        if (res.error) {
            alert(res.error)
        } else {
            setOpen(false)
            onSuccess?.()
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button size="sm" className="gap-2">
                        <PlusCircle className="w-4 h-4" />
                        {parentName ? `${parentName} altına ekle` : "Ana Kategori Ekle"}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kategori Ekle</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Kategori Adı</Label>
                        <Input name="name" placeholder="Örn: Elektronik" required />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug (URL Kısmı)</Label>
                        <Input name="slug" placeholder="rn: elektronik" required />
                        <p className="text-xs text-muted-foreground">Boşluk bırakmayın, Türkçe karakter kullanmayın.</p>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                        {loading ? "Ekleniyor..." : "Oluştur"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
