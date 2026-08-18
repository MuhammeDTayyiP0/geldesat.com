
import { CategoryTree } from "@/components/admin/CategoryTree"

export default function AdminCategoriesPage() {
    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Kategori Yönetimi</h1>
                <p className="text-muted-foreground mt-1">Platformdaki tüm araç, emlak ve alışveriş kategorilerini buradan yönetebilirsiniz.</p>
            </div>

            <CategoryTree />
        </div>
    )
}
