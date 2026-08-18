import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Sayfa Bulunamadı",
    robots: {
        index: false,
        follow: false,
    },
}
import { Button } from "@/components/ui/button"
import { Home, Search, ArrowLeft } from "lucide-react"

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="text-center space-y-8 max-w-lg mx-auto">
                <div className="space-y-4">
                    <h1 className="text-9xl font-black text-gray-200 dark:text-gray-800 select-none">404</h1>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            Sayfa Bulunamadı
                        </h2>
                        <p className="text-muted-foreground max-w-sm mx-auto p-4 bg-background/80 backdrop-blur-sm rounded-xl">
                            Aradığınız sayfa silinmiş, adı değiştirilmiş veya geçici olarak kullanılamıyor olabilir.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                    <Button asChild size="lg" variant="default" className="w-full sm:w-auto gap-2 shadow-lg hover:shadow-primary/25 transition-all">
                        <Link href="/">
                            <Home className="w-4 h-4" />
                            Anasayfa
                        </Link>
                    </Button>

                    <Button asChild size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                        <Link href="/search">
                            <Search className="w-4 h-4" />
                            İlanlarda Ara
                        </Link>
                    </Button>
                </div>

                <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-muted-foreground mb-4">Popüler Kategoriler</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {["Emlak", "Vasıta", "Alışveriş", "Hizmetler"].map((cat) => (
                            <Link
                                key={cat}
                                href={`/search?q=${cat}`}
                                className="px-4 py-2 bg-secondary/50 hover:bg-secondary rounded-full text-sm font-medium transition-colors"
                            >
                                {cat}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
