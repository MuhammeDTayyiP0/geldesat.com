import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const error = searchParams.error

    const errorMap: { [key: string]: string } = {
        Configuration: "Sunucu yapılandırmasıyla ilgili bir sorun oluştu. Lütfen yönetici ile iletişime geçin.",
        AccessDenied: "Bu kaynağa erişim izniniz yok.",
        Verification: "Doğrulama bağlantısı geçersiz veya süresi dolmuş.",
        OAuthAccountNotLinked: "Bu email adresi ile başka bir yöntemle (Giriş Yap/Kayıt Ol) hesap oluşturmuşsunuz. Lütfen o yöntemi kullanarak giriş yapın.",
        Default: "Kimlik doğrulama işlemi sırasında beklenmedik bir hata oluştu."
    }

    const errorMessage = error && typeof error === "string" && error in errorMap
        ? errorMap[error]
        : errorMap.Default

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-muted/30">
            <Card className="w-full max-w-md shadow-lg border-destructive/20">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-red-100 rounded-full">
                            <AlertCircle className="w-8 h-8 text-destructive" />
                        </div>
                    </div>
                    <CardTitle className="text-xl text-destructive">Giriş Başarısız</CardTitle>
                    <CardDescription>
                        İşleminiz gerçekleştirilemedi
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 rounded-md bg-destructive/10 text-sm text-destructive font-medium text-center">
                        {errorMessage}
                        {error && <p className="mt-2 text-xs opacity-70">Hata Kodu: {error}</p>}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button asChild variant="default">
                        <Link href="/auth/login">Giriş Sayfasına Dön</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
