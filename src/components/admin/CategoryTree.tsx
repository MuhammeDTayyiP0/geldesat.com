"use client"

import { useState, useEffect } from "react"
import { getCategories, updateCategory, deleteCategory } from "@/actions/category"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Folder, FileText, MoreHorizontal, Pencil, Trash, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddCategoryDialog } from "./AddCategoryDialog"
import { ManageAttributesDialog } from "./ManageAttributesDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface CategoryNode {
    id: string
    name: string
    slug: string
    parentId: string | null
    attributes?: any[] // Attribute linkleri
}

export function CategoryTree() {
    const [rootCategories, setRootCategories] = useState<CategoryNode[]>([])
    const [loading, setLoading] = useState(true)

    // Initial load
    useEffect(() => {
        loadRoots()
    }, [])

    async function loadRoots() {
        setLoading(true)
        const res = await getCategories(null)
        if (res.data) setRootCategories(res.data as any)
        setLoading(false)
    }

    return (
        <div className="border rounded-lg bg-card shadow-sm min-h-[500px] p-4 bg-white/50 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <div className="flex flex-col">
                    <h2 className="font-semibold text-lg text-slate-800">Kategori Hiyerarşisi</h2>
                    <p className="text-xs text-muted-foreground">Kategorileri genişleterek yönetebilirsiniz.</p>
                </div>
                <AddCategoryDialog onSuccess={loadRoots} />
            </div>

            {loading ? <div className="text-sm p-4 text-muted-foreground">Yükleniyor...</div> : (
                <div className="space-y-1">
                    {rootCategories.map(cat => (
                        <TreeNode key={cat.id} node={cat} />
                    ))}
                    {rootCategories.length === 0 && <div className="text-sm text-center p-4">Kategori bulunamadı.</div>}
                </div>
            )}
        </div>
    )
}

function TreeNode({ node, inheritedAttributes = [] }: { node: CategoryNode, inheritedAttributes?: any[] }) {
    const [expanded, setExpanded] = useState(false)
    const [children, setChildren] = useState<CategoryNode[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)

    // Edit Dialog
    const [editOpen, setEditOpen] = useState(false)
    const [editName, setEditName] = useState(node.name)
    const [editSlug, setEditSlug] = useState(node.slug)

    // Calculate Combined Attributes
    const ownAttributes = node.attributes || []
    const allAttributesMap = new Map()

    // Add inherited attributes first
    inheritedAttributes.forEach(attr => {
        // Keep source category if exists, or current inherited logic
        allAttributesMap.set(attr.attribute.id, { ...attr, isInherited: true })
    })

    // Add own attributes (overrides inherited if same definition)
    ownAttributes.forEach((attr: any) => {
        allAttributesMap.set(attr.attribute.id, { ...attr, isInherited: false })
    })

    const combinedAttributes = Array.from(allAttributesMap.values())

    async function handleExpand() {
        if (!expanded && !loaded) {
            setLoading(true)
            const res = await getCategories(node.id)
            if (res.data) {
                setChildren(res.data as any)
                setLoaded(true)
            }
            setLoading(false)
        }
        setExpanded(!expanded)
    }

    // Force reload children
    async function reloadChildren() {
        setLoading(true)
        const res = await getCategories(node.id)
        if (res.data) {
            setChildren(res.data as any)
            setLoaded(true)
        }
        setLoading(false)
        if (!expanded) setExpanded(true)
    }

    async function handleUpdate() {
        const res = await updateCategory(node.id, editName, editSlug)
        if (res.success) {
            setEditOpen(false)
            node.name = editName
            node.slug = editSlug
            window.location.reload()
        } else {
            alert(res.error)
        }
    }

    async function handleDelete() {
        if (!confirm(`"${node.name}" kategorisini ve altındakileri silmek istediğinize emin misiniz?`)) return
        await deleteCategory(node.id)
        window.location.reload()
    }

    return (
        <div className="ml-2 select-none">
            <div className={cn(
                "flex items-center gap-2 p-1.5 rounded-md hover:bg-blue-50/50 group transition-all border border-transparent hover:border-blue-100",
                expanded && "bg-blue-50/30"
            )}>
                <button
                    onClick={handleExpand}
                    className="p-0.5 hover:bg-white rounded cursor-pointer text-slate-400 hover:text-blue-500 transition-colors"
                >
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <span className="text-yellow-500">
                    <Folder className={cn("w-4 h-4 fill-current", expanded ? "text-yellow-500" : "text-yellow-400")} />
                </span>

                <span className="font-medium text-sm text-slate-700 flex-1 cursor-pointer" onClick={handleExpand}>
                    {node.name}
                </span>


                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1 transition-opacity ml-auto md:ml-0">

                    {/* Action Buttons */}
                    <div title="Özellik Yönetimi">
                        <ManageAttributesDialog
                            categoryId={node.id}
                            categoryName={node.name}
                            existingAttributes={combinedAttributes}
                            trigger={<Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-blue-600"><FileText className="w-3 h-3" /></Button>}
                        />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-900"><MoreHorizontal className="w-3 h-3" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setEditOpen(true)}>
                                <Pencil className="w-3 h-3 mr-2 text-blue-500" /> Düzenle
                            </DropdownMenuItem>

                            <div className="px-1 py-1">
                                <AddCategoryDialog
                                    parentId={node.id}
                                    parentName={node.name}
                                    onSuccess={reloadChildren}
                                    trigger={
                                        <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full">
                                            <Plus className="w-3 h-3 mr-2 text-green-500" /> Alt Kategori Ekle
                                        </div>
                                    }
                                />
                            </div>

                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDelete}>
                                <Trash className="w-3 h-3 mr-2" /> Sil
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Children */}
            {expanded && (
                <div className="pl-4 border-l border-slate-200 ml-2.5 my-1">
                    {loading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 py-1">
                            <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div> Yükleniyor...
                        </div>
                    ) : (
                        children.length === 0 ? <div className="text-xs text-muted-foreground pl-2 py-1 italic">Alt kategori yok</div> :
                            children.map(child => <TreeNode key={child.id} node={child} inheritedAttributes={combinedAttributes} />)
                    )}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Kategoriyi Düzenle</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Kategori Adı</Label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug (URL)</Label>
                            <Input value={editSlug} onChange={e => setEditSlug(e.target.value)} />
                        </div>
                        <Button onClick={handleUpdate} className="w-full">Değişiklikleri Kaydet</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
