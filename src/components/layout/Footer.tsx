import Link from "next/link"

export function Footer() {
    return (
        <footer className="w-full border-t bg-muted/30 mt-auto">
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div className="flex flex-col gap-2">
                        <h3 className="font-semibold text-foreground">Kurumsal</h3>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Hakkımızda</Link>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Medya İletişimi</Link>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">İnsan Kaynakları</Link>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="font-semibold text-foreground">Hizmetlerimiz</h3>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Doping</Link>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Güvenli E-Ticaret</Link>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Mobil Uygulamalar</Link>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="font-semibold text-foreground">Gizlilik</h3>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Kullanım Koşulları</Link>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Üyelik Sözleşmesi</Link>
                        <Link href="#" className="text-sm text-muted-foreground hover:text-primary">Çerez Politikası</Link>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="font-semibold text-foreground">İletişim</h3>
                        <span className="text-sm text-muted-foreground">0533 488 1160</span>
                        <span className="text-sm text-muted-foreground">destek@geldesat.com</span>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">© 2026 GeldeSat.com - Tüm hakları saklıdır.</p>
                </div>
            </div>
        </footer>
    )
}
