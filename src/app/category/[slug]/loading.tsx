import { Skeleton } from "@/components/ui/skeleton"

export default function CategoryLoading() {
    return (
        <div className="container mx-auto px-4 py-8">
            {/* Breadcrumb Skeleton */}
            <div className="flex items-center gap-2 mb-6">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Skeleton */}
                <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
                    <div className="border rounded-lg p-5 space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-8 w-full" />
                            ))}
                        </div>
                    </div>

                    <div className="border rounded-lg p-5 space-y-4">
                        <Skeleton className="h-6 w-24 mb-4" />
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                </aside>

                {/* Main Content Skeleton */}
                <main className="flex-1">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b pb-4">
                        <div>
                            <Skeleton className="h-8 w-64 mb-2" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-20" />
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="border rounded-lg overflow-hidden space-y-3">
                                <Skeleton className="h-48 w-full" />
                                <div className="p-4 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-6 w-1/2" />
                                    <Skeleton className="h-4 w-full" />
                                    <div className="pt-2 flex justify-between">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    )
}
