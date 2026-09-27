export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon?: string | null;
  sort_order: number;
}

export const EMBEDDED_CATEGORIES: CategoryItem[] = [
  {
    "id": "emlak",
    "name": "Emlak",
    "slug": "emlak",
    "parent_id": null,
    "icon": "home",
    "sort_order": 1
  },
  {
    "id": "vasita",
    "name": "Vasıta",
    "slug": "vasita",
    "parent_id": null,
    "icon": "car",
    "sort_order": 2
  },
  {
    "id": "alisveris",
    "name": "İkinci El ve Sıfır Alışveriş",
    "slug": "alisveris",
    "parent_id": null,
    "icon": "bag",
    "sort_order": 3
  },
  {
    "id": "yedek-parca",
    "name": "Yedek Parça, Aksesuar, Donanım & Tuning",
    "slug": "yedek-parca",
    "parent_id": null,
    "icon": "cog",
    "sort_order": 4
  },
  {
    "id": "sanayi",
    "name": "İş Makineleri & Sanayi",
    "slug": "sanayi",
    "parent_id": null,
    "icon": "tractor",
    "sort_order": 5
  },
  {
    "id": "hizmetler",
    "name": "Ustalar ve Hizmetler",
    "slug": "hizmetler",
    "parent_id": null,
    "icon": "wrench",
    "sort_order": 6
  },
  {
    "id": "ozel-ders",
    "name": "Özel Ders Verenler",
    "slug": "ozel-ders",
    "parent_id": null,
    "icon": "grad",
    "sort_order": 7
  },
  {
    "id": "is-ilanlari",
    "name": "İş İlanları",
    "slug": "is-ilanlari",
    "parent_id": null,
    "icon": "briefcase",
    "sort_order": 8
  },
  {
    "id": "yardimci",
    "name": "Yardımcı Arayanlar",
    "slug": "yardimci",
    "parent_id": null,
    "icon": "users",
    "sort_order": 9
  },
  {
    "id": "hayvanlar",
    "name": "Hayvanlar Alemi",
    "slug": "hayvanlar-alemi",
    "parent_id": null,
    "icon": "paw",
    "sort_order": 10
  },
  {
    "id": "yardimci-bebek-bakicisi",
    "name": "Bebek Bakıcısı",
    "slug": "yardimci-bebek-bakicisi",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "is-bilisim",
    "name": "Bilişim",
    "slug": "is-bilisim",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "telefon",
    "name": "Cep Telefonu",
    "slug": "cep-telefonu",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "is-makineleri",
    "name": "İş Makineleri",
    "slug": "is-makineleri",
    "parent_id": "sanayi",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "kedi",
    "name": "Kedi",
    "slug": "kedi",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "konut",
    "name": "Konut",
    "slug": "konut",
    "parent_id": "emlak",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "ders-matematik",
    "name": "Matematik",
    "slug": "ders-matematik",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "otomobil",
    "name": "Otomobil",
    "slug": "otomobil",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "yp-oto",
    "name": "Otomotiv Ekipmanları",
    "slug": "yp-oto",
    "parent_id": "yedek-parca",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "tamir",
    "name": "Tamir, Tadilat & Dekorasyon",
    "slug": "tamir",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "akilli-saat",
    "name": "Akıllı Saat",
    "slug": "akilli-saat",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "arazi-suv",
    "name": "Arazi, SUV & Pickup",
    "slug": "arazi-suv",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "yardimci-cocuk-bakicisi",
    "name": "Çocuk Bakıcısı",
    "slug": "yardimci-cocuk-bakicisi",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "is-egitim",
    "name": "Eğitim",
    "slug": "is-egitim",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "ders-fen",
    "name": "Fen",
    "slug": "ders-fen",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "ders-fen-bilimleri",
    "name": "Fen Bilimleri",
    "slug": "ders-fen-bilimleri",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "isyeri",
    "name": "İşyeri",
    "slug": "isyeri",
    "parent_id": "emlak",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "kopek",
    "name": "Köpek",
    "slug": "kopek",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "yp-moto",
    "name": "Motosiklet Ekipmanları",
    "slug": "yp-moto",
    "parent_id": "yedek-parca",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "nakliyat",
    "name": "Nakliyat",
    "slug": "nakliyat",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "tarim",
    "name": "Tarım Makineleri",
    "slug": "tarim",
    "parent_id": "sanayi",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "arsa",
    "name": "Arsa",
    "slug": "arsa",
    "parent_id": "emlak",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "bilgisayar",
    "name": "Bilgisayar",
    "slug": "bilgisayar",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "yp-deniz",
    "name": "Deniz Aracı Ekipmanları",
    "slug": "yp-deniz",
    "parent_id": "yedek-parca",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "ders-fizik",
    "name": "Fizik",
    "slug": "ders-fizik",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "hayvan-kus",
    "name": "Kuş",
    "slug": "hayvan-kus",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "moto",
    "name": "Motosiklet",
    "slug": "motosiklet",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "is-saglik",
    "name": "Sağlık",
    "slug": "is-saglik",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "sanayi-makine",
    "name": "Sanayi & Endüstri",
    "slug": "sanayi-makine",
    "parent_id": "sanayi",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "temizlik-hiz",
    "name": "Temizlik",
    "slug": "temizlik-hiz",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "yardimci-yasli-bakimi",
    "name": "Yaşlı Bakımı",
    "slug": "yardimci-yasli-bakimi",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "hayvan-balik",
    "name": "Akvaryum & Balık",
    "slug": "hayvan-balik",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "bina",
    "name": "Bina",
    "slug": "bina",
    "parent_id": "emlak",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "guzellik-hiz",
    "name": "Güzellik & Bakım",
    "slug": "guzellik-hiz",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "yardimci-hasta-bakimi",
    "name": "Hasta Bakımı",
    "slug": "yardimci-hasta-bakimi",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "yp-karavan",
    "name": "Karavan Ekipmanı",
    "slug": "yp-karavan",
    "parent_id": "yedek-parca",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ders-kimya",
    "name": "Kimya",
    "slug": "ders-kimya",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ismak-kiralik",
    "name": "Kiralık İş Makinesi",
    "slug": "ismak-kiralik",
    "parent_id": "sanayi",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "minivan",
    "name": "Minivan & Panelvan",
    "slug": "minivan",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "oyun-konsol",
    "name": "Oyun & Konsol",
    "slug": "oyun-konsol",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "is-satis-pazarlama",
    "name": "Satış & Pazarlama",
    "slug": "is-satis-pazarlama",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ders-biyoloji",
    "name": "Biyoloji",
    "slug": "ders-biyoloji",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "devre-mulk",
    "name": "Devre Mülk",
    "slug": "devre-mulk",
    "parent_id": "emlak",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "foto-kamera",
    "name": "Fotoğraf & Kamera",
    "slug": "foto-kamera",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "is-muhasebe-finans",
    "name": "Muhasebe & Finans",
    "slug": "is-muhasebe-finans",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "organizasyon",
    "name": "Organizasyon & Organizatör",
    "slug": "organizasyon",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "ismak-parca",
    "name": "Parça & Ataşman",
    "slug": "ismak-parca",
    "parent_id": "sanayi",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "yardimci-temizlikci",
    "name": "Temizlikçi",
    "slug": "yardimci-temizlikci",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "ticari",
    "name": "Ticari Araçlar",
    "slug": "ticari",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "yardimci-asci",
    "name": "Aşçı",
    "slug": "yardimci-asci",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "ev-elektronigi",
    "name": "Ev Elektroniği",
    "slug": "ev-elektronigi",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "kiralik-arac",
    "name": "Kiralık Araçlar",
    "slug": "kiralik-arac",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "is-muhendislik",
    "name": "Mühendislik",
    "slug": "is-muhendislik",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "turistik",
    "name": "Turistik Tesis",
    "slug": "turistik",
    "parent_id": "emlak",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "ders-turkce",
    "name": "Türkçe",
    "slug": "ders-turkce",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "beyaz-esya",
    "name": "Beyaz Eşya & Elektrikli Ev Aletleri",
    "slug": "beyaz-esya",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "deniz",
    "name": "Deniz Araçları",
    "slug": "deniz",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "devren",
    "name": "Devren Satılık / Kiralık",
    "slug": "devren",
    "parent_id": "emlak",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "ders-ingilizce",
    "name": "İngilizce",
    "slug": "ders-ingilizce",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "is-insaat",
    "name": "İnşaat",
    "slug": "is-insaat",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "yardimci-sofor",
    "name": "Şoför",
    "slug": "yardimci-sofor",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "ders-almanca",
    "name": "Almanca",
    "slug": "ders-almanca",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "yardimci-bahcivan",
    "name": "Bahçıvan",
    "slug": "yardimci-bahcivan",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "karavan",
    "name": "Karavan",
    "slug": "karavan",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "mobilya",
    "name": "Mobilya",
    "slug": "mobilya",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "is-turizm-otel",
    "name": "Turizm & Otel",
    "slug": "is-turizm-otel",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "ders-fransizca",
    "name": "Fransızca",
    "slug": "ders-fransizca",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "giyim",
    "name": "Giyim & Aksesuar",
    "slug": "giyim",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "yardimci-guvenlik",
    "name": "Güvenlik",
    "slug": "yardimci-guvenlik",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "hasarli",
    "name": "Hasarlı Araçlar",
    "slug": "hasarli",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "is-lojistik",
    "name": "Lojistik",
    "slug": "is-lojistik",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "yardimci-dadi",
    "name": "Dadı",
    "slug": "yardimci-dadi",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "is-guvenlik",
    "name": "Güvenlik",
    "slug": "is-guvenlik",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "hizmet-guzellik-bakim",
    "name": "Güzellik & Bakım",
    "slug": "hizmet-guzellik-bakim",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "hayvan-kemirgen",
    "name": "Kemirgen",
    "slug": "hayvan-kemirgen",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "klasik",
    "name": "Klasik Araçlar",
    "slug": "klasik",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "saat",
    "name": "Saat",
    "slug": "saat",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "ders-yabanci-dil",
    "name": "Yabancı Dil",
    "slug": "ders-yabanci-dil",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "anne-bebek",
    "name": "Anne & Bebek",
    "slug": "anne-bebek",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "atv",
    "name": "ATV / UTV",
    "slug": "atv",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "yardimci-evde-destek",
    "name": "Evde Destek",
    "slug": "yardimci-evde-destek",
    "parent_id": "yardimci",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "is-insan-kaynaklari",
    "name": "İnsan Kaynakları",
    "slug": "is-insan-kaynaklari",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "hayvan-surungen",
    "name": "Sürüngen",
    "slug": "hayvan-surungen",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "ders-universite",
    "name": "Üniversite",
    "slug": "ders-universite",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "hayvan-buyukbas",
    "name": "Büyükbaş",
    "slug": "hayvan-buyukbas",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "engelli-plaka",
    "name": "Engelli Plakalı Araçlar",
    "slug": "engelli-plaka",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "kisisel-bakim",
    "name": "Kişisel Bakım & Kozmetik",
    "slug": "kisisel-bakim",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "ders-lgs",
    "name": "LGS",
    "slug": "ders-lgs",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "hizmet-organizasyon",
    "name": "Organizasyon",
    "slug": "hizmet-organizasyon",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "is-uretim",
    "name": "Üretim",
    "slug": "is-uretim",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "hizmet-dugun",
    "name": "Düğün",
    "slug": "hizmet-dugun",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "hava",
    "name": "Hava Araçları",
    "slug": "hava",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "hobi",
    "name": "Hobi & Oyuncak",
    "slug": "hobi",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "hayvan-kucukbas",
    "name": "Küçükbaş",
    "slug": "hayvan-kucukbas",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "is-restoran-cafe",
    "name": "Restoran & Cafe",
    "slug": "is-restoran-cafe",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "ders-yks",
    "name": "YKS",
    "slug": "ders-yks",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "elektrikli-bisiklet",
    "name": "Elektrikli Bisiklet",
    "slug": "elektrikli-bisiklet",
    "parent_id": "vasita",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "koleksiyon",
    "name": "Koleksiyon",
    "slug": "koleksiyon",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "ders-kpss",
    "name": "KPSS",
    "slug": "ders-kpss",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "hayvan-kumes",
    "name": "Kümes",
    "slug": "hayvan-kumes",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "is-magaza",
    "name": "Mağaza",
    "slug": "is-magaza",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "hayvan-at",
    "name": "At",
    "slug": "hayvan-at",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "ders-muzik",
    "name": "Müzik",
    "slug": "ders-muzik",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "muzik",
    "name": "Müzik",
    "slug": "muzik",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "is-part-time",
    "name": "Part-time",
    "slug": "is-part-time",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "hayvan-aksesuar-mama",
    "name": "Aksesuar & Mama",
    "slug": "hayvan-aksesuar-mama",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "kitap",
    "name": "Kitap, Dergi, Film",
    "slug": "kitap",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "ders-spor",
    "name": "Spor",
    "slug": "ders-spor",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "is-staj",
    "name": "Staj",
    "slug": "is-staj",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "hizmet-cilingir",
    "name": "Çilingir",
    "slug": "hizmet-cilingir",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "is-freelance",
    "name": "Freelance",
    "slug": "is-freelance",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "ofis",
    "name": "Ofis & Kırtasiye",
    "slug": "ofis",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "ders-resim",
    "name": "Resim",
    "slug": "ders-resim",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "hayvan-yem",
    "name": "Yem",
    "slug": "hayvan-yem",
    "parent_id": "hayvanlar",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "is-eleman-ariyorum",
    "name": "Eleman Arıyorum",
    "slug": "is-eleman-ariyorum",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "spor",
    "name": "Spor",
    "slug": "spor",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "ders-yazilim",
    "name": "Yazılım",
    "slug": "ders-yazilim",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "bahce",
    "name": "Bahçe & Yapı Market",
    "slug": "bahce",
    "parent_id": "alisveris",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "ders-direksiyon",
    "name": "Direksiyon",
    "slug": "ders-direksiyon",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "is-is-ariyorum",
    "name": "İş Arıyorum",
    "slug": "is-is-ariyorum",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "is-cagri-merkezi",
    "name": "Çağrı Merkezi",
    "slug": "is-cagri-merkezi",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "ders-diksiyon",
    "name": "Diksiyon",
    "slug": "ders-diksiyon",
    "parent_id": "ozel-ders",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "hizmet-saglik",
    "name": "Sağlık",
    "slug": "hizmet-saglik",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "hizmet-ceviri",
    "name": "Çeviri",
    "slug": "hizmet-ceviri",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 21
  },
  {
    "id": "is-teknik-servis",
    "name": "Teknik Servis",
    "slug": "is-teknik-servis",
    "parent_id": "is-ilanlari",
    "icon": null,
    "sort_order": 21
  },
  {
    "id": "hizmet-yazilim-tasarim",
    "name": "Yazılım & Tasarım",
    "slug": "hizmet-yazilim-tasarim",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 22
  },
  {
    "id": "hizmet-evcil-hayvan-bakimi",
    "name": "Evcil Hayvan Bakımı",
    "slug": "hizmet-evcil-hayvan-bakimi",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 23
  },
  {
    "id": "hizmet-oto-yikama-detay",
    "name": "Oto Yıkama & Detay",
    "slug": "hizmet-oto-yikama-detay",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 24
  },
  {
    "id": "hizmet-emlak-danismanligi",
    "name": "Emlak Danışmanlığı",
    "slug": "hizmet-emlak-danismanligi",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 25
  },
  {
    "id": "hizmet-hukuk",
    "name": "Hukuk",
    "slug": "hizmet-hukuk",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 26
  },
  {
    "id": "hizmet-muhasebe",
    "name": "Muhasebe",
    "slug": "hizmet-muhasebe",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 27
  },
  {
    "id": "hizmet-reklam-baski",
    "name": "Reklam & Baskı",
    "slug": "hizmet-reklam-baski",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 28
  },
  {
    "id": "hizmet-guvenlik",
    "name": "Güvenlik",
    "slug": "hizmet-guvenlik",
    "parent_id": "hizmetler",
    "icon": null,
    "sort_order": 29
  },
  {
    "id": "oto-abarth",
    "name": "Abarth",
    "slug": "oto-abarth",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 0
  },
  {
    "id": "tel-apple",
    "name": "Apple",
    "slug": "tel-apple",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 0
  },
  {
    "id": "moto-aprilia",
    "name": "Aprilia",
    "slug": "moto-aprilia",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 0
  },
  {
    "id": "suv-aston-martin",
    "name": "Aston Martin",
    "slug": "suv-aston-martin",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 0
  },
  {
    "id": "van-citroen",
    "name": "Citroen",
    "slug": "van-citroen",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 0
  },
  {
    "id": "laptop",
    "name": "Dizüstü",
    "slug": "dizustu-laptop",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 0
  },
  {
    "id": "oto-acura",
    "name": "Acura",
    "slug": "oto-acura",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "koleksiyon-antika",
    "name": "Antika",
    "slug": "koleksiyon-antika",
    "parent_id": "koleksiyon",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "akilli-saat-apple-watch",
    "name": "Apple Watch",
    "slug": "akilli-saat-apple-watch",
    "parent_id": "akilli-saat",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "moto-arora",
    "name": "Arora",
    "slug": "moto-arora",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "atv-atv",
    "name": "ATV",
    "slug": "atv-atv",
    "parent_id": "atv",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "suv-audi",
    "name": "Audi",
    "slug": "suv-audi",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "bahce-bahce-aletleri",
    "name": "Bahçe Aletleri",
    "slug": "bahce-bahce-aletleri",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "anne-bebek-bebek-arabasi",
    "name": "Bebek Arabası",
    "slug": "anne-bebek-bebek-arabasi",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "tamir-boyaci",
    "name": "Boyacı",
    "slug": "tamir-boyaci",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "kedi-british-shorthair",
    "name": "British Shorthair",
    "slug": "kedi-british-shorthair",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "be-buzdolabi",
    "name": "Buzdolabı",
    "slug": "be-buzdolabi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "beyaz-esya-buzdolabi",
    "name": "Buzdolabı",
    "slug": "beyaz-esya-buzdolabi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "tel-casper",
    "name": "Casper",
    "slug": "tel-casper",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "sanayi-makine-cnc-takim-tezgahi",
    "name": "CNC & Takım Tezgahı",
    "slug": "sanayi-makine-cnc-takim-tezgahi",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "van-dacia",
    "name": "Dacia",
    "slug": "van-dacia",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "yp-deniz-deniz-motorlari",
    "name": "Deniz Motorları",
    "slug": "yp-deniz-deniz-motorlari",
    "parent_id": "yp-deniz",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "devren-devren-satilik-isyeri",
    "name": "Devren Satılık İşyeri",
    "slug": "devren-devren-satilik-isyeri",
    "parent_id": "devren",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "foto-kamera-dslr",
    "name": "DSLR",
    "slug": "foto-kamera-dslr",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "organizasyon-dugun",
    "name": "Düğün",
    "slug": "organizasyon-dugun",
    "parent_id": "organizasyon",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "ismak-ekskavator",
    "name": "Ekskavatör",
    "slug": "ismak-ekskavator",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "ismak-kiralik-ekskavator",
    "name": "Ekskavatör",
    "slug": "ismak-kiralik-ekskavator",
    "parent_id": "ismak-kiralik",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "temizlik-hiz-ev-temizligi",
    "name": "Ev Temizliği",
    "slug": "temizlik-hiz-ev-temizligi",
    "parent_id": "temizlik-hiz",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "nakliyat-evden-eve",
    "name": "Evden Eve",
    "slug": "nakliyat-evden-eve",
    "parent_id": "nakliyat",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "spor-fitness",
    "name": "Fitness",
    "slug": "spor-fitness",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "muzik-gitar",
    "name": "Gitar",
    "slug": "muzik-gitar",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "kopek-golden-retriever",
    "name": "Golden Retriever",
    "slug": "kopek-golden-retriever",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "hava-helikopter",
    "name": "Helikopter",
    "slug": "hava-helikopter",
    "parent_id": "hava",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "arsa-imarli-konut",
    "name": "İmarlı Konut Arsası",
    "slug": "arsa-imarli-konut",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "giyim-kadin-giyim",
    "name": "Kadın Giyim",
    "slug": "giyim-kadin-giyim",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "ticari-kamyonet",
    "name": "Kamyonet",
    "slug": "ticari-kamyonet",
    "parent_id": "ticari",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "kiralik-isyeri",
    "name": "Kiralık İşyeri",
    "slug": "kiralik-isyeri",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "kitap-kitap",
    "name": "Kitap",
    "slug": "kitap-kitap",
    "parent_id": "kitap",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "saat-kol-saati",
    "name": "Kol Saati",
    "slug": "saat-kol-saati",
    "parent_id": "saat",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "mob-koltuk-takimi",
    "name": "Koltuk Takımı",
    "slug": "mob-koltuk-takimi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "mobilya-koltuk-takimi",
    "name": "Koltuk Takımı",
    "slug": "mobilya-koltuk-takimi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "guzellik-hiz-kuafor",
    "name": "Kuaför",
    "slug": "guzellik-hiz-kuafor",
    "parent_id": "guzellik-hiz",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "bilgisayar-masaustu",
    "name": "Masaüstü",
    "slug": "bilgisayar-masaustu",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "pc-masaustu",
    "name": "Masaüstü",
    "slug": "pc-masaustu",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "karavan-motokaravan",
    "name": "Motokaravan",
    "slug": "karavan-motokaravan",
    "parent_id": "karavan",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "hayvan-kus-muhabbet",
    "name": "Muhabbet",
    "slug": "hayvan-kus-muhabbet",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "ofis-ofis-mobilyasi",
    "name": "Ofis Mobilyası",
    "slug": "ofis-ofis-mobilyasi",
    "parent_id": "ofis",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "turistik-otel",
    "name": "Otel",
    "slug": "turistik-otel",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "kiralik-arac-otomobil",
    "name": "Otomobil",
    "slug": "kiralik-arac-otomobil",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "hasarli-otomobil",
    "name": "Otomobil",
    "slug": "hasarli-otomobil",
    "parent_id": "hasarli",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "klasik-otomobil",
    "name": "Otomobil",
    "slug": "klasik-otomobil",
    "parent_id": "klasik",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "engelli-otomobil",
    "name": "Otomobil",
    "slug": "engelli-otomobil",
    "parent_id": "engelli-plaka",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "hobi-oyuncak",
    "name": "Oyuncak",
    "slug": "hobi-oyuncak",
    "parent_id": "hobi",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "kisisel-bakim-parfum",
    "name": "Parfüm",
    "slug": "kisisel-bakim-parfum",
    "parent_id": "kisisel-bakim",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "oyun-konsol-playstation-5",
    "name": "PlayStation 5",
    "slug": "oyun-konsol-playstation-5",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "oyun-playstation-5",
    "name": "PlayStation 5",
    "slug": "oyun-playstation-5",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "bina-satilik-bina",
    "name": "Satılık Bina",
    "slug": "bina-satilik-bina",
    "parent_id": "bina",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "satilik-konut",
    "name": "Satılık Daire",
    "slug": "satilik-konut",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "devre-satilik-devre-mulk",
    "name": "Satılık Devre Mülk",
    "slug": "devre-satilik-devre-mulk",
    "parent_id": "devre-mulk",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "elektrikli-bisiklet-sehir",
    "name": "Şehir",
    "slug": "elektrikli-bisiklet-sehir",
    "parent_id": "elektrikli-bisiklet",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "hayvan-balik-tatli-su",
    "name": "Tatlı Su",
    "slug": "hayvan-balik-tatli-su",
    "parent_id": "hayvan-balik",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "tarim-traktor",
    "name": "Traktör",
    "slug": "tarim-traktor",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "ev-elektronigi-tv",
    "name": "TV",
    "slug": "ev-elektronigi-tv",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "evel-tv",
    "name": "TV",
    "slug": "evel-tv",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "deniz-yat",
    "name": "Yat",
    "slug": "deniz-yat",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "yp-moto-yedek-parca",
    "name": "Yedek Parça",
    "slug": "yp-moto-yedek-parca",
    "parent_id": "yp-moto",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "yp-oto-yedek-parca",
    "name": "Yedek Parça",
    "slug": "yp-oto-yedek-parca",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 1
  },
  {
    "id": "oto-aion",
    "name": "Aion",
    "slug": "oto-aion",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "yp-moto-aksesuar-tuning",
    "name": "Aksesuar & Tuning",
    "slug": "yp-moto-aksesuar-tuning",
    "parent_id": "yp-moto",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "yp-oto-aksesuar-tuning",
    "name": "Aksesuar & Tuning",
    "slug": "yp-oto-aksesuar-tuning",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "turistik-apart-otel",
    "name": "Apart Otel",
    "slug": "turistik-apart-otel",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "moto-asya",
    "name": "Asya",
    "slug": "moto-asya",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "suv-bentley",
    "name": "Bentley",
    "slug": "suv-bentley",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "tarim-bicerdover",
    "name": "Biçerdöver",
    "slug": "tarim-bicerdover",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "spor-bisiklet",
    "name": "Bisiklet",
    "slug": "spor-bisiklet",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "yp-deniz-boya-bakim",
    "name": "Boya & Bakım",
    "slug": "yp-deniz-boya-bakim",
    "parent_id": "yp-deniz",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "be-camasir-makinesi",
    "name": "Çamaşır Makinesi",
    "slug": "be-camasir-makinesi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "beyaz-esya-camasir-makinesi",
    "name": "Çamaşır Makinesi",
    "slug": "beyaz-esya-camasir-makinesi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "karavan-cekme-karavan",
    "name": "Çekme Karavan",
    "slug": "karavan-cekme-karavan",
    "parent_id": "karavan",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "bahce-cim-bicme",
    "name": "Çim Biçme",
    "slug": "bahce-cim-bicme",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "elektrikli-bisiklet-dag",
    "name": "Dağ",
    "slug": "elektrikli-bisiklet-dag",
    "parent_id": "elektrikli-bisiklet",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "kitap-dergi",
    "name": "Dergi",
    "slug": "kitap-dergi",
    "parent_id": "kitap",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "devren-devren-kiralik-isyeri",
    "name": "Devren Kiralık İşyeri",
    "slug": "devren-devren-kiralik-isyeri",
    "parent_id": "devren",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "saat-duvar-saati",
    "name": "Duvar Saati",
    "slug": "saat-duvar-saati",
    "parent_id": "saat",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "giyim-erkek-giyim",
    "name": "Erkek Giyim",
    "slug": "giyim-erkek-giyim",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "van-fiat",
    "name": "Fiat",
    "slug": "van-fiat",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "ismak-kiralik-forklift",
    "name": "Forklift",
    "slug": "ismak-kiralik-forklift",
    "parent_id": "ismak-kiralik",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "tel-general-mobile",
    "name": "General Mobile",
    "slug": "tel-general-mobile",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "guzellik-hiz-guzellik-salonu",
    "name": "Güzellik Salonu",
    "slug": "guzellik-hiz-guzellik-salonu",
    "parent_id": "guzellik-hiz",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "deniz-hiz-teknesi",
    "name": "Hız Teknesi",
    "slug": "deniz-hiz-teknesi",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "arsa-imarli-ticari",
    "name": "İmarlı Ticari Arsa",
    "slug": "arsa-imarli-ticari",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "ticari-kamyon",
    "name": "Kamyon",
    "slug": "ticari-kamyon",
    "parent_id": "ticari",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "bina-kiralik-bina",
    "name": "Kiralık Bina",
    "slug": "bina-kiralik-bina",
    "parent_id": "bina",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "devre-kiralik-devre-mulk",
    "name": "Kiralık Devre Mülk",
    "slug": "devre-kiralik-devre-mulk",
    "parent_id": "devre-mulk",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "ofis-kirtasiye",
    "name": "Kırtasiye",
    "slug": "ofis-kirtasiye",
    "parent_id": "ofis",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "mobilya-kose-koltuk",
    "name": "Köşe Koltuk",
    "slug": "mobilya-kose-koltuk",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "kopek-labrador",
    "name": "Labrador",
    "slug": "kopek-labrador",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "kisisel-bakim-makyaj",
    "name": "Makyaj",
    "slug": "kisisel-bakim-makyaj",
    "parent_id": "kisisel-bakim",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "ismak-mini-ekskavator",
    "name": "Mini Ekskavatör",
    "slug": "ismak-mini-ekskavator",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "foto-kamera-mirrorless",
    "name": "Mirrorless",
    "slug": "foto-kamera-mirrorless",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "hobi-model-maket",
    "name": "Model & Maket",
    "slug": "hobi-model-maket",
    "parent_id": "hobi",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "bilgisayar-monitor",
    "name": "Monitör",
    "slug": "bilgisayar-monitor",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "pc-monitor",
    "name": "Monitör",
    "slug": "pc-monitor",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "klasik-motosiklet",
    "name": "Motosiklet",
    "slug": "klasik-motosiklet",
    "parent_id": "klasik",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "organizasyon-nisan",
    "name": "Nişan",
    "slug": "organizasyon-nisan",
    "parent_id": "organizasyon",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "temizlik-hiz-ofis-temizligi",
    "name": "Ofis Temizliği",
    "slug": "temizlik-hiz-ofis-temizligi",
    "parent_id": "temizlik-hiz",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "anne-bebek-oto-koltugu",
    "name": "Oto Koltuğu",
    "slug": "anne-bebek-oto-koltugu",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "sanayi-makine-paketleme",
    "name": "Paketleme",
    "slug": "sanayi-makine-paketleme",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "muzik-piyano-klavye",
    "name": "Piyano & Klavye",
    "slug": "muzik-piyano-klavye",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "oyun-playstation-4",
    "name": "PlayStation 4",
    "slug": "oyun-playstation-4",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "oyun-konsol-playstation-4",
    "name": "PlayStation 4",
    "slug": "oyun-konsol-playstation-4",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "koleksiyon-pul",
    "name": "Pul",
    "slug": "koleksiyon-pul",
    "parent_id": "koleksiyon",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "akilli-saat-samsung-galaxy-watch",
    "name": "Samsung Galaxy Watch",
    "slug": "akilli-saat-samsung-galaxy-watch",
    "parent_id": "akilli-saat",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "satilik-isyeri",
    "name": "Satılık İşyeri",
    "slug": "satilik-isyeri",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "satilik-residence",
    "name": "Satılık Residence",
    "slug": "satilik-residence",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "kedi-scottish-fold",
    "name": "Scottish Fold",
    "slug": "kedi-scottish-fold",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "nakliyat-sehirlerarasi",
    "name": "Şehirlerarası",
    "slug": "nakliyat-sehirlerarasi",
    "parent_id": "nakliyat",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "evel-ses-sistemi",
    "name": "Ses Sistemi",
    "slug": "evel-ses-sistemi",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "ev-elektronigi-ses-sistemi",
    "name": "Ses Sistemi",
    "slug": "ev-elektronigi-ses-sistemi",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "hayvan-kus-sultan",
    "name": "Sultan",
    "slug": "hayvan-kus-sultan",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "kiralik-arac-suv",
    "name": "SUV",
    "slug": "kiralik-arac-suv",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "hasarli-suv",
    "name": "SUV",
    "slug": "hasarli-suv",
    "parent_id": "hasarli",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "engelli-suv",
    "name": "SUV",
    "slug": "engelli-suv",
    "parent_id": "engelli-plaka",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "tamir-tesisatci",
    "name": "Tesisatçı",
    "slug": "tamir-tesisatci",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "hayvan-balik-tuzlu-su",
    "name": "Tuzlu Su",
    "slug": "hayvan-balik-tuzlu-su",
    "parent_id": "hayvan-balik",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "hava-ucak",
    "name": "Uçak",
    "slug": "hava-ucak",
    "parent_id": "hava",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "atv-utv",
    "name": "UTV",
    "slug": "atv-utv",
    "parent_id": "atv",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "mob-yatak-odasi",
    "name": "Yatak Odası",
    "slug": "mob-yatak-odasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 2
  },
  {
    "id": "hayvan-balik-akvaryum-seti",
    "name": "Akvaryum Seti",
    "slug": "hayvan-balik-akvaryum-seti",
    "parent_id": "hayvan-balik",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "oto-alfa-romeo",
    "name": "Alfa Romeo",
    "slug": "oto-alfa-romeo",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "moto-ates",
    "name": "Ates",
    "slug": "moto-ates",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "anne-bebek-besik",
    "name": "Beşik",
    "slug": "anne-bebek-besik",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "suv-bmw",
    "name": "BMW",
    "slug": "suv-bmw",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "be-bulasik-makinesi",
    "name": "Bulaşık Makinesi",
    "slug": "be-bulasik-makinesi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "beyaz-esya-bulasik-makinesi",
    "name": "Bulaşık Makinesi",
    "slug": "beyaz-esya-bulasik-makinesi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "ticari-cekici",
    "name": "Çekici",
    "slug": "ticari-cekici",
    "parent_id": "ticari",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "saat-cep-saati",
    "name": "Cep Saati",
    "slug": "saat-cep-saati",
    "parent_id": "saat",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "kisisel-bakim-cilt-bakimi",
    "name": "Cilt Bakımı",
    "slug": "kisisel-bakim-cilt-bakimi",
    "parent_id": "kisisel-bakim",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "giyim-cocuk-giyim",
    "name": "Çocuk Giyim",
    "slug": "giyim-cocuk-giyim",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "muzik-davul-perkusyon",
    "name": "Davul & Perküsyon",
    "slug": "muzik-davul-perkusyon",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "yp-deniz-demirleme-rihtim",
    "name": "Demirleme & Rıhtım",
    "slug": "yp-deniz-demirleme-rihtim",
    "parent_id": "yp-deniz",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "devren-devren-satilik-fabrika",
    "name": "Devren Satılık Fabrika",
    "slug": "devren-devren-satilik-fabrika",
    "parent_id": "devren",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "organizasyon-dogum-gunu",
    "name": "Doğum Günü",
    "slug": "organizasyon-dogum-gunu",
    "parent_id": "organizasyon",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "kitap-dvd-blu-ray",
    "name": "DVD & Blu-ray",
    "slug": "kitap-dvd-blu-ray",
    "parent_id": "kitap",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "tamir-elektrikci",
    "name": "Elektrikçi",
    "slug": "tamir-elektrikci",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "van-ford",
    "name": "Ford",
    "slug": "van-ford",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "kopek-german-shepherd",
    "name": "German Shepherd",
    "slug": "kopek-german-shepherd",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "sanayi-makine-gida-isleme",
    "name": "Gıda İşleme",
    "slug": "sanayi-makine-gida-isleme",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "tel-google",
    "name": "Google",
    "slug": "tel-google",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "temizlik-hiz-insaat-sonrasi",
    "name": "İnşaat Sonrası",
    "slug": "temizlik-hiz-insaat-sonrasi",
    "parent_id": "temizlik-hiz",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "kedi-iran",
    "name": "İran",
    "slug": "kedi-iran",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "yp-moto-jant-lastik",
    "name": "Jant & Lastik",
    "slug": "yp-moto-jant-lastik",
    "parent_id": "yp-moto",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "yp-oto-jant-lastik",
    "name": "Jant & Lastik",
    "slug": "yp-oto-jant-lastik",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "spor-kamp-doga",
    "name": "Kamp & Doğa",
    "slug": "spor-kamp-doga",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "elektrikli-bisiklet-katlanir",
    "name": "Katlanır",
    "slug": "elektrikli-bisiklet-katlanir",
    "parent_id": "elektrikli-bisiklet",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "foto-kamera-kompakt",
    "name": "Kompakt",
    "slug": "foto-kamera-kompakt",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "evel-kulaklik",
    "name": "Kulaklık",
    "slug": "evel-kulaklik",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "ev-elektronigi-kulaklik",
    "name": "Kulaklık",
    "slug": "ev-elektronigi-kulaklik",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "ismak-loader",
    "name": "Loader",
    "slug": "ismak-loader",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "guzellik-hiz-masaj",
    "name": "Masaj",
    "slug": "guzellik-hiz-masaj",
    "parent_id": "guzellik-hiz",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "hasarli-minivan",
    "name": "Minivan",
    "slug": "hasarli-minivan",
    "parent_id": "hasarli",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "kiralik-arac-minivan",
    "name": "Minivan",
    "slug": "kiralik-arac-minivan",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "engelli-minivan",
    "name": "Minivan",
    "slug": "engelli-minivan",
    "parent_id": "engelli-plaka",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "nakliyat-ofis-tasima",
    "name": "Ofis Taşıma",
    "slug": "nakliyat-ofis-tasima",
    "parent_id": "nakliyat",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "turistik-pansiyon",
    "name": "Pansiyon",
    "slug": "turistik-pansiyon",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "hayvan-kus-papagan",
    "name": "Papağan",
    "slug": "hayvan-kus-papagan",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "koleksiyon-para",
    "name": "Para",
    "slug": "koleksiyon-para",
    "parent_id": "koleksiyon",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "ofis-projeksiyon",
    "name": "Projeksiyon",
    "slug": "ofis-projeksiyon",
    "parent_id": "ofis",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "tarim-pulluk",
    "name": "Pulluk",
    "slug": "tarim-pulluk",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "hobi-puzzle",
    "name": "Puzzle",
    "slug": "hobi-puzzle",
    "parent_id": "hobi",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "atv-quad",
    "name": "Quad",
    "slug": "atv-quad",
    "parent_id": "atv",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "bina-satilik-apartman",
    "name": "Satılık Apartman",
    "slug": "bina-satilik-apartman",
    "parent_id": "bina",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "satilik-mustakil",
    "name": "Satılık Müstakil Ev",
    "slug": "satilik-mustakil",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "satilik-ofis",
    "name": "Satılık Ofis",
    "slug": "satilik-ofis",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "bahce-sulama",
    "name": "Sulama",
    "slug": "bahce-sulama",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "pc-tablet",
    "name": "Tablet",
    "slug": "pc-tablet",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "bilgisayar-tablet",
    "name": "Tablet",
    "slug": "bilgisayar-tablet",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "arsa-tarla",
    "name": "Tarla",
    "slug": "arsa-tarla",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "klasik-ticari",
    "name": "Ticari",
    "slug": "klasik-ticari",
    "parent_id": "klasik",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "karavan-tiny-house",
    "name": "Tiny House",
    "slug": "karavan-tiny-house",
    "parent_id": "karavan",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "hava-ultralight",
    "name": "Ultralight",
    "slug": "hava-ultralight",
    "parent_id": "hava",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "ismak-kiralik-vinc",
    "name": "Vinç",
    "slug": "ismak-kiralik-vinc",
    "parent_id": "ismak-kiralik",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "oyun-xbox-series",
    "name": "Xbox Series",
    "slug": "oyun-xbox-series",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "oyun-konsol-xbox-series-x-s",
    "name": "Xbox Series X|S",
    "slug": "oyun-konsol-xbox-series-x-s",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "akilli-saat-xiaomi-redmi-watch",
    "name": "Xiaomi / Redmi Watch",
    "slug": "akilli-saat-xiaomi-redmi-watch",
    "parent_id": "akilli-saat",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "mobilya-yatak-odasi",
    "name": "Yatak Odası",
    "slug": "mobilya-yatak-odasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "deniz-yelkenli",
    "name": "Yelkenli",
    "slug": "deniz-yelkenli",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "mob-yemek-odasi",
    "name": "Yemek Odası",
    "slug": "mob-yemek-odasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 3
  },
  {
    "id": "foto-kamera-aksiyon-kamera",
    "name": "Aksiyon Kamera",
    "slug": "foto-kamera-aksiyon-kamera",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "oto-alpine",
    "name": "Alpine",
    "slug": "oto-alpine",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "giyim-ayakkabi",
    "name": "Ayakkabı",
    "slug": "giyim-ayakkabi",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "arsa-bahce",
    "name": "Bahçe",
    "slug": "arsa-bahce",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "moto-bajaj",
    "name": "Bajaj",
    "slug": "moto-bajaj",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ismak-bekci-dozer",
    "name": "Bekçi Dozer",
    "slug": "ismak-bekci-dozer",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "suv-byd",
    "name": "BYD",
    "slug": "suv-byd",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "mob-calisma-masasi",
    "name": "Çalışma Masası",
    "slug": "mob-calisma-masasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "kitap-ders-kitabi",
    "name": "Ders Kitabı",
    "slug": "kitap-ders-kitabi",
    "parent_id": "kitap",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "devren-devren-satilik-caf-restoran",
    "name": "Devren Satılık Café & Restoran",
    "slug": "devren-devren-satilik-caf-restoran",
    "parent_id": "devren",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "yp-deniz-dumen-kumanda",
    "name": "Dümen & Kumanda",
    "slug": "yp-deniz-dumen-kumanda",
    "parent_id": "yp-deniz",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "hayvan-balik-ekipman",
    "name": "Ekipman",
    "slug": "hayvan-balik-ekipman",
    "parent_id": "hayvan-balik",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "be-firin",
    "name": "Fırın",
    "slug": "be-firin",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "beyaz-esya-firin",
    "name": "Fırın",
    "slug": "beyaz-esya-firin",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "tel-honor",
    "name": "Honor",
    "slug": "tel-honor",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "akilli-saat-huawei-watch",
    "name": "Huawei Watch",
    "slug": "akilli-saat-huawei-watch",
    "parent_id": "akilli-saat",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "van-hyundai",
    "name": "Hyundai",
    "slug": "van-hyundai",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "deniz-jet-ski",
    "name": "Jet Ski",
    "slug": "deniz-jet-ski",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "hayvan-kus-kanarya",
    "name": "Kanarya",
    "slug": "hayvan-kus-kanarya",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "kopek-kangal",
    "name": "Kangal",
    "slug": "kopek-kangal",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "koleksiyon-kart",
    "name": "Kart",
    "slug": "koleksiyon-kart",
    "parent_id": "koleksiyon",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "yp-moto-kask-kiyafet-ekipman",
    "name": "Kask, Kıyafet & Ekipman",
    "slug": "yp-moto-kask-kiyafet-ekipman",
    "parent_id": "yp-moto",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "bina-kiralik-apartman",
    "name": "Kiralık Apartman",
    "slug": "bina-kiralik-apartman",
    "parent_id": "bina",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "kiralik-ofis",
    "name": "Kiralık Ofis",
    "slug": "kiralik-ofis",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "temizlik-hiz-koltuk-yikama",
    "name": "Koltuk Yıkama",
    "slug": "temizlik-hiz-koltuk-yikama",
    "parent_id": "temizlik-hiz",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "organizasyon-kurumsal",
    "name": "Kurumsal",
    "slug": "organizasyon-kurumsal",
    "parent_id": "organizasyon",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "saat-luks-saat",
    "name": "Lüks Saat",
    "slug": "saat-luks-saat",
    "parent_id": "saat",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "anne-bebek-mama-sandalyesi",
    "name": "Mama Sandalyesi",
    "slug": "anne-bebek-mama-sandalyesi",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "bahce-mangal-barbeku",
    "name": "Mangal & Barbekü",
    "slug": "bahce-mangal-barbeku",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ismak-kiralik-manlift",
    "name": "Manlift",
    "slug": "ismak-kiralik-manlift",
    "parent_id": "ismak-kiralik",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "tamir-marangoz",
    "name": "Marangoz",
    "slug": "tamir-marangoz",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "tarim-mibzer",
    "name": "Mibzer",
    "slug": "tarim-mibzer",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ticari-minibus",
    "name": "Minibüs",
    "slug": "ticari-minibus",
    "parent_id": "ticari",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "kiralik-arac-motosiklet",
    "name": "Motosiklet",
    "slug": "kiralik-arac-motosiklet",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "hasarli-motosiklet",
    "name": "Motosiklet",
    "slug": "hasarli-motosiklet",
    "parent_id": "hasarli",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "nakliyat-parca-esya",
    "name": "Parça Eşya",
    "slug": "nakliyat-parca-esya",
    "parent_id": "nakliyat",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "karavan-pino-karavan",
    "name": "Pino Karavan",
    "slug": "karavan-pino-karavan",
    "parent_id": "karavan",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "hava-planor",
    "name": "Planör",
    "slug": "hava-planor",
    "parent_id": "hava",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "evel-projeksiyon",
    "name": "Projeksiyon",
    "slug": "evel-projeksiyon",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ev-elektronigi-projeksiyon",
    "name": "Projeksiyon",
    "slug": "ev-elektronigi-projeksiyon",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "hobi-rc-arac",
    "name": "RC Araç",
    "slug": "hobi-rc-arac",
    "parent_id": "hobi",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "kisisel-bakim-sac",
    "name": "Saç",
    "slug": "kisisel-bakim-sac",
    "parent_id": "kisisel-bakim",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "satilik-villa",
    "name": "Satılık Villa",
    "slug": "satilik-villa",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "elektrikli-bisiklet-scooter-elektrikli",
    "name": "Scooter (Elektrikli)",
    "slug": "elektrikli-bisiklet-scooter-elektrikli",
    "parent_id": "elektrikli-bisiklet",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "yp-oto-ses-goruntu",
    "name": "Ses & Görüntü",
    "slug": "yp-oto-ses-goruntu",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "atv-ssv",
    "name": "SSV",
    "slug": "atv-ssv",
    "parent_id": "atv",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "spor-su-sporlari",
    "name": "Su Sporları",
    "slug": "spor-su-sporlari",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "turistik-tatil-koyu",
    "name": "Tatil Köyü",
    "slug": "turistik-tatil-koyu",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "kedi-tekir",
    "name": "Tekir",
    "slug": "kedi-tekir",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "sanayi-makine-tekstil",
    "name": "Tekstil",
    "slug": "sanayi-makine-tekstil",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "guzellik-hiz-tirnak",
    "name": "Tırnak",
    "slug": "guzellik-hiz-tirnak",
    "parent_id": "guzellik-hiz",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "oyun-konsol-xbox-one",
    "name": "Xbox One",
    "slug": "oyun-konsol-xbox-one",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "oyun-xbox-one",
    "name": "Xbox One",
    "slug": "oyun-xbox-one",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "muzik-yayli",
    "name": "Yaylı",
    "slug": "muzik-yayli",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "bilgisayar-yazici-tarayici",
    "name": "Yazıcı & Tarayıcı",
    "slug": "bilgisayar-yazici-tarayici",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "pc-yazici-tarayici",
    "name": "Yazıcı & Tarayıcı",
    "slug": "pc-yazici-tarayici",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "ofis-yazici-sarf",
    "name": "Yazıcı Sarf",
    "slug": "ofis-yazici-sarf",
    "parent_id": "ofis",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "mobilya-yemek-odasi",
    "name": "Yemek Odası",
    "slug": "mobilya-yemek-odasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 4
  },
  {
    "id": "sanayi-makine-ahsap",
    "name": "Ahşap",
    "slug": "sanayi-makine-ahsap",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "tamir-alcipan",
    "name": "Alçıpan",
    "slug": "tamir-alcipan",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "oto-anadol",
    "name": "Anadol",
    "slug": "oto-anadol",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "arsa-bag",
    "name": "Bağ",
    "slug": "arsa-bag",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "moto-benelli",
    "name": "Benelli",
    "slug": "moto-benelli",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "suv-cadillac",
    "name": "Cadillac",
    "slug": "suv-cadillac",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "bahce-cadir-tente",
    "name": "Çadır & Tente",
    "slug": "bahce-cadir-tente",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "mobilya-calisma-masasi",
    "name": "Çalışma Masası",
    "slug": "mobilya-calisma-masasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "temizlik-hiz-cam-temizligi",
    "name": "Cam Temizliği",
    "slug": "temizlik-hiz-cam-temizligi",
    "parent_id": "temizlik-hiz",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "giyim-canta",
    "name": "Çanta",
    "slug": "giyim-canta",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "kitap-cizgi-roman",
    "name": "Çizgi Roman",
    "slug": "kitap-cizgi-roman",
    "parent_id": "kitap",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "nakliyat-depolama",
    "name": "Depolama",
    "slug": "nakliyat-depolama",
    "parent_id": "nakliyat",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "mob-dolap",
    "name": "Dolap",
    "slug": "mob-dolap",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "guzellik-hiz-dovmeci",
    "name": "Dövmeci",
    "slug": "guzellik-hiz-dovmeci",
    "parent_id": "guzellik-hiz",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "foto-kamera-drone",
    "name": "Drone",
    "slug": "foto-kamera-drone",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "hobi-drone-hobi",
    "name": "Drone (Hobi)",
    "slug": "hobi-drone-hobi",
    "parent_id": "hobi",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "hava-drone-ticari",
    "name": "Drone (Ticari)",
    "slug": "hava-drone-ticari",
    "parent_id": "hava",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "yp-deniz-elektrik",
    "name": "Elektrik",
    "slug": "yp-deniz-elektrik",
    "parent_id": "yp-deniz",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "yp-moto-elektronik",
    "name": "Elektronik",
    "slug": "yp-moto-elektronik",
    "parent_id": "yp-moto",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "koleksiyon-figur",
    "name": "Figür",
    "slug": "koleksiyon-figur",
    "parent_id": "koleksiyon",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "hayvan-kus-finch",
    "name": "Finch",
    "slug": "hayvan-kus-finch",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "organizasyon-fotografcilik",
    "name": "Fotoğrafçılık",
    "slug": "organizasyon-fotografcilik",
    "parent_id": "organizasyon",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "akilli-saat-garmin",
    "name": "Garmin",
    "slug": "akilli-saat-garmin",
    "parent_id": "akilli-saat",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "ismak-greyder",
    "name": "Greyder",
    "slug": "ismak-greyder",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "tel-huawei",
    "name": "Huawei",
    "slug": "tel-huawei",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "kopek-husky",
    "name": "Husky",
    "slug": "kopek-husky",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "ismak-kiralik-jenerator",
    "name": "Jeneratör",
    "slug": "ismak-kiralik-jenerator",
    "parent_id": "ismak-kiralik",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "turistik-kamp-karavan-yeri",
    "name": "Kamp & Karavan Yeri",
    "slug": "turistik-kamp-karavan-yeri",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "elektrikli-bisiklet-kargo-bisiklet",
    "name": "Kargo Bisiklet",
    "slug": "elektrikli-bisiklet-kargo-bisiklet",
    "parent_id": "elektrikli-bisiklet",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "ofis-kasa",
    "name": "Kasa",
    "slug": "ofis-kasa",
    "parent_id": "ofis",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "van-kia",
    "name": "Kia",
    "slug": "van-kia",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "spor-kis-sporlari",
    "name": "Kış Sporları",
    "slug": "spor-kis-sporlari",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "be-klima",
    "name": "Klima",
    "slug": "be-klima",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "karavan-mustakil-karavan",
    "name": "Müstakil Karavan",
    "slug": "karavan-mustakil-karavan",
    "parent_id": "karavan",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "yp-oto-navigasyon",
    "name": "Navigasyon",
    "slug": "yp-oto-navigasyon",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "muzik-nefesli",
    "name": "Nefesli",
    "slug": "muzik-nefesli",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "oyun-konsol-nintendo-switch",
    "name": "Nintendo Switch",
    "slug": "oyun-konsol-nintendo-switch",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "oyun-nintendo-switch",
    "name": "Nintendo Switch",
    "slug": "oyun-nintendo-switch",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "beyaz-esya-ocak",
    "name": "Ocak",
    "slug": "beyaz-esya-ocak",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "ticari-otobus",
    "name": "Otobüs",
    "slug": "ticari-otobus",
    "parent_id": "ticari",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "anne-bebek-oyuncak",
    "name": "Oyuncak",
    "slug": "anne-bebek-oyuncak",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "bilgisayar-parca-aksesuar",
    "name": "Parça & Aksesuar",
    "slug": "bilgisayar-parca-aksesuar",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "pc-parca-aksesuar",
    "name": "Parça & Aksesuar",
    "slug": "pc-parca-aksesuar",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "tarim-pulverizator",
    "name": "Pülverizatör",
    "slug": "tarim-pulverizator",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "bina-satilik-is-hani",
    "name": "Satılık İş Hanı",
    "slug": "bina-satilik-is-hani",
    "parent_id": "bina",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "satilik-kooperatif",
    "name": "Satılık Kooperatif",
    "slug": "satilik-kooperatif",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "satilik-plaza",
    "name": "Satılık Plaza / Plaza Katı",
    "slug": "satilik-plaza",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "deniz-sisme-bot",
    "name": "Şişme Bot",
    "slug": "deniz-sisme-bot",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "kedi-siyam",
    "name": "Siyam",
    "slug": "kedi-siyam",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "kiralik-arac-ticari",
    "name": "Ticari",
    "slug": "kiralik-arac-ticari",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "hasarli-ticari",
    "name": "Ticari",
    "slug": "hasarli-ticari",
    "parent_id": "hasarli",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "kisisel-bakim-tiras",
    "name": "Tıraş",
    "slug": "kisisel-bakim-tiras",
    "parent_id": "kisisel-bakim",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "ev-elektronigi-uydu-receiver",
    "name": "Uydu & Receiver",
    "slug": "ev-elektronigi-uydu-receiver",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "evel-uydu-receiver",
    "name": "Uydu & Receiver",
    "slug": "evel-uydu-receiver",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 5
  },
  {
    "id": "bilgisayar-ag-modem",
    "name": "Ağ & Modem",
    "slug": "bilgisayar-ag-modem",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "pc-ag-modem",
    "name": "Ağ & Modem",
    "slug": "pc-ag-modem",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "kisisel-bakim-agiz-bakimi",
    "name": "Ağız Bakımı",
    "slug": "kisisel-bakim-agiz-bakimi",
    "parent_id": "kisisel-bakim",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "karavan-alkoven",
    "name": "Alkoven",
    "slug": "karavan-alkoven",
    "parent_id": "karavan",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "akilli-saat-amazfit",
    "name": "Amazfit",
    "slug": "akilli-saat-amazfit",
    "parent_id": "akilli-saat",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "oto-arora",
    "name": "Arora",
    "slug": "oto-arora",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "yp-oto-aydinlatma",
    "name": "Aydınlatma",
    "slug": "yp-oto-aydinlatma",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "deniz-balikci-teknesi",
    "name": "Balıkçı Teknesi",
    "slug": "deniz-balikci-teknesi",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "hava-balon",
    "name": "Balon",
    "slug": "hava-balon",
    "parent_id": "hava",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "tarim-balya-makinesi",
    "name": "Balya Makinesi",
    "slug": "tarim-balya-makinesi",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "moto-bisan",
    "name": "Bisan",
    "slug": "moto-bisan",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "turistik-butik-otel",
    "name": "Butik Otel",
    "slug": "turistik-butik-otel",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "suv-chery",
    "name": "Chery",
    "slug": "suv-chery",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "beyaz-esya-davlumbaz",
    "name": "Davlumbaz",
    "slug": "beyaz-esya-davlumbaz",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "organizasyon-dj-muzik",
    "name": "DJ & Müzik",
    "slug": "organizasyon-dj-muzik",
    "parent_id": "organizasyon",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "muzik-dj-produksiyon",
    "name": "DJ & Prodüksiyon",
    "slug": "muzik-dj-produksiyon",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "mobilya-dolap",
    "name": "Dolap",
    "slug": "mobilya-dolap",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "tamir-fayans",
    "name": "Fayans",
    "slug": "tamir-fayans",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "spor-futbol",
    "name": "Futbol",
    "slug": "spor-futbol",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "mob-gardirop",
    "name": "Gardırop",
    "slug": "mob-gardirop",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "anne-bebek-giyim",
    "name": "Giyim",
    "slug": "anne-bebek-giyim",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "hayvan-kus-guvercin",
    "name": "Güvercin",
    "slug": "hayvan-kus-guvercin",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "bahce-hirdavat",
    "name": "Hırdavat",
    "slug": "bahce-hirdavat",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "tel-infinix",
    "name": "Infinix",
    "slug": "tel-infinix",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "kiralik-arac-karavan",
    "name": "Karavan",
    "slug": "kiralik-arac-karavan",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "bina-kiralik-is-hani",
    "name": "Kiralık İş Hanı",
    "slug": "bina-kiralik-is-hani",
    "parent_id": "bina",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "kiralik-plaza",
    "name": "Kiralık Plaza / Plaza Katı",
    "slug": "kiralik-plaza",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "ismak-kiralik-kompresor",
    "name": "Kompresör",
    "slug": "ismak-kiralik-kompresor",
    "parent_id": "ismak-kiralik",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "foto-kamera-lens",
    "name": "Lens",
    "slug": "foto-kamera-lens",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "kedi-maine-coon",
    "name": "Maine Coon",
    "slug": "kedi-maine-coon",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "ev-elektronigi-media-player",
    "name": "Media Player",
    "slug": "ev-elektronigi-media-player",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "van-mercedes",
    "name": "Mercedes",
    "slug": "van-mercedes",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "oyun-konsol-nintendo-switch-2",
    "name": "Nintendo Switch 2",
    "slug": "oyun-konsol-nintendo-switch-2",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "oyun-oyun",
    "name": "Oyun",
    "slug": "oyun-oyun",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "hobi-oyun-konsolu-aksesuar",
    "name": "Oyun Konsolu Aksesuar",
    "slug": "hobi-oyun-konsolu-aksesuar",
    "parent_id": "hobi",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "koleksiyon-plak",
    "name": "Plak",
    "slug": "koleksiyon-plak",
    "parent_id": "koleksiyon",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "sanayi-makine-plastik-enjeksiyon",
    "name": "Plastik Enjeksiyon",
    "slug": "sanayi-makine-plastik-enjeksiyon",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "kopek-poodle",
    "name": "Poodle",
    "slug": "kopek-poodle",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "giyim-saat",
    "name": "Saat",
    "slug": "giyim-saat",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "satilik-yazlik",
    "name": "Satılık Yazlık",
    "slug": "satilik-yazlik",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "ismak-silindir",
    "name": "Silindir",
    "slug": "ismak-silindir",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "be-supurge",
    "name": "Süpürge",
    "slug": "be-supurge",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "giyim-taki",
    "name": "Takı",
    "slug": "giyim-taki",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "yp-deniz-yelken-donanimi",
    "name": "Yelken Donanımı",
    "slug": "yp-deniz-yelken-donanimi",
    "parent_id": "yp-deniz",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "arsa-zeytinlik",
    "name": "Zeytinlik",
    "slug": "arsa-zeytinlik",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 6
  },
  {
    "id": "muzik-amfi",
    "name": "Amfi",
    "slug": "muzik-amfi",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "oto-aston-martin",
    "name": "Aston Martin",
    "slug": "oto-aston-martin",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "anne-bebek-banyo",
    "name": "Banyo",
    "slug": "anne-bebek-banyo",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "spor-basketbol",
    "name": "Basketbol",
    "slug": "spor-basketbol",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "moto-bmw-motorrad",
    "name": "BMW Motorrad",
    "slug": "moto-bmw-motorrad",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "bahce-boya",
    "name": "Boya",
    "slug": "bahce-boya",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "kopek-bulldog",
    "name": "Bulldog",
    "slug": "kopek-bulldog",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "suv-chevrolet",
    "name": "Chevrolet",
    "slug": "suv-chevrolet",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "kiralik-arac-deniz-araci",
    "name": "Deniz Aracı",
    "slug": "kiralik-arac-deniz-araci",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "akilli-saat-diger",
    "name": "Diğer",
    "slug": "akilli-saat-diger",
    "parent_id": "akilli-saat",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "karavan-entegre",
    "name": "Entegre",
    "slug": "karavan-entegre",
    "parent_id": "karavan",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "ismak-forklift",
    "name": "Forklift",
    "slug": "ismak-forklift",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "mobilya-gardirop",
    "name": "Gardırop",
    "slug": "mobilya-gardirop",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "giyim-gozluk",
    "name": "Gözlük",
    "slug": "giyim-gozluk",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "ev-elektronigi-hoparlor",
    "name": "Hoparlör",
    "slug": "ev-elektronigi-hoparlor",
    "parent_id": "ev-elektronigi",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "arsa-ifrazli",
    "name": "İfrazlı Parsel",
    "slug": "arsa-ifrazli",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "yp-oto-kaporta",
    "name": "Kaporta",
    "slug": "yp-oto-kaporta",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "deniz-katamaran",
    "name": "Katamaran",
    "slug": "deniz-katamaran",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "sanayi-makine-kaynak",
    "name": "Kaynak",
    "slug": "sanayi-makine-kaynak",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "beyaz-esya-klima",
    "name": "Klima",
    "slug": "beyaz-esya-klima",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "oyun-kol-aksesuar",
    "name": "Kol & Aksesuar",
    "slug": "oyun-kol-aksesuar",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "turistik-motel",
    "name": "Motel",
    "slug": "turistik-motel",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "tel-motorola",
    "name": "Motorola",
    "slug": "tel-motorola",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "tamir-nakliyat",
    "name": "Nakliyat",
    "slug": "tamir-nakliyat",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "van-nissan",
    "name": "Nissan",
    "slug": "van-nissan",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "bilgisayar-oyun-bilgisayari",
    "name": "Oyun Bilgisayarı",
    "slug": "bilgisayar-oyun-bilgisayari",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "pc-oyun-bilgisayari",
    "name": "Oyun Bilgisayarı",
    "slug": "pc-oyun-bilgisayari",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "tamir-parke",
    "name": "Parke",
    "slug": "tamir-parke",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "tarim-romork",
    "name": "Römork",
    "slug": "tarim-romork",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "koleksiyon-sanat-eseri",
    "name": "Sanat Eseri",
    "slug": "koleksiyon-sanat-eseri",
    "parent_id": "koleksiyon",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "satilik-dukkan",
    "name": "Satılık Dükkan & Mağaza",
    "slug": "satilik-dukkan",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "satilik-prefabrik",
    "name": "Satılık Prefabrik Ev",
    "slug": "satilik-prefabrik",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "kedi-sphynx",
    "name": "Sphynx",
    "slug": "kedi-sphynx",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "oyun-konsol-steam-deck",
    "name": "Steam Deck",
    "slug": "oyun-konsol-steam-deck",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "organizasyon-sunnet",
    "name": "Sünnet",
    "slug": "organizasyon-sunnet",
    "parent_id": "organizasyon",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "hayvan-kus-tavus",
    "name": "Tavus",
    "slug": "hayvan-kus-tavus",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "foto-kamera-tripod-stabilizer",
    "name": "Tripod & Stabilizer",
    "slug": "foto-kamera-tripod-stabilizer",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "mob-tv-unitesi",
    "name": "TV Ünitesi",
    "slug": "mob-tv-unitesi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "yp-deniz-yakit-sistemi",
    "name": "Yakıt Sistemi",
    "slug": "yp-deniz-yakit-sistemi",
    "parent_id": "yp-deniz",
    "icon": null,
    "sort_order": 7
  },
  {
    "id": "kedi-ankara-kedisi",
    "name": "Ankara Kedisi",
    "slug": "kedi-ankara-kedisi",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "oto-audi",
    "name": "Audi",
    "slug": "oto-audi",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "foto-kamera-aydinlatma",
    "name": "Aydınlatma",
    "slug": "foto-kamera-aydinlatma",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "mob-bahce-mobilyasi",
    "name": "Bahçe Mobilyası",
    "slug": "mob-bahce-mobilyasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "moto-canam",
    "name": "Canam",
    "slug": "moto-canam",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "suv-citroen",
    "name": "Citroen",
    "slug": "suv-citroen",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "hayvan-kus-diger",
    "name": "Diğer",
    "slug": "hayvan-kus-diger",
    "parent_id": "hayvan-kus",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "bahce-elektrik-malzeme",
    "name": "Elektrik Malzeme",
    "slug": "bahce-elektrik-malzeme",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "anne-bebek-emzirme",
    "name": "Emzirme",
    "slug": "anne-bebek-emzirme",
    "parent_id": "anne-bebek",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "deniz-gulet",
    "name": "Gulet",
    "slug": "deniz-gulet",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "turistik-hostel",
    "name": "Hostel",
    "slug": "turistik-hostel",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "kiralik-dukkan",
    "name": "Kiralık Dükkan & Mağaza",
    "slug": "kiralik-dukkan",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "tamir-klima-servisi",
    "name": "Klima Servisi",
    "slug": "tamir-klima-servisi",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "sanayi-makine-kompresor",
    "name": "Kompresör",
    "slug": "sanayi-makine-kompresor",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "arsa-kosk-arsasi",
    "name": "Köşk Arsası",
    "slug": "arsa-kosk-arsasi",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "kiralik-arac-luks-dugun",
    "name": "Lüks & Düğün",
    "slug": "kiralik-arac-luks-dugun",
    "parent_id": "kiralik-arac",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "ismak-manlift",
    "name": "Manlift",
    "slug": "ismak-manlift",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "yp-oto-motor",
    "name": "Motor",
    "slug": "yp-oto-motor",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "tel-nokia",
    "name": "Nokia",
    "slug": "tel-nokia",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "van-opel",
    "name": "Opel",
    "slug": "van-opel",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "oyun-konsol-oyun",
    "name": "Oyun",
    "slug": "oyun-konsol-oyun",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "muzik-plakcalar",
    "name": "Plakçalar",
    "slug": "muzik-plakcalar",
    "parent_id": "muzik",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "oyun-retro-konsol",
    "name": "Retro Konsol",
    "slug": "oyun-retro-konsol",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "giyim-sapka-bere",
    "name": "Şapka & Bere",
    "slug": "giyim-sapka-bere",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "satilik-ciftlik",
    "name": "Satılık Çiftlik Evi",
    "slug": "satilik-ciftlik",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "bilgisayar-sunucu",
    "name": "Sunucu",
    "slug": "bilgisayar-sunucu",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "beyaz-esya-supurge",
    "name": "Süpürge",
    "slug": "beyaz-esya-supurge",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "tarim-sut-sagim",
    "name": "Süt Sağım",
    "slug": "tarim-sut-sagim",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "tamir-temizlik",
    "name": "Temizlik",
    "slug": "tamir-temizlik",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "spor-tenis",
    "name": "Tenis",
    "slug": "spor-tenis",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "kopek-terrier",
    "name": "Terrier",
    "slug": "kopek-terrier",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "mobilya-tv-unitesi",
    "name": "TV Ünitesi",
    "slug": "mobilya-tv-unitesi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 8
  },
  {
    "id": "mobilya-bahce-mobilyasi",
    "name": "Bahçe Mobilyası",
    "slug": "mobilya-bahce-mobilyasi",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "oto-bentley",
    "name": "Bentley",
    "slug": "oto-bentley",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "spor-boks-dovus",
    "name": "Boks & Dövüş",
    "slug": "spor-boks-dovus",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "moto-cfmoto",
    "name": "CFMoto",
    "slug": "moto-cfmoto",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "suv-cupra",
    "name": "Cupra",
    "slug": "suv-cupra",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "turistik-diger-tesis",
    "name": "Diğer Tesis",
    "slug": "turistik-diger-tesis",
    "parent_id": "turistik",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "yp-oto-fren",
    "name": "Fren",
    "slug": "yp-oto-fren",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "foto-kamera-hafiza-karti",
    "name": "Hafıza Kartı",
    "slug": "foto-kamera-hafiza-karti",
    "parent_id": "foto-kamera",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "giyim-ic-giyim",
    "name": "İç Giyim",
    "slug": "giyim-ic-giyim",
    "parent_id": "giyim",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "sanayi-makine-jenerator",
    "name": "Jeneratör",
    "slug": "sanayi-makine-jenerator",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "oyun-konsol-kol-aksesuar",
    "name": "Kol & Aksesuar",
    "slug": "oyun-konsol-kol-aksesuar",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "tamir-kombi-servisi",
    "name": "Kombi Servisi",
    "slug": "tamir-kombi-servisi",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "beyaz-esya-mikrodalga",
    "name": "Mikrodalga",
    "slug": "beyaz-esya-mikrodalga",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "tel-nothing",
    "name": "Nothing",
    "slug": "tel-nothing",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "van-peugeot",
    "name": "Peugeot",
    "slug": "van-peugeot",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "kopek-rottweiler",
    "name": "Rottweiler",
    "slug": "kopek-rottweiler",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "satilik-depo",
    "name": "Satılık Depo & Antrepo",
    "slug": "satilik-depo",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "satilik-yali",
    "name": "Satılık Yalı",
    "slug": "satilik-yali",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "tarim-sulama",
    "name": "Sulama",
    "slug": "tarim-sulama",
    "parent_id": "tarim",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "deniz-surat-teknesi",
    "name": "Sürat Teknesi",
    "slug": "deniz-surat-teknesi",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "ismak-telehandler",
    "name": "Telehandler",
    "slug": "ismak-telehandler",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "bahce-tesisat",
    "name": "Tesisat",
    "slug": "bahce-tesisat",
    "parent_id": "bahce",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "kedi-van-kedisi",
    "name": "Van Kedisi",
    "slug": "kedi-van-kedisi",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "bilgisayar-veri-depolama",
    "name": "Veri Depolama",
    "slug": "bilgisayar-veri-depolama",
    "parent_id": "bilgisayar",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "arsa-villa-arsasi",
    "name": "Villa Arsası",
    "slug": "arsa-villa-arsasi",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 9
  },
  {
    "id": "kedi-bengal",
    "name": "Bengal",
    "slug": "kedi-bengal",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "oto-bmw",
    "name": "BMW",
    "slug": "oto-bmw",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "kopek-cane-corso",
    "name": "Cane Corso",
    "slug": "kopek-cane-corso",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "tamir-cilingir",
    "name": "Çilingir",
    "slug": "tamir-cilingir",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "suv-dacia",
    "name": "Dacia",
    "slug": "suv-dacia",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "moto-ducati",
    "name": "Ducati",
    "slug": "moto-ducati",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "ismak-kepce",
    "name": "Kepçe",
    "slug": "ismak-kepce",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "kiralik-depo",
    "name": "Kiralık Depo & Antrepo",
    "slug": "kiralik-depo",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "sanayi-makine-konteyner-kabin",
    "name": "Konteyner & Kabin",
    "slug": "sanayi-makine-konteyner-kabin",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "beyaz-esya-kurutma-makinesi",
    "name": "Kurutma Makinesi",
    "slug": "beyaz-esya-kurutma-makinesi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "deniz-motor-yat",
    "name": "Motor Yat",
    "slug": "deniz-motor-yat",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "tel-omix",
    "name": "Omix",
    "slug": "tel-omix",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "van-renault",
    "name": "Renault",
    "slug": "van-renault",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "oyun-konsol-retro-konsol",
    "name": "Retro Konsol",
    "slug": "oyun-konsol-retro-konsol",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "arsa-sanayi",
    "name": "Sanayi Arsası",
    "slug": "arsa-sanayi",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "satilik-kosk",
    "name": "Satılık Köşk & Konak",
    "slug": "satilik-kosk",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "yp-oto-suspansiyon",
    "name": "Süspansiyon",
    "slug": "yp-oto-suspansiyon",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "mobilya-yatak-baza",
    "name": "Yatak & Baza",
    "slug": "mobilya-yatak-baza",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "spor-yoga",
    "name": "Yoga",
    "slug": "spor-yoga",
    "parent_id": "spor",
    "icon": null,
    "sort_order": 10
  },
  {
    "id": "oto-buick",
    "name": "Buick",
    "slug": "oto-buick",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "tamir-camci",
    "name": "Camcı",
    "slug": "tamir-camci",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "kopek-doberman",
    "name": "Doberman",
    "slug": "kopek-doberman",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "suv-ds",
    "name": "DS Automobiles",
    "slug": "suv-ds",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "yp-oto-egzoz",
    "name": "Egzoz",
    "slug": "yp-oto-egzoz",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "moto-falcon",
    "name": "Falcon",
    "slug": "moto-falcon",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "mobilya-kitaplik",
    "name": "Kitaplık",
    "slug": "mobilya-kitaplik",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "deniz-kotra",
    "name": "Kotra",
    "slug": "deniz-kotra",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "tel-oneplus",
    "name": "OnePlus",
    "slug": "tel-oneplus",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "sanayi-makine-raf-teshir",
    "name": "Raf & Teşhir",
    "slug": "sanayi-makine-raf-teshir",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "kedi-ragdoll",
    "name": "Ragdoll",
    "slug": "kedi-ragdoll",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "satilik-fabrika",
    "name": "Satılık Fabrika & Üretim Tesisi",
    "slug": "satilik-fabrika",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "satilik-yali-daire",
    "name": "Satılık Yalı Dairesi",
    "slug": "satilik-yali-daire",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "van-toyota",
    "name": "Toyota",
    "slug": "van-toyota",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "ismak-traktor",
    "name": "Traktör",
    "slug": "ismak-traktor",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "arsa-turizm",
    "name": "Turizm Arsası",
    "slug": "arsa-turizm",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "beyaz-esya-utu",
    "name": "Ütü",
    "slug": "beyaz-esya-utu",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "oyun-konsol-vr",
    "name": "VR",
    "slug": "oyun-konsol-vr",
    "parent_id": "oyun-konsol",
    "icon": null,
    "sort_order": 11
  },
  {
    "id": "ismak-beton-pompasi",
    "name": "Beton Pompası",
    "slug": "ismak-beton-pompasi",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "oto-byd",
    "name": "BYD",
    "slug": "oto-byd",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "tamir-cati",
    "name": "Çatı",
    "slug": "tamir-cati",
    "parent_id": "tamir",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "yp-oto-elektrik",
    "name": "Elektrik",
    "slug": "yp-oto-elektrik",
    "parent_id": "yp-oto",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "sanayi-makine-endustriyel-mutfak",
    "name": "Endüstriyel Mutfak",
    "slug": "sanayi-makine-endustriyel-mutfak",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "suv-fiat",
    "name": "Fiat",
    "slug": "suv-fiat",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "moto-harley-davidson",
    "name": "Harley-Davidson",
    "slug": "moto-harley-davidson",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "beyaz-esya-kahve-makinesi",
    "name": "Kahve Makinesi",
    "slug": "beyaz-esya-kahve-makinesi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "kiralik-fabrika",
    "name": "Kiralık Fabrika & Üretim Tesisi",
    "slug": "kiralik-fabrika",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "kopek-malinois",
    "name": "Malinois",
    "slug": "kopek-malinois",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "tel-oppo",
    "name": "Oppo",
    "slug": "tel-oppo",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "deniz-romorkor",
    "name": "Römorkör",
    "slug": "deniz-romorkor",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "satilik-koy-evi",
    "name": "Satılık Köy Evi",
    "slug": "satilik-koy-evi",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "mobilya-sehpa",
    "name": "Sehpa",
    "slug": "mobilya-sehpa",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "arsa-sera",
    "name": "Sera",
    "slug": "arsa-sera",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "kedi-sibirya",
    "name": "Sibirya",
    "slug": "kedi-sibirya",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "van-vw",
    "name": "Volkswagen",
    "slug": "van-vw",
    "parent_id": "minivan",
    "icon": null,
    "sort_order": 12
  },
  {
    "id": "ismak-asfalt-makinesi",
    "name": "Asfalt Makinesi",
    "slug": "ismak-asfalt-makinesi",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "mobilya-ayna",
    "name": "Ayna",
    "slug": "mobilya-ayna",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "kedi-british-longhair",
    "name": "British Longhair",
    "slug": "kedi-british-longhair",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "oto-cadillac",
    "name": "Cadillac",
    "slug": "oto-cadillac",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "beyaz-esya-cay-makinesi",
    "name": "Çay Makinesi",
    "slug": "beyaz-esya-cay-makinesi",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "kopek-chihuahua",
    "name": "Chihuahua",
    "slug": "kopek-chihuahua",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "arsa-ciftlik",
    "name": "Çiftlik",
    "slug": "arsa-ciftlik",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "suv-ford",
    "name": "Ford",
    "slug": "suv-ford",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "moto-honda",
    "name": "Honda",
    "slug": "moto-honda",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "tel-realme",
    "name": "Realme",
    "slug": "tel-realme",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "deniz-sandal",
    "name": "Sandal",
    "slug": "deniz-sandal",
    "parent_id": "deniz",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "satilik-atolye",
    "name": "Satılık Atölye",
    "slug": "satilik-atolye",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "satilik-loft",
    "name": "Satılık Loft",
    "slug": "satilik-loft",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "sanayi-makine-temizlik-makinesi",
    "name": "Temizlik Makinesi",
    "slug": "sanayi-makine-temizlik-makinesi",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 13
  },
  {
    "id": "mobilya-avize-aydinlatma",
    "name": "Avize & Aydınlatma",
    "slug": "mobilya-avize-aydinlatma",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "beyaz-esya-blender-mikser",
    "name": "Blender & Mikser",
    "slug": "beyaz-esya-blender-mikser",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "oto-chery",
    "name": "Chery",
    "slug": "oto-chery",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "arsa-diger",
    "name": "Diğer Arsa",
    "slug": "arsa-diger",
    "parent_id": "arsa",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "sanayi-makine-gunes-paneli",
    "name": "Güneş Paneli",
    "slug": "sanayi-makine-gunes-paneli",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "suv-honda",
    "name": "Honda",
    "slug": "suv-honda",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "moto-husqvarna",
    "name": "Husqvarna",
    "slug": "moto-husqvarna",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "ismak-kazici-yukleyici",
    "name": "Kazıcı Yükleyici",
    "slug": "ismak-kazici-yukleyici",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "kiralik-atolye",
    "name": "Kiralık Atölye",
    "slug": "kiralik-atolye",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "kopek-pomeranian",
    "name": "Pomeranian",
    "slug": "kopek-pomeranian",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "tel-reeder",
    "name": "Reeder",
    "slug": "tel-reeder",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "satilik-cati-dubleks",
    "name": "Satılık Çatı Dubleks",
    "slug": "satilik-cati-dubleks",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "kedi-scottish-straight",
    "name": "Scottish Straight",
    "slug": "kedi-scottish-straight",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 14
  },
  {
    "id": "sanayi-makine-akaryakit-ekipmani",
    "name": "Akaryakıt Ekipmanı",
    "slug": "sanayi-makine-akaryakit-ekipmani",
    "parent_id": "sanayi-makine",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "oto-chevrolet",
    "name": "Chevrolet",
    "slug": "oto-chevrolet",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "mobilya-hali-kilim",
    "name": "Halı & Kilim",
    "slug": "mobilya-hali-kilim",
    "parent_id": "mobilya",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "suv-hyundai",
    "name": "Hyundai",
    "slug": "suv-hyundai",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "moto-indian",
    "name": "Indian",
    "slug": "moto-indian",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "beyaz-esya-isitici",
    "name": "Isıtıcı",
    "slug": "beyaz-esya-isitici",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "ismak-kule-vinc",
    "name": "Kule Vinç",
    "slug": "ismak-kule-vinc",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "tel-samsung",
    "name": "Samsung",
    "slug": "tel-samsung",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "kedi-sarman",
    "name": "Sarman",
    "slug": "kedi-sarman",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "satilik-bahce-dubleks",
    "name": "Satılık Bahçe Dubleks",
    "slug": "satilik-bahce-dubleks",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "satilik-buro",
    "name": "Satılık Büro",
    "slug": "satilik-buro",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "kopek-shih-tzu",
    "name": "Shih Tzu",
    "slug": "kopek-shih-tzu",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 15
  },
  {
    "id": "kopek-boxer",
    "name": "Boxer",
    "slug": "kopek-boxer",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "oto-chrysler",
    "name": "Chrysler",
    "slug": "oto-chrysler",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "kedi-diger-kedi",
    "name": "Diğer Kedi",
    "slug": "kedi-diger-kedi",
    "parent_id": "kedi",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "suv-infiniti",
    "name": "Infiniti",
    "slug": "suv-infiniti",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "moto-kanuni",
    "name": "Kanuni",
    "slug": "moto-kanuni",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "kiralik-buro",
    "name": "Kiralık Büro",
    "slug": "kiralik-buro",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "ismak-mobil-vinc",
    "name": "Mobil Vinç",
    "slug": "ismak-mobil-vinc",
    "parent_id": "is-makineleri",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "satilik-tripleks",
    "name": "Satılık Tripleks",
    "slug": "satilik-tripleks",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "tel-sony",
    "name": "Sony",
    "slug": "tel-sony",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "beyaz-esya-su-sebili",
    "name": "Su Sebili",
    "slug": "beyaz-esya-su-sebili",
    "parent_id": "beyaz-esya",
    "icon": null,
    "sort_order": 16
  },
  {
    "id": "kopek-akita",
    "name": "Akita",
    "slug": "kopek-akita",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "oto-citroen",
    "name": "Citroen",
    "slug": "oto-citroen",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "suv-isuzu",
    "name": "Isuzu",
    "slug": "suv-isuzu",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "moto-kawasaki",
    "name": "Kawasaki",
    "slug": "moto-kawasaki",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "satilik-avm",
    "name": "Satılık AVM & İş Hanı",
    "slug": "satilik-avm",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "satilik-tiny-house",
    "name": "Satılık Tiny House",
    "slug": "satilik-tiny-house",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "tel-tecno",
    "name": "Tecno",
    "slug": "tel-tecno",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 17
  },
  {
    "id": "oto-cupra",
    "name": "Cupra",
    "slug": "oto-cupra",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "suv-jaecoo",
    "name": "Jaecoo",
    "slug": "suv-jaecoo",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "moto-keeway",
    "name": "Keeway",
    "slug": "moto-keeway",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "kiralik-avm",
    "name": "Kiralık AVM & İş Hanı",
    "slug": "kiralik-avm",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "kopek-samoyed",
    "name": "Samoyed",
    "slug": "kopek-samoyed",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "tel-vestel",
    "name": "Vestel",
    "slug": "tel-vestel",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 18
  },
  {
    "id": "kopek-border-collie",
    "name": "Border Collie",
    "slug": "kopek-border-collie",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "oto-dacia",
    "name": "Dacia",
    "slug": "oto-dacia",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "suv-jaguar",
    "name": "Jaguar",
    "slug": "suv-jaguar",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "moto-ktm",
    "name": "KTM",
    "slug": "moto-ktm",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "satilik-kafe",
    "name": "Satılık Café & Restoran",
    "slug": "satilik-kafe",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "tel-xiaomi",
    "name": "Xiaomi",
    "slug": "tel-xiaomi",
    "parent_id": "telefon",
    "icon": null,
    "sort_order": 19
  },
  {
    "id": "oto-daewoo",
    "name": "Daewoo",
    "slug": "oto-daewoo",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "kopek-diger-kopek",
    "name": "Diğer Köpek",
    "slug": "kopek-diger-kopek",
    "parent_id": "kopek",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "suv-jeep",
    "name": "Jeep",
    "slug": "suv-jeep",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "kiralik-kafe",
    "name": "Kiralık Café & Restoran",
    "slug": "kiralik-kafe",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "moto-kuba",
    "name": "Kuba",
    "slug": "moto-kuba",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 20
  },
  {
    "id": "oto-daihatsu",
    "name": "Daihatsu",
    "slug": "oto-daihatsu",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 21
  },
  {
    "id": "suv-kgm",
    "name": "Kgm",
    "slug": "suv-kgm",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 21
  },
  {
    "id": "moto-kymco",
    "name": "Kymco",
    "slug": "moto-kymco",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 21
  },
  {
    "id": "satilik-otel",
    "name": "Satılık Otel",
    "slug": "satilik-otel",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 21
  },
  {
    "id": "oto-dodge",
    "name": "Dodge",
    "slug": "oto-dodge",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 22
  },
  {
    "id": "suv-kia",
    "name": "Kia",
    "slug": "suv-kia",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 22
  },
  {
    "id": "kiralik-otel",
    "name": "Kiralık Otel",
    "slug": "kiralik-otel",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 22
  },
  {
    "id": "moto-mondial",
    "name": "Mondial",
    "slug": "moto-mondial",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 22
  },
  {
    "id": "oto-ds",
    "name": "DS Automobiles",
    "slug": "oto-ds",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 23
  },
  {
    "id": "suv-land-rover",
    "name": "Land Rover",
    "slug": "suv-land-rover",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 23
  },
  {
    "id": "moto-moto-guzzi",
    "name": "Moto Guzzi",
    "slug": "moto-moto-guzzi",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 23
  },
  {
    "id": "satilik-otopark-is",
    "name": "Satılık Otopark",
    "slug": "satilik-otopark-is",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 23
  },
  {
    "id": "oto-eagle",
    "name": "Eagle",
    "slug": "oto-eagle",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 24
  },
  {
    "id": "kiralik-otopark-is",
    "name": "Kiralık Otopark",
    "slug": "kiralik-otopark-is",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 24
  },
  {
    "id": "suv-lexus",
    "name": "Lexus",
    "slug": "suv-lexus",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 24
  },
  {
    "id": "moto-motolux",
    "name": "Motolux",
    "slug": "moto-motolux",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 24
  },
  {
    "id": "oto-ferrari",
    "name": "Ferrari",
    "slug": "oto-ferrari",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 25
  },
  {
    "id": "suv-maserati",
    "name": "Maserati",
    "slug": "suv-maserati",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 25
  },
  {
    "id": "moto-mv-agusta",
    "name": "MV Agusta",
    "slug": "moto-mv-agusta",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 25
  },
  {
    "id": "satilik-benzinlik",
    "name": "Satılık Benzinlik",
    "slug": "satilik-benzinlik",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 25
  },
  {
    "id": "oto-fiat",
    "name": "Fiat",
    "slug": "oto-fiat",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 26
  },
  {
    "id": "kiralik-benzinlik",
    "name": "Kiralık Benzinlik",
    "slug": "kiralik-benzinlik",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 26
  },
  {
    "id": "suv-mazda",
    "name": "Mazda",
    "slug": "suv-mazda",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 26
  },
  {
    "id": "moto-niu",
    "name": "Niu",
    "slug": "moto-niu",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 26
  },
  {
    "id": "oto-ford",
    "name": "Ford",
    "slug": "oto-ford",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 27
  },
  {
    "id": "suv-mercedes",
    "name": "Mercedes-Benz",
    "slug": "suv-mercedes",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 27
  },
  {
    "id": "moto-piaggio",
    "name": "Piaggio",
    "slug": "moto-piaggio",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 27
  },
  {
    "id": "satilik-malzeme",
    "name": "Satılık Malzeme & Ekipman",
    "slug": "satilik-malzeme",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 27
  },
  {
    "id": "oto-geely",
    "name": "Geely",
    "slug": "oto-geely",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 28
  },
  {
    "id": "kiralik-malzeme",
    "name": "Kiralık Malzeme & Ekipman",
    "slug": "kiralik-malzeme",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 28
  },
  {
    "id": "suv-mg",
    "name": "MG",
    "slug": "suv-mg",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 28
  },
  {
    "id": "moto-qjmotor",
    "name": "Qjmotor",
    "slug": "moto-qjmotor",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 28
  },
  {
    "id": "oto-honda",
    "name": "Honda",
    "slug": "oto-honda",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 29
  },
  {
    "id": "suv-mini",
    "name": "Mini",
    "slug": "suv-mini",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 29
  },
  {
    "id": "moto-rks",
    "name": "Rks",
    "slug": "moto-rks",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 29
  },
  {
    "id": "satilik-egitim",
    "name": "Satılık Eğitim Tesisi",
    "slug": "satilik-egitim",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 29
  },
  {
    "id": "oto-hyundai",
    "name": "Hyundai",
    "slug": "oto-hyundai",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 30
  },
  {
    "id": "kiralik-konut",
    "name": "Kiralık Daire",
    "slug": "kiralik-konut",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 30
  },
  {
    "id": "kiralik-egitim",
    "name": "Kiralık Eğitim Tesisi",
    "slug": "kiralik-egitim",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 30
  },
  {
    "id": "suv-mitsubishi",
    "name": "Mitsubishi",
    "slug": "suv-mitsubishi",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 30
  },
  {
    "id": "moto-royal-enfield",
    "name": "Royal Enfield",
    "slug": "moto-royal-enfield",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 30
  },
  {
    "id": "oto-ikco",
    "name": "Ikco",
    "slug": "oto-ikco",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 31
  },
  {
    "id": "kiralik-residence",
    "name": "Kiralık Residence",
    "slug": "kiralik-residence",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 31
  },
  {
    "id": "suv-nissan",
    "name": "Nissan",
    "slug": "suv-nissan",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 31
  },
  {
    "id": "satilik-saglik",
    "name": "Satılık Sağlık Tesisi",
    "slug": "satilik-saglik",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 31
  },
  {
    "id": "moto-segway",
    "name": "Segway",
    "slug": "moto-segway",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 31
  },
  {
    "id": "oto-infiniti",
    "name": "Infiniti",
    "slug": "oto-infiniti",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 32
  },
  {
    "id": "kiralik-mustakil",
    "name": "Kiralık Müstakil Ev",
    "slug": "kiralik-mustakil",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 32
  },
  {
    "id": "kiralik-saglik",
    "name": "Kiralık Sağlık Tesisi",
    "slug": "kiralik-saglik",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 32
  },
  {
    "id": "suv-omoda",
    "name": "Omoda",
    "slug": "suv-omoda",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 32
  },
  {
    "id": "moto-super-soco",
    "name": "Super Soco",
    "slug": "moto-super-soco",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 32
  },
  {
    "id": "oto-jaguar",
    "name": "Jaguar",
    "slug": "oto-jaguar",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 33
  },
  {
    "id": "kiralik-villa",
    "name": "Kiralık Villa",
    "slug": "kiralik-villa",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 33
  },
  {
    "id": "suv-opel",
    "name": "Opel",
    "slug": "suv-opel",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 33
  },
  {
    "id": "satilik-spor-tesis",
    "name": "Satılık Spor Tesisi",
    "slug": "satilik-spor-tesis",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 33
  },
  {
    "id": "moto-suzuki",
    "name": "Suzuki",
    "slug": "moto-suzuki",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 33
  },
  {
    "id": "oto-jiayuan",
    "name": "Jiayuan",
    "slug": "oto-jiayuan",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 34
  },
  {
    "id": "kiralik-spor-tesis",
    "name": "Kiralık Spor Tesisi",
    "slug": "kiralik-spor-tesis",
    "parent_id": "isyeri",
    "icon": null,
    "sort_order": 34
  },
  {
    "id": "kiralik-yazlik",
    "name": "Kiralık Yazlık",
    "slug": "kiralik-yazlik",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 34
  },
  {
    "id": "suv-peugeot",
    "name": "Peugeot",
    "slug": "suv-peugeot",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 34
  },
  {
    "id": "moto-sym",
    "name": "SYM",
    "slug": "moto-sym",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 34
  },
  {
    "id": "oto-joyce",
    "name": "Joyce",
    "slug": "oto-joyce",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 35
  },
  {
    "id": "kiralik-prefabrik",
    "name": "Kiralık Prefabrik Ev",
    "slug": "kiralik-prefabrik",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 35
  },
  {
    "id": "suv-porsche",
    "name": "Porsche",
    "slug": "suv-porsche",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 35
  },
  {
    "id": "moto-triumph",
    "name": "Triumph",
    "slug": "moto-triumph",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 35
  },
  {
    "id": "oto-kia",
    "name": "Kia",
    "slug": "oto-kia",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 36
  },
  {
    "id": "kiralik-ciftlik",
    "name": "Kiralık Çiftlik Evi",
    "slug": "kiralik-ciftlik",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 36
  },
  {
    "id": "suv-renault",
    "name": "Renault",
    "slug": "suv-renault",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 36
  },
  {
    "id": "moto-tvs",
    "name": "TVS",
    "slug": "moto-tvs",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 36
  },
  {
    "id": "kiralik-yali",
    "name": "Kiralık Yalı",
    "slug": "kiralik-yali",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 37
  },
  {
    "id": "oto-kuba",
    "name": "Kuba",
    "slug": "oto-kuba",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 37
  },
  {
    "id": "suv-seat",
    "name": "Seat",
    "slug": "suv-seat",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 37
  },
  {
    "id": "moto-vespa",
    "name": "Vespa",
    "slug": "moto-vespa",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 37
  },
  {
    "id": "kiralik-kosk",
    "name": "Kiralık Köşk & Konak",
    "slug": "kiralik-kosk",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 38
  },
  {
    "id": "oto-lada",
    "name": "Lada",
    "slug": "oto-lada",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 38
  },
  {
    "id": "suv-skoda",
    "name": "Skoda",
    "slug": "suv-skoda",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 38
  },
  {
    "id": "moto-voge",
    "name": "Voge",
    "slug": "moto-voge",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 38
  },
  {
    "id": "kiralik-koy-evi",
    "name": "Kiralık Köy Evi",
    "slug": "kiralik-koy-evi",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 39
  },
  {
    "id": "oto-lamborghini",
    "name": "Lamborghini",
    "slug": "oto-lamborghini",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 39
  },
  {
    "id": "suv-ssangyong",
    "name": "Ssangyong",
    "slug": "suv-ssangyong",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 39
  },
  {
    "id": "moto-volta",
    "name": "Volta",
    "slug": "moto-volta",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 39
  },
  {
    "id": "kiralik-loft",
    "name": "Kiralık Loft",
    "slug": "kiralik-loft",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 40
  },
  {
    "id": "oto-lancia",
    "name": "Lancia",
    "slug": "oto-lancia",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 40
  },
  {
    "id": "suv-subaru",
    "name": "Subaru",
    "slug": "suv-subaru",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 40
  },
  {
    "id": "moto-yamaha",
    "name": "Yamaha",
    "slug": "moto-yamaha",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 40
  },
  {
    "id": "kiralik-cati-dubleks",
    "name": "Kiralık Çatı Dubleks",
    "slug": "kiralik-cati-dubleks",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 41
  },
  {
    "id": "oto-leapmotor",
    "name": "Leapmotor",
    "slug": "oto-leapmotor",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 41
  },
  {
    "id": "suv-suzuki",
    "name": "Suzuki",
    "slug": "suv-suzuki",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 41
  },
  {
    "id": "moto-yuki",
    "name": "Yuki",
    "slug": "moto-yuki",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 41
  },
  {
    "id": "kiralik-bahce-dubleks",
    "name": "Kiralık Bahçe Dubleks",
    "slug": "kiralik-bahce-dubleks",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 42
  },
  {
    "id": "oto-lexus",
    "name": "Lexus",
    "slug": "oto-lexus",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 42
  },
  {
    "id": "suv-tesla",
    "name": "Tesla",
    "slug": "suv-tesla",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 42
  },
  {
    "id": "moto-zero",
    "name": "Zero",
    "slug": "moto-zero",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 42
  },
  {
    "id": "kiralik-tripleks",
    "name": "Kiralık Tripleks",
    "slug": "kiralik-tripleks",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 43
  },
  {
    "id": "oto-lincoln",
    "name": "Lincoln",
    "slug": "oto-lincoln",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 43
  },
  {
    "id": "suv-togg",
    "name": "Togg",
    "slug": "suv-togg",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 43
  },
  {
    "id": "moto-zontes",
    "name": "Zontes",
    "slug": "moto-zontes",
    "parent_id": "moto",
    "icon": null,
    "sort_order": 43
  },
  {
    "id": "oto-lotus",
    "name": "Lotus",
    "slug": "oto-lotus",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 44
  },
  {
    "id": "suv-toyota",
    "name": "Toyota",
    "slug": "suv-toyota",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 44
  },
  {
    "id": "gunluk-kiralik",
    "name": "Turistik Günlük Kiralık",
    "slug": "gunluk-kiralik",
    "parent_id": "konut",
    "icon": null,
    "sort_order": 44
  },
  {
    "id": "oto-luqi",
    "name": "Luqi",
    "slug": "oto-luqi",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 45
  },
  {
    "id": "suv-vw",
    "name": "Volkswagen",
    "slug": "suv-vw",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 45
  },
  {
    "id": "oto-marcos",
    "name": "Marcos",
    "slug": "oto-marcos",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 46
  },
  {
    "id": "suv-volvo",
    "name": "Volvo",
    "slug": "suv-volvo",
    "parent_id": "arazi-suv",
    "icon": null,
    "sort_order": 46
  },
  {
    "id": "oto-maserati",
    "name": "Maserati",
    "slug": "oto-maserati",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 47
  },
  {
    "id": "oto-mazda",
    "name": "Mazda",
    "slug": "oto-mazda",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 48
  },
  {
    "id": "oto-mclaren",
    "name": "McLaren",
    "slug": "oto-mclaren",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 49
  },
  {
    "id": "oto-mercedes",
    "name": "Mercedes-Benz",
    "slug": "oto-mercedes",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 50
  },
  {
    "id": "oto-mg",
    "name": "MG",
    "slug": "oto-mg",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 51
  },
  {
    "id": "oto-micro",
    "name": "Micro",
    "slug": "oto-micro",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 52
  },
  {
    "id": "oto-mini",
    "name": "Mini",
    "slug": "oto-mini",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 53
  },
  {
    "id": "oto-mitsubishi",
    "name": "Mitsubishi",
    "slug": "oto-mitsubishi",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 54
  },
  {
    "id": "oto-morgan",
    "name": "Morgan",
    "slug": "oto-morgan",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 55
  },
  {
    "id": "oto-motolux",
    "name": "Motolux",
    "slug": "oto-motolux",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 56
  },
  {
    "id": "oto-nieve",
    "name": "Nieve",
    "slug": "oto-nieve",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 57
  },
  {
    "id": "oto-nissan",
    "name": "Nissan",
    "slug": "oto-nissan",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 58
  },
  {
    "id": "oto-opel",
    "name": "Opel",
    "slug": "oto-opel",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 59
  },
  {
    "id": "oto-ortimobil",
    "name": "Ortimobil",
    "slug": "oto-ortimobil",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 60
  },
  {
    "id": "oto-peugeot",
    "name": "Peugeot",
    "slug": "oto-peugeot",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 61
  },
  {
    "id": "oto-plymouth",
    "name": "Plymouth",
    "slug": "oto-plymouth",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 62
  },
  {
    "id": "oto-polestar",
    "name": "Polestar",
    "slug": "oto-polestar",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 63
  },
  {
    "id": "oto-pontiac",
    "name": "Pontiac",
    "slug": "oto-pontiac",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 64
  },
  {
    "id": "oto-porsche",
    "name": "Porsche",
    "slug": "oto-porsche",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 65
  },
  {
    "id": "oto-proton",
    "name": "Proton",
    "slug": "oto-proton",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 66
  },
  {
    "id": "oto-rainwoll",
    "name": "Rainwoll",
    "slug": "oto-rainwoll",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 67
  },
  {
    "id": "oto-reeder",
    "name": "Reeder",
    "slug": "oto-reeder",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 68
  },
  {
    "id": "oto-regal-raptor",
    "name": "Regal Raptor",
    "slug": "oto-regal-raptor",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 69
  },
  {
    "id": "oto-relive",
    "name": "Relive",
    "slug": "oto-relive",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 70
  },
  {
    "id": "oto-renault",
    "name": "Renault",
    "slug": "oto-renault",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 71
  },
  {
    "id": "oto-rks",
    "name": "RKS",
    "slug": "oto-rks",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 72
  },
  {
    "id": "oto-roewe",
    "name": "Roewe",
    "slug": "oto-roewe",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 73
  },
  {
    "id": "oto-rolls-royce",
    "name": "Rolls-Royce",
    "slug": "oto-rolls-royce",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 74
  },
  {
    "id": "oto-rover",
    "name": "Rover",
    "slug": "oto-rover",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 75
  },
  {
    "id": "oto-saab",
    "name": "Saab",
    "slug": "oto-saab",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 76
  },
  {
    "id": "oto-saipa",
    "name": "Saipa",
    "slug": "oto-saipa",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 77
  },
  {
    "id": "oto-seat",
    "name": "Seat",
    "slug": "oto-seat",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 78
  },
  {
    "id": "oto-skoda",
    "name": "Skoda",
    "slug": "oto-skoda",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 79
  },
  {
    "id": "oto-smart",
    "name": "Smart",
    "slug": "oto-smart",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 80
  },
  {
    "id": "oto-subaru",
    "name": "Subaru",
    "slug": "oto-subaru",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 81
  },
  {
    "id": "oto-suzuki",
    "name": "Suzuki",
    "slug": "oto-suzuki",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 82
  },
  {
    "id": "oto-tata",
    "name": "Tata",
    "slug": "oto-tata",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 83
  },
  {
    "id": "oto-tesla",
    "name": "Tesla",
    "slug": "oto-tesla",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 84
  },
  {
    "id": "oto-london-taxi",
    "name": "The London Taxi",
    "slug": "oto-london-taxi",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 85
  },
  {
    "id": "oto-tofas",
    "name": "Tofaş",
    "slug": "oto-tofas",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 86
  },
  {
    "id": "oto-togg",
    "name": "Togg",
    "slug": "oto-togg",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 87
  },
  {
    "id": "oto-toyota",
    "name": "Toyota",
    "slug": "oto-toyota",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 88
  },
  {
    "id": "oto-vanderhall",
    "name": "Vanderhall",
    "slug": "oto-vanderhall",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 89
  },
  {
    "id": "oto-vw",
    "name": "Volkswagen",
    "slug": "oto-vw",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 90
  },
  {
    "id": "oto-volta",
    "name": "Volta",
    "slug": "oto-volta",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 91
  },
  {
    "id": "oto-volvo",
    "name": "Volvo",
    "slug": "oto-volvo",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 92
  },
  {
    "id": "oto-xev",
    "name": "XEV",
    "slug": "oto-xev",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 93
  },
  {
    "id": "oto-yuki",
    "name": "Yuki",
    "slug": "oto-yuki",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 94
  },
  {
    "id": "oto-zlin-motors",
    "name": "Zlin Motors",
    "slug": "oto-zlin-motors",
    "parent_id": "otomobil",
    "icon": null,
    "sort_order": 95
  }
];
