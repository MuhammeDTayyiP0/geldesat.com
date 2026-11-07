import {
  Briefcase,
  Building2,
  Car,
  PawPrint,
  ShoppingBag,
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
          { name: "Satılık Arsa", slug: "arsa" },
          { name: "Satılık Tarla", slug: "arsa" },
          { name: "Bağ & Bahçe", slug: "arsa" },
          { name: "Kat Karşılığı Arsa", slug: "arsa" },
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
          { name: "Tüm Otomobil İlanları", slug: "otomobil" },
        ],
      },
      {
        title: "Motosiklet",
        slug: "motosiklet",
        items: [
          { name: "Scooter", slug: "motosiklet" },
          { name: "Touring", slug: "motosiklet" },
          { name: "Super Sport", slug: "motosiklet" },
          { name: "Enduro / Cross", slug: "motosiklet" },
          { name: "Yamaha", slug: "moto-yamaha" },
          { name: "Honda Motosiklet", slug: "motosiklet" },
        ],
      },
      {
        title: "Ticari Araçlar",
        slug: "ticari",
        items: [
          { name: "Kamyonet", slug: "ticari" },
          { name: "Panelvan & Minibüs", slug: "ticari" },
          { name: "Kamyon & Çekici", slug: "ticari" },
          { name: "Otobüs & Midibüs", slug: "ticari" },
        ],
      },
      {
        title: "Özel Araçlar",
        slug: "vasita",
        items: [
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
          { name: "Monitör & Ekran Kartı", slug: "bilgisayar-monitor" },
          { name: "Tablet & Aksesuar", slug: "bilgisayar-tablet" },
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
          { name: "Televizyon & Ses", slug: "ev-elektronigi" },
          { name: "Buzdolabı & Çamaşır Makinesi", slug: "beyaz-esya" },
          { name: "Oyun Konsolları (PS5 / Xbox)", slug: "oyun-konsol" },
          { name: "Klima & Isıtıcı", slug: "beyaz-esya-klima" },
        ],
      },
      {
        title: "Ev & Yaşam / Moda",
        slug: "alisveris",
        items: [
          { name: "Mobilya & Dekorasyon", slug: "mobilya" },
          { name: "Giyim & Ayakkabı", slug: "giyim" },
          { name: "Spor & Outdoor", slug: "alisveris-spor" },
          { name: "Kitap, Müzik & Hobi", slug: "alisveris-kitap-dergi-film" },
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
          { name: "Jant & Lastik", slug: "yp-oto-jant-lastik" },
          { name: "Ses & Müzik Sistemleri", slug: "yp-audio-goruntu" },
          { name: "Motor & Mekanik Parça", slug: "yp-otomotiv-yedek-parca" },
          { name: "Aydınlatma & Far", slug: "yp-otomotiv-yedek-parca" },
        ],
      },
      {
        title: "Motosiklet Ekipmanları",
        slug: "yp-moto",
        items: [
          { name: "Kask & Güvenlik", slug: "yp-moto-kask-kiyafet-ekipman" },
          { name: "Motosiklet Montu & Eldiven", slug: "yp-moto-kask-kiyafet-ekipman" },
          { name: "Motosiklet Çantaları", slug: "yp-moto" },
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
        title: "Nakliyat & Araç Servisi",
        slug: "nakliyat",
        items: [
          { name: "Evden Eve Nakliyat", slug: "nakliyat-evden-eve" },
          { name: "Temizlik Hizmetleri", slug: "temizlik-hiz" },
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
        slug: "is-ilanlari",
        items: [
          { name: "Satış & Pazarlama", slug: "is-ilanlari" },
          { name: "Restoran & Kafe Personeli", slug: "is-ilanlari" },
          { name: "Şoför & Kurye", slug: "is-ilanlari" },
          { name: "Bilişim & Yazılım", slug: "is-ilanlari" },
          { name: "Depo & Lojistik", slug: "is-ilanlari" },
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
        slug: "hayvanlar-alemi",
        items: [
          { name: "Evcil Hayvan Sahiplenme", slug: "hayvanlar-alemi" },
          { name: "Akvaryum & Balıklar", slug: "hayvanlar-alemi" },
          { name: "Kuşlar & Kafesler", slug: "hayvanlar-alemi" },
          { name: "Mama, Aksesuar & Sağlık", slug: "hayvanlar-alemi" },
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

