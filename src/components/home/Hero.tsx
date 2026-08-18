"use client"

import { useState } from "react"
import Form from "next/form"
import { Search, MapPin, Home, Car, ShoppingBag, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function Hero() {
    const [searchQuery, setSearchQuery] = useState("")

    return (
        <section className="relative w-full overflow-hidden bg-background pt-24 pb-32">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px]" />
            </div>

            <div className="container mx-auto px-4 md:px-6 relative z-10 flex flex-col items-center text-center">
                
                {/* Badge */}
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8 backdrop-blur-sm transition-all hover:bg-primary/10">
                    <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                    Türkiye'nin Yeni Nesil İlan Platformu
                </div>

                {/* Hero Title */}
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl leading-tight">
                    Hayalindeki <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Fırsatı</span> <br className="hidden md:block"/> Hemen Yakala
                </h1>
                
                <p className="max-w-[600px] text-lg md:text-xl text-muted-foreground mb-12">
                    Emlak, vasıta, alışveriş ve daha fazlası. Milyonlarca ilan arasından aradığını saniyeler içinde bul.
                </p>

                {/* Search Container with Glassmorphism */}
                <div className="w-full max-w-5xl bg-background/60 backdrop-blur-2xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden p-3 md:p-5 transition-all duration-300 hover:shadow-primary/5">
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="w-full sm:w-auto flex flex-wrap sm:inline-flex h-auto sm:h-14 items-center justify-center rounded-2xl bg-muted/60 p-1 mb-4 mx-auto sm:mx-0 gap-1 sm:gap-0">
                            <TabsTrigger value="all" className="rounded-xl px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">Tümü</TabsTrigger>
                            <TabsTrigger value="emlak" className="rounded-xl px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Home className="w-4 h-4 mr-2 hidden sm:inline-block" /> Emlak
                            </TabsTrigger>
                            <TabsTrigger value="vasita" className="rounded-xl px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Car className="w-4 h-4 mr-2 hidden sm:inline-block" /> Vasıta
                            </TabsTrigger>
                            <TabsTrigger value="alisveris" className="rounded-xl px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <ShoppingBag className="w-4 h-4 mr-2 hidden sm:inline-block" /> Alışveriş
                            </TabsTrigger>
                        </TabsList>

                        {/* Search Forms */}
                        <TabsContent value="all" className="mt-0">
                            <Form action="/search" className="flex flex-col md:flex-row gap-3">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input name="q" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ne arıyorsunuz? (Örn: iPhone 15, Satılık Daire)" className="pl-12 h-14 sm:h-16 text-base sm:text-lg rounded-2xl bg-background/50 border-border/50 focus-visible:ring-primary/50" />
                                </div>
                                <Button type="submit" size="lg" className="h-14 sm:h-16 px-10 text-base sm:text-lg font-bold rounded-2xl shadow-lg hover:shadow-primary/25 transition-all">
                                    Hemen Ara <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Form>
                        </TabsContent>

                        {/* Other Tabs Content similar, with hidden input */}
                        <TabsContent value="emlak" className="mt-0">
                            <Form action="/search" className="flex flex-col md:flex-row gap-3">
                                <input type="hidden" name="category" value="emlak" />
                                <div className="relative flex-1 group">
                                    <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input name="q" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Hangi emlağı arıyorsunuz? (Örn: 3+1 Kiralık)" className="pl-12 h-14 sm:h-16 text-base sm:text-lg rounded-2xl bg-background/50 border-border/50 focus-visible:ring-primary/50" />
                                </div>
                                <Button type="submit" size="lg" className="h-14 sm:h-16 px-10 text-base sm:text-lg font-bold rounded-2xl shadow-lg hover:shadow-primary/25 transition-all">
                                    Emlak Bul <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Form>
                        </TabsContent>

                        <TabsContent value="vasita" className="mt-0">
                            <Form action="/search" className="flex flex-col md:flex-row gap-3">
                                <input type="hidden" name="category" value="vasita" />
                                <div className="relative flex-1 group">
                                    <Car className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input name="q" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Hangi aracı arıyorsunuz? (Örn: Honda Civic)" className="pl-12 h-14 sm:h-16 text-base sm:text-lg rounded-2xl bg-background/50 border-border/50 focus-visible:ring-primary/50" />
                                </div>
                                <Button type="submit" size="lg" className="h-14 sm:h-16 px-10 text-base sm:text-lg font-bold rounded-2xl shadow-lg hover:shadow-primary/25 transition-all">
                                    Vasıta Bul <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Form>
                        </TabsContent>

                        <TabsContent value="alisveris" className="mt-0">
                            <Form action="/search" className="flex flex-col md:flex-row gap-3">
                                <input type="hidden" name="category" value="alisveris" />
                                <div className="relative flex-1 group">
                                    <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input name="q" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ne almak istersiniz? (Örn: Playstation 5)" className="pl-12 h-14 sm:h-16 text-base sm:text-lg rounded-2xl bg-background/50 border-border/50 focus-visible:ring-primary/50" />
                                </div>
                                <Button type="submit" size="lg" className="h-14 sm:h-16 px-10 text-base sm:text-lg font-bold rounded-2xl shadow-lg hover:shadow-primary/25 transition-all">
                                    Ürün Bul <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Form>
                        </TabsContent>

                    </Tabs>
                </div>
                
                {/* Popular Searches / Quick Links */}
                <div className="mt-8 flex flex-wrap justify-center items-center gap-3 text-sm text-muted-foreground">
                    <span>Popüler Aramalar:</span>
                    <a href="/search?q=iPhone 15" className="px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors border border-border/50 backdrop-blur-sm">iPhone 15</a>
                    <a href="/search?q=Satılık Daire&category=emlak" className="px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors border border-border/50 backdrop-blur-sm">Satılık Daire</a>
                    <a href="/search?q=Honda Civic&category=vasita" className="px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors border border-border/50 backdrop-blur-sm">Honda Civic</a>
                    <a href="/search?q=Oyuncu Bilgisayarı" className="px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary transition-colors border border-border/50 backdrop-blur-sm">Oyuncu Bilgisayarı</a>
                </div>

            </div>
        </section>
    )
}
