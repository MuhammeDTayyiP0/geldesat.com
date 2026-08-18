import { ShieldCheck, Zap, Handshake, HeadphonesIcon } from "lucide-react"

const features = [
  {
    name: "Güvenilir Alışveriş",
    description: "Tüm satıcılar onaylıdır ve işlemleriniz GeldeSat güvencesi altındadır.",
    icon: ShieldCheck,
  },
  {
    name: "Hızlı Satış",
    description: "Gelişmiş algoritmamız sayesinde ilanınız milyonlarca potansiyel alıcıya ulaşır.",
    icon: Zap,
  },
  {
    name: "Kolay İletişim",
    description: "Alıcı ve satıcılar uygulama içi mesajlaşma ile güvenle iletişim kurar.",
    icon: Handshake,
  },
  {
    name: "7/24 Destek",
    description: "Herhangi bir sorununuzda müşteri hizmetlerimiz 7/24 yanınızda.",
    icon: HeadphonesIcon,
  },
]

export function Features() {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-primary">Neden GeldeSat?</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Alışverişin En Güvenli ve Hızlı Yolu
          </p>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Türkiye'nin en yenilikçi ilan platformu olarak size en iyi deneyimi sunmak için sürekli gelişiyoruz. İşte bizi tercih etmeniz için birkaç neden.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/20 transition-all hover:scale-110 hover:bg-primary/20">
                  <feature.icon className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <dt className="text-xl font-semibold leading-7 text-foreground">
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
