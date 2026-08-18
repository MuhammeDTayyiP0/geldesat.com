"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Settings, Trash, Plus, Pencil, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { addAttributeToCategory, removeAttributeFromCategory, updateCategoryAttribute } from "@/actions/category"

interface ManageAttributesDialogProps {
    categoryId: string
    categoryName: string
    existingAttributes: any[]
    trigger?: React.ReactNode
}

export function ManageAttributesDialog({ categoryId, categoryName, existingAttributes, trigger }: ManageAttributesDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [editingItem, setEditingItem] = useState<any>(null)
    const [attrType, setAttrType] = useState("TEXT")

    const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const res = await addAttributeToCategory(categoryId, formData)
        setLoading(false)
        if (res.error) {
            alert(res.error)
        } else {
            (e.target as HTMLFormElement).reset()
            setAttrType("TEXT")
            // setOpen(false) // Stay open
        }
    }

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const res = await updateCategoryAttribute(editingItem.id, formData)
        setLoading(false)
        if (res.error) {
            alert(res.error)
        } else {
            setEditingItem(null)
            setAttrType("TEXT")
            // setOpen(false) // Stay open
        }
    }


    const handleDelete = async (id: string, isInherited: boolean = false) => {
        const message = isInherited
            ? "DİKKAT: Bu özellik bir üst kategoriden miras alınmıştır. Buradan silerseniz ANA KATEGORİDEN ve tüm diğer alt kategorilerden de silinecektir! Emin misiniz?"
            : "Bu özelliği silmek istediğinize emin misiniz?";

        if (!confirm(message)) return
        const res = await removeAttributeFromCategory(id)
        if (res.error) alert(res.error)
    }

    const startEditing = (item: any) => {
        if (item.isInherited) {
            if (!confirm("UYARI: Bu özellik bir üst kategoriden geliyor. Yapacağınız değişiklikler (isim, tip vb.) ANA KATEGORİYİ ve diğer tüm alt kategorileri de etkileyecektir. Devam etmek istiyor musunuz?")) return
        }
        setEditingItem(item)
        setAttrType(item.attribute.type)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val)
            if (!val) setEditingItem(null)
        }}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button variant="ghost" size="icon" title="Özellikleri Yönet">
                        <Settings className="w-4 h-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{categoryName} - Özellik Yönetimi</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Mevcut Özellikler Listesi */}
                    <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                        <h4 className="font-semibold text-sm">Mevcut Özellikler</h4>
                        {existingAttributes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Tanımlı özellik yok.</p>
                        ) : (
                            <div className="grid gap-2">
                                {existingAttributes.map((item) => (
                                    <div key={item.id} className={`flex items-center justify-between p-2 rounded border ${item.isInherited ? "bg-slate-50 border-slate-200" : "bg-background"}`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium ${item.isInherited ? "text-slate-500" : ""}`}>{item.attribute.name}</span>
                                            <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                                {item.attribute.type}
                                            </span>
                                            {item.required && <span className="text-xs text-red-500">*Zorunlu</span>}
                                            {item.isInherited && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1">Miras</span>}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                                                onClick={() => startEditing(item)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 h-8 w-8 p-0 hover:bg-red-50"
                                                onClick={() => handleDelete(item.id, item.isInherited)}
                                            >
                                                <Trash className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Ekleme / Düzenleme Formu */}
                    <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                {editingItem ? (
                                    <>
                                        <Pencil className="w-4 h-4 text-blue-600" />
                                        <span className="text-blue-600">Özelliği Düzenle: {editingItem.attribute.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" /> Yeni Özellik Ekle
                                    </>
                                )}
                            </h4>

                            {editingItem && (
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setEditingItem(null)
                                    setAttrType("TEXT")
                                }} className="h-6 gap-1 text-muted-foreground">
                                    <X className="w-3 h-3" /> İptal
                                </Button>
                            )}
                        </div>

                        <form
                            key={editingItem ? editingItem.id : 'new-attribute-form'}
                            onSubmit={editingItem ? handleUpdate : handleAdd}
                            className="space-y-4 bg-muted/10 p-4 rounded-md border"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Özellik Adı</Label>
                                    <Input
                                        name="name"
                                        placeholder="Örn: Vites Tipi"
                                        required
                                        defaultValue={editingItem?.attribute.name || ""}
                                    />
                                    {editingItem?.isInherited && <p className="text-[10px] text-red-500 font-medium">Bunu değiştirirseniz diğer kategoriler de etkilenir!</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Veri Tipi</Label>
                                    <Select name="type" value={attrType} onValueChange={setAttrType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TEXT">Metin (Yazı)</SelectItem>
                                            <SelectItem value="NUMBER">Sayı</SelectItem>
                                            <SelectItem value="SELECT">Seçim (Liste)</SelectItem>
                                            <SelectItem value="BOOLEAN">Var/Yok (Evet/Hayır)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {attrType === "SELECT" && (
                                <div className="space-y-2">
                                    <Label>
                                        Seçenekler (Her satıra bir tane)
                                        {editingItem?.isInherited && <span className="ml-2 text-[10px] text-red-500 font-bold">DİĞER KATEGORİLER DE ETKİLENİR!</span>}
                                    </Label>
                                    <Textarea
                                        name="options"
                                        placeholder={`Manuel\nOtomatik\nYarı Otomatik`}
                                        required
                                        className="h-24 font-mono text-sm"
                                        defaultValue={editingItem?.attribute.options?.join("\n") || ""}
                                    />
                                </div>
                            )}

                            <div className="flex items-center space-x-2 pt-2 bg-white p-2 rounded border">
                                <input
                                    type="checkbox"
                                    id="req"
                                    name="required"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    defaultChecked={editingItem?.required}
                                />
                                <Label htmlFor="req" className="cursor-pointer font-medium">Bu özellik zorunlu olsun</Label>
                            </div>

                            <Button type="submit" disabled={loading} className={editingItem ? "w-full bg-blue-600 hover:bg-blue-700" : "w-full"}>
                                {loading ? "İşleniyor..." : (editingItem ? "Değişiklikleri Kaydet" : "Özelliği Kaydet")}
                            </Button>

                            {editingItem && (
                                <div className="text-xs text-center text-muted-foreground">
                                    Düzenleme modundasınız. Çıkmak için "İptal"e basın.
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
