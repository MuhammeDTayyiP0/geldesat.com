import {
  Briefcase,
  Building2,
  Car,
  GraduationCap,
  PawPrint,
  ShoppingBag,
  Tractor,
  Users,
  Wrench,
} from "lucide-react";
import React from "react";

export type SubCategoryGroup = {
  title: string;
  slug: string;
  items: { name: string; slug: string }[];
};

export type MegaCategory = {
  id: string;
  name: string;
  slug: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  groups: SubCategoryGroup[];
};

export const MAIN_NAV_CATEGORIES: MegaCategory[] = [
  {
    id: "emlak",
    name: "Emlak",
    slug: "emlak",
    icon: Building2,
    groups: [
      {
        title: "Konut",
        slug: "konut",
        items: [
          { name: "Satılık Daire", slug: "satilik-konut" },
          { name: "Kiralık Daire", slug: "kiralik-konut" },
          { name: "Satılık Villa", slug: "satilik-villa" },
          { name: "Kiralık Villa", slug: "kiralik-villa" },
          { name: "Satılık Residence", slug: "satilik-residence" },
          { name: "Satılık Yazlık", slug: "satilik-yazlik" },
          { name: "Turistik Günlük Kiralık", slug: "gunluk-kiralik" },
        ],
      },
      {
        title: "İşyeri",
        slug: "isyeri",
        items: [
          { name: "Satılık Dükkan & Mağaza", slug: "satilik-dukkan" },
          { name: "Kiralık Dükkan & Mağaza", slug: "kiralik-dukkan" },
          { name: "Satılık Ofis", slug: "satilik-ofis" },
          { name: "Kiralık Ofis", slug: "kiralik-ofis" },
          { name: "Satılık Fabrika & Depo", slug: "satilik-fabrika" },
          { name: "Satılık Plaza / Plaza Katı", slug: "satilik-plaza" },
        ],
      },
      {
        title: "Arsa & Arazi",
        slug: "arsa",
        items: [
          { name: "İmarlı Konut Arsası", slug: "arsa-imarli-konut" },
          { name: "İmarlı Ticari Arsa", slug: "arsa-imarli-ticari" },
          { name: "Tarla", slug: "arsa-tarla" },
          { name: "Bağ & Bahçe", slug: "arsa-bahce" },
          { name: "Villa Arsası", slug: "arsa-villa-arsasi" },
        ],
      },
    ],
  },
  {
    id: "vasita",
    name: "Vasıta",
    slug: "vasita",
    icon: Car,
    badge: "Popüler",
    groups: [
      {
        title: "Otomobil",
        slug: "otomobil",
        items: [
          { name: "BMW", slug: "oto-bmw" },
          { name: "Mercedes-Benz", slug: "oto-mercedes" },
          { name: "Volkswagen", slug: "oto-vw" },
          { name: "Renault", slug: "oto-renault" },
          { name: "Fiat", slug: "oto-fiat" },
          { name: "Toyota", slug: "oto-toyota" },
          { name: "Honda", slug: "oto-honda" },
          { name: "Ford", slug: "oto-ford" },
          { name: "Hyundai", slug: "oto-hyundai" },
        ],
      },
      {
        title: "Motosiklet",
        slug: "motosiklet",
        items: [
          { name: "Yamaha", slug: "moto-yamaha" },
          { name: "Honda Motosiklet", slug: "moto-honda" },
          { name: "BMW Motorrad", slug: "moto-bmw-motorrad" },
          { name: "Kawasaki", slug: "moto-kawasaki" },
          { name: "Ducati", slug: "moto-ducati" },
          { name: "Vespa", slug: "moto-vespa" },
          { name: "Bajaj", slug: "moto-bajaj" },
        ],
      },
      {
        title: "Ticari Araçlar",
        slug: "ticari",
        items: [
          { name: "Kamyonet", slug: "ticari-kamyonet" },
          { name: "Kamyon", slug: "ticari-kamyon" },
          { name: "Çekici", slug: "ticari-cekici" },
          { name: "Minibüs", slug: "ticari-minibus" },
          { name: "Otobüs", slug: "ticari-otobus" },
        ],
      },
      {
        title: "Arazi, Deniz & Karavan",
        slug: "arazi-suv",
        items: [
          { name: "Kiralık Araçlar", slug: "kiralik-arac" },
          { name: "Klasik Araçlar", slug: "klasik" },
          { name: "Deniz Araçları & Tekne", slug: "deniz" },
          { name: "Karavan & Kamp Araçları", slug: "karavan" },
        ],
      },
    ],
  },
  {
    id: "alisveris",
    name: "İkinci El Alışveriş",
    slug: "alisveris",
    icon: ShoppingBag,
    groups: [
      {
        title: "Bilgisayar & Donanım",
        slug: "bilgisayar",
        items: [
          { name: "Dizüstü (Laptop)", slug: "dizustu-laptop" },
          { name: "Masaüstü Bilgisayar", slug: "bilgisayar-masaustu" },
          { name: "Monitör", slug: "bilgisayar-monitor" },
          { name: "Tablet", slug: "bilgisayar-tablet" },
        ],
      },
      {
        title: "Cep Telefonu & Aksesuar",
        slug: "cep-telefonu",
        items: [
          { name: "Apple iPhone", slug: "tel-apple" },
          { name: "Samsung Galaxy", slug: "tel-samsung" },
          { name: "Xiaomi & Diğerleri", slug: "tel-xiaomi" },
          { name: "Akıllı Saat & Bileklik", slug: "akilli-saat" },
        ],
      },
      {
        title: "Ev Elektroniği & Beyaz Eşya",
        slug: "ev-elektronigi",
        items: [
          { name: "Televizyon", slug: "ev-elektronigi-tv" },
          { name: "Ses Sistemleri", slug: "ev-elektronigi-ses-sistemi" },
          { name: "Beyaz Eşya", slug: "beyaz-esya" },
          { name: "Oyun Konsolları (PS5 / Xbox)", slug: "oyun-konsol" },
          { name: "Klima & Isıtıcı", slug: "beyaz-esya-klima" },
        ],
      },
      {
        title: "Ev, Yaşam & Hobi",
        slug: "mobilya",
        items: [
          { name: "Giyim & Aksesuar", slug: "giyim" },
          { name: "Spor & Outdoor", slug: "spor" },
          { name: "Kitap, Dergi & Film", slug: "kitap" },
          { name: "Müzik Enstrümanları", slug: "muzik" },
        ],
      },
    ],
  },
  {
    id: "yedek-parca",
    name: "Yedek Parça & Aksesuar",
    slug: "yedek-parca",
    icon: Wrench,
    groups: [
      {
        title: "Otomotiv Ekipmanları",
        slug: "yp-oto",
        items: [
          { name: "Yedek Parça", slug: "yp-oto-yedek-parca" },
          { name: "Aksesuar & Tuning", slug: "yp-oto-aksesuar-tuning" },
          { name: "Jant & Lastik", slug: "yp-oto-jant-lastik" },
          { name: "Ses & Görüntü Sistemleri", slug: "yp-oto-ses-goruntu" },
          { name: "Aydınlatma & Far", slug: "yp-oto-aydinlatma" },
        ],
      },
      {
        title: "Motosiklet Ekipmanları",
        slug: "yp-moto",
        items: [
          { name: "Motosiklet Yedek Parça", slug: "yp-moto-yedek-parca" },
          { name: "Kask, Kıyafet & Ekipman", slug: "yp-moto-kask-kiyafet-ekipman" },
          { name: "Motosiklet Jant & Lastik", slug: "yp-moto-jant-lastik" },
          { name: "Deniz Aracı Ekipmanları", slug: "yp-deniz" },
        ],
      },
    ],
  },
  {
    id: "sanayi",
    name: "İş Makineleri",
    slug: "sanayi",
    icon: Tractor,
    groups: [
      {
        title: "İş & Tarım Makineleri",
        slug: "is-makineleri",
        items: [
          { name: "Ekskavatör", slug: "ismak-ekskavator" },
          { name: "Forklift", slug: "ismak-forklift" },
          { name: "Kazıcı Yükleyici", slug: "ismak-kazici-yukleyici" },
          { name: "Tarım Makineleri", slug: "tarim" },
          { name: "Sanayi & Endüstri", slug: "sanayi-makine" },
          { name: "Kiralık İş Makinesi", slug: "ismak-kiralik" },
        ],
      },
    ],
  },
  {
    id: "hizmetler",
    name: "Ustalar & Hizmetler",
    slug: "hizmetler",
    icon: Wrench,
    groups: [
      {
        title: "Ev Tadilat & Dekorasyon",
        slug: "tamir",
        items: [
          { name: "Boya & Badana", slug: "tamir-boyaci" },
          { name: "Su & Doğalgaz Tesisatı", slug: "tamir-tesisatci" },
          { name: "Elektrikçi & Aydınlatma", slug: "tamir-elektrikci" },
          { name: "Marangoz & Mobilya Montaj", slug: "tamir-marangoz" },
        ],
      },
      {
        title: "Nakliyat & Temizlik",
        slug: "nakliyat",
        items: [
          { name: "Evden Eve Nakliyat", slug: "nakliyat-evden-eve" },
          { name: "Şehirlerarası Nakliyat", slug: "nakliyat-sehirlerarasi" },
          { name: "Temizlik Hizmetleri", slug: "temizlik-hiz" },
          { name: "Organizasyon", slug: "organizasyon" },
        ],
      },
    ],
  },
  {
    id: "ozel-ders",
    name: "Özel Ders",
    slug: "ozel-ders",
    icon: GraduationCap,
    groups: [
      {
        title: "Ders Branşları",
        slug: "ders-matematik",
        items: [
          { name: "İngilizce", slug: "ders-ingilizce" },
          { name: "Fizik & Kimya", slug: "ders-fizik" },
          { name: "Türkçe", slug: "ders-turkce" },
          { name: "YKS Hazırlık", slug: "ders-yks" },
          { name: "LGS Hazırlık", slug: "ders-lgs" },
          { name: "Yazılım", slug: "ders-yazilim" },
          { name: "Direksiyon", slug: "ders-direksiyon" },
        ],
      },
    ],
  },
  {
    id: "is-ilanlari",
    name: "İş İlanları",
    slug: "is-ilanlari",
    icon: Briefcase,
    groups: [
      {
        title: "Sektörel İlanlar",
        slug: "is-satis-pazarlama",
        items: [
          { name: "Bilişim & Yazılım", slug: "is-bilisim" },
          { name: "Restoran & Kafe Personeli", slug: "is-restoran-cafe" },
          { name: "Lojistik & Kurye", slug: "is-lojistik" },
          { name: "Muhasebe & Finans", slug: "is-muhasebe-finans" },
          { name: "Mühendislik", slug: "is-muhendislik" },
        ],
      },
    ],
  },
  {
    id: "yardimci",
    name: "Yardımcı Arayanlar",
    slug: "yardimci",
    icon: Users,
    groups: [
      {
        title: "Ev & Bakım Desteği",
        slug: "yardimci-bebek-bakicisi",
        items: [
          { name: "Çocuk Bakıcısı", slug: "yardimci-cocuk-bakicisi" },
          { name: "Yaşlı Bakımı", slug: "yardimci-yasli-bakimi" },
          { name: "Hasta Bakımı", slug: "yardimci-hasta-bakimi" },
          { name: "Temizlikçi", slug: "yardimci-temizlikci" },
          { name: "Şoför", slug: "yardimci-sofor" },
        ],
      },
    ],
  },
  {
    id: "hayvanlar",
    name: "Hayvanlar Alemi",
    slug: "hayvanlar-alemi",
    icon: PawPrint,
    groups: [
      {
        title: "Evcil Hayvan & Bakım",
        slug: "kedi",
        items: [
          { name: "Köpek", slug: "kopek" },
          { name: "Kuşlar & Kafesler", slug: "hayvan-kus" },
          { name: "Akvaryum & Balıklar", slug: "hayvan-balik" },
          { name: "Mama & Aksesuar", slug: "hayvan-aksesuar-mama" },
        ],
      },
    ],
  },
];

export const POPULAR_SEARCH_TERMS = [
  "Satılık Daire",
  "Kiralık Daire",
  "BMW 320d",
  "Renault Megane",
  "Volkswagen Golf",
  "iPhone 15",
  "Fiat Egea",
  "Satılık Arsa",
  "Honda Civic",
  "Motosiklet",
];

export const RECENT_SEARCHES_KEY = "geldesat:recent_searches_v1";
