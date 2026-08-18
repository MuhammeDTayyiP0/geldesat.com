"use client"

import { Button } from "@/components/ui/button"
import { Trash, ChevronRight } from "lucide-react"
import { deleteCategory } from "@/actions/category"
import { ManageAttributesDialog } from "./ManageAttributesDialog"
import { AddCategoryDialog } from "./AddCategoryDialog"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface CategoryItemProps {
    category: any
    level: number
}

export function CategoryItem({ category, level }: CategoryItemProps) {
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        if (!confirm(`${category.name} kategorisini silmek istediğinize emin misiniz?`)) return
        setLoading(true)
        const res = await deleteCategory(category.id)
        if (res.error) alert(res.error)
        setLoading(false)
    }

    return (
        <div className="flex flex-col">
            <div className={cn(
                "flex items-center justify-between p-3 hover:bg-muted/50 transition-colors",
                level > 1 && "pl-8 border-l"
            )}>
                <div className="flex items-center gap-2">
                    {level > 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        /{category.slug}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <ManageAttributesDialog
                        categoryId={category.id}
                        categoryName={category.name}
                        existingAttributes={category.attributes || []}
                    />
                    <AddCategoryDialog parentId={category.id} parentName={category.name} />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDelete}
                        disabled={loading}
                        className="text-red-500 hover:text-red-600 h-8 w-8"
                    >
                        <Trash className="w-4 h-4" />
                    </Button>
                </div>
            </div>
            {/* Render children recursively if needed - simpler flat listing for level 2 for now, 
                but structure allows deeper if we pass children prop correctly */}
            {category.children && category.children.length > 0 && (
                <div className="pl-4 border-l ml-4 my-1">
                    {category.children.map((child: any) => (
                        <CategoryItem key={child.id} category={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}
