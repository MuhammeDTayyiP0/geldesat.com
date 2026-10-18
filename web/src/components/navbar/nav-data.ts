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
      {
        title: "Projeler & Vitrin",
        slug: "projeler",
        items: [
          { name: "Sıfır Konut Projeleri", slug: "emlak" },
          { name: "Emlak Ofisleri", slug: "emlak" },
          { name: "Bankadan & İcradan Satılık", slug: "emlak" },
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
        slug: "ozel-araclar",
        items: [
          { name: "Elektrikli Araçlar", slug: "vasita" },
          { name: "Klasik Araçlar", slug: "vasita" },
          { name: "Deniz Araçları & Tekne", slug: "vasita" },
          { name: "Karavan & Kamp Araçları", slug: "vasita" },
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
          { name: "Dizüstü (Laptop)", slug: "alisveris" },
          { name: "Masaüstü Bilgisayar", slug: "alisveris" },
          { name: "Monitör & Ekran Kartı", slug: "alisveris" },
          { name: "Tablet & Aksesuar", slug: "alisveris" },
        ],
      },
      {
        title: "Cep Telefonu & Aksesuar",
        slug: "telefon",
        items: [
          { name: "Apple iPhone", slug: "alisveris" },
          { name: "Samsung Galaxy", slug: "alisveris" },
          { name: "Xiaomi & Diğerleri", slug: "alisveris" },
          { name: "Akıllı Saat & Bileklik", slug: "alisveris" },
        ],
      },
      {
        title: "Ev Elektroniği & Beyaz Eşya",
        slug: "elektronik",
        items: [
          { name: "Televizyon & Ses", slug: "alisveris" },
          { name: "Buzdolabı & Çamaşır Makinesi", slug: "alisveris" },
          { name: "Oyun Konsolları (PS5 / Xbox)", slug: "alisveris" },
          { name: "Klima & Isıtıcı", slug: "alisveris" },
        ],
      },
      {
        title: "Ev & Yaşam / Moda",
        slug: "ev-yasam",
        items: [
          { name: "Mobilya & Dekorasyon", slug: "alisveris" },
          { name: "Giyim & Ayakkabı", slug: "alisveris" },
          { name: "Spor & Outdoor", slug: "alisveris" },
          { name: "Kitap, Müzik & Hobi", slug: "alisveris" },
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
        slug: "oto-parca",
        items: [
          { name: "Jant & Lastik", slug: "yedek-parca" },
          { name: "Ses & Müzik Sistemleri", slug: "yedek-parca" },
          { name: "Motor & Mekanik Parça", slug: "yedek-parca" },
          { name: "Aydınlatma & Far", slug: "yedek-parca" },
        ],
      },
      {
        title: "Motosiklet Ekipmanları",
        slug: "moto-ekipman",
        items: [
          { name: "Kask & Güvenlik", slug: "yedek-parca" },
          { name: "Motosiklet Montu & Eldiven", slug: "yedek-parca" },
          { name: "Motosiklet Çantaları", slug: "yedek-parca" },
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
        slug: "tadilat",
        items: [
          { name: "Boya & Badana", slug: "hizmetler" },
          { name: "Su & Doğalgaz Tesisatı", slug: "hizmetler" },
          { name: "Elektrikçi & Aydınlatma", slug: "hizmetler" },
          { name: "Marangoz & Mobilya Montaj", slug: "hizmetler" },
        ],
      },
      {
        title: "Nakliyat & Araç Servisi",
        slug: "nakliyat",
        items: [
          { name: "Evden Eve Nakliyat", slug: "hizmetler" },
          { name: "Oto Ekspertiz & Bakım", slug: "hizmetler" },
          { name: "Oto Kurtarma & Çekici", slug: "hizmetler" },
          { name: "Temizlik Hizmetleri", slug: "hizmetler" },
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
        slug: "sektorler",
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
        slug: "evcil-hayvan",
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

// ---------------------------------------------------------------------------
// 2. Autocomplete Arama Kutusu Bileşeni
// ---------------------------------------------------------------------------
