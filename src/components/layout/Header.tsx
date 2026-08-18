import Link from "next/link"
import { PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchBar } from "@/components/search/SearchBar"
import { auth } from "@/auth"
import { MobileMenu } from "./MobileMenu"
import { UserNav } from "./UserNav"

export async function Header() {
    const session = await auth()
    const user = session?.user

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-all duration-200">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-colors">
                        <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                            GeldeSat
                        </span>
                    </div>
                </Link>

                {/* Search Bar - Hidden on mobile, visible on md+ */}
                <div className="hidden md:flex flex-1 max-w-2xl mx-8 relative">
                    <SearchBar className="w-full shadow-sm hover:shadow-md transition-shadow duration-200" />
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-6">
                    {!user ? (
                        <div className="flex items-center gap-4">
                            <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                                Giriş Yap
                            </Link>
                            <Button asChild size="default" className="font-bold shadow-md hover:shadow-lg transition-all">
                                <Link href="/auth/register">
                                    Hesap Aç
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <UserNav user={user} />
                    )}

                    <div className="h-8 w-px bg-border/60 mx-1 hidden md:block" />

                    <Button asChild size="lg" className="gap-2 font-bold shadow-sm hover:shadow-md transition-all rounded-full px-6 bg-gradient-to-r from-primary to-blue-600 border-none hover:opacity-90">
                        <Link href="/ilan-ver">
                            <PlusCircle className="h-5 w-5" />
                            İlan Ver
                        </Link>
                    </Button>
                </div>

                {/* Mobile Menu */}
                <MobileMenu user={user} />
            </div>
        </header>
    )
}
