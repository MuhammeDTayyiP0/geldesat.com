"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateProfile } from "@/actions/profile"
import { User } from "lucide-react"
import { useRouter } from "next/navigation"

interface ProfileFormProps {
    user: {
        id: string
        name: string | null
        email: string | null
        image: string | null
    }
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [name, setName] = useState(user.name || "")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData()
        formData.append("name", name)

        const result = await updateProfile(formData)

        if (result.error) {
            alert(result.error)
        } else {
            alert("Profil başarıyla güncellendi.")
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profil Bilgileri</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
                            {user.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.image} alt={user.name || "User"} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-10 h-10 text-muted-foreground" />
                            )}
                        </div>
                        <div>
                            <p className="font-medium text-lg">{user.name || "İsimsiz Kullanıcı"}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">E-posta</Label>
                        <Input id="email" value={user.email || ""} disabled className="bg-muted" />
                        <p className="text-[0.8rem] text-muted-foreground">E-posta adresi değiştirilemez.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Ad Soyad</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Adınız Soyadınız"
                        />
                    </div>

                    <Button type="submit" disabled={loading}>
                        {loading ? "Güncelleniyor..." : "Değişiklikleri Kaydet"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
