"use client"

import { useState, useEffect, useRef } from "react"
import { getCategories, suggestCategory } from "@/actions/category"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Category {
    id: string
    name: string
    slug: string
    parentId: string | null
}

interface CategoryStepProps {
    onSelect: (categoryId: string) => void
}

export function CategoryStep({ onSelect }: CategoryStepProps) {
    const [columns, setColumns] = useState<Category[][]>([])
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Suggestion Dialog State
    const [suggestOpen, setSuggestOpen] = useState(false)
    const [suggestLoading, setSuggestLoading] = useState(false)
    const [suggestParentId, setSuggestParentId] = useState<string | null>(null)
    const [suggestParentName, setSuggestParentName] = useState<string>("")

    // Load initial root categories
    useEffect(() => {
        loadCategories(null, 0)
    }, [])

    // Auto scroll when columns change
    useEffect(() => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current
            setTimeout(() => {
                container.scrollTo({
                    left: container.scrollWidth,
                    behavior: 'smooth'
                })
            }, 100)
        }
    }, [columns])

    const loadCategories = async (parentId: string | null, columnIndex: number) => {
        setLoading(true)
        const res = await getCategories(parentId)
        setLoading(false)

        if (res.success && res.data) {
            if (res.data.length > 0) {
                // Update columns: keep columns up to current index
                setColumns(prev => {
                    const newCols = prev.slice(0, columnIndex)
                    newCols.push(res.data as Category[])
                    return newCols
                })
            } else {
                // No children, this is a leaf category
                if (parentId) {
                    // onSelect(parentId)
                }
            }
        }
    }

    const handleCategoryClick = (category: Category, columnIndex: number) => {
        // Update selected categories path
        const newSelected = selectedCategories.slice(0, columnIndex)
        newSelected.push(category)
        setSelectedCategories(newSelected)

        // Load next column
        loadCategories(category.id, columnIndex + 1)
    }

    const handleSuggestClick = () => {
        const lastSelected = selectedCategories[selectedCategories.length - 1]
        const parentId = lastSelected ? lastSelected.id : null
        const parentName = lastSelected ? lastSelected.name : "Ana Kategori"

        setSuggestParentId(parentId)
        setSuggestParentName(parentName)
        setSuggestOpen(true)
    }

    const handleSuggestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSuggestLoading(true)
        const formData = new FormData(e.currentTarget)
        const name = formData.get("name") as string
        const description = formData.get("description") as string

        const res = await suggestCategory({
            categoryName: name,
            description,
            parentId: suggestParentId
        })
        setSuggestLoading(false)
        if (res.error) {
            alert(res.error)
        } else {
            alert("Öneriniz alındı. Admin onayından sonra eklenecektir.")
            setSuggestOpen(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Kategori Seçimi</h2>
                    <p className="text-sm text-gray-500 mt-1">İlanınızın doğru kategoride yer alması önemlidir.</p>
                </div>
                <Button
                    variant="link"
                    onClick={handleSuggestClick}
                    className="text-blue-600 hover:text-blue-800 text-sm h-auto p-0 underline font-medium"
                >
                    Aradığım kategori burada yok
                </Button>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto pb-4 border border-gray-200 rounded-xl bg-gray-50/50 p-6 min-h-[450px] shadow-sm custom-scrollbar scroll-smooth"
            >
                {columns.map((categories, colIndex) => (
                    <div key={colIndex} className="min-w-[240px] border-r border-gray-200 last:border-0 pr-4 animate-in slide-in-from-left-4 duration-300">
                        <ul className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {categories.map((cat) => (
                                <li key={cat.id}>
                                    <button
                                        onClick={() => handleCategoryClick(cat, colIndex)}
                                        className={cn(
                                            "w-full text-left px-4 py-3 rounded-lg text-sm flex items-center justify-between transition-all duration-200",
                                            selectedCategories[colIndex]?.id === cat.id
                                                ? "bg-primary text-white shadow-md font-medium"
                                                : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                                        )}
                                    >
                                        <span>{cat.name}</span>
                                        {selectedCategories[colIndex]?.id === cat.id && <ChevronRight className="h-4 w-4 text-white/80" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                {loading && (
                    <div className="flex flex-col items-center justify-center min-w-[240px] text-muted-foreground text-sm animate-pulse">
                        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                        Yükleniyor...
                    </div>
                )}
            </div>

            {/* Selection Summary */}
            {selectedCategories.length > 0 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-blue-50/50 border border-blue-100 rounded-xl shadow-sm">
                    <div className="flex flex-col gap-1 w-full">
                        <span className="font-semibold text-sm text-blue-900">Seçiminiz:</span>
                        <div className="flex items-center text-sm text-blue-700 flex-wrap">
                            {selectedCategories.map((c, i) => (
                                <span key={c.id} className="flex items-center">
                                    {i > 0 && <ChevronRight className="h-3 w-3 mx-2 text-blue-400" />}
                                    <span className={cn(i === selectedCategories.length - 1 && "font-bold underline cursor-default")}>
                                        {c.name}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Continue Button */}
                    {columns.length === selectedCategories.length && (
                        <div className="flex-shrink-0 w-full md:w-auto">
                            <Button
                                onClick={() => onSelect(selectedCategories[selectedCategories.length - 1].id)}
                                size="lg"
                                className="w-full md:w-auto bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all text-white font-semibold"
                            >
                                Seçilen Kategoriyle Devam Et <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Suggestion Dialog */}
            <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kategori Öner</DialogTitle>
                        <DialogDescription>
                            Aradığınız kategoriyi bulamadınız mı? Aşağıdaki form ile bize iletebilirsiniz. <br />
                            <strong>Ekleneceği Yer:</strong> {suggestParentName}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSuggestSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Önerilen Kategori Adı</Label>
                            <Input name="name" required placeholder="Örn: Drone" />
                        </div>
                        <div className="space-y-2">
                            <Label>Açıklama (Opsiyonel)</Label>
                            <Textarea name="description" placeholder="Ek detaylar..." />
                        </div>
                        <Button type="submit" disabled={suggestLoading} className="w-full">
                            {suggestLoading ? "Gönderiliyor..." : "Öneriyi Gönder"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
