/**
 * Generates migrations/0012_series_groups.sql — series folders + trims
 * category tree, current TR market brand/model lists, and listing attributes.
 * Run: node scripts/generate-catalog.mjs
 */
import { writeFileSync } from "node:fs";
import { CARS, SUVS, MOTOS, MINIVANS, TRUCKS, PICKUPS_LIGHT } from "./vehicle-models.mjs";


function slugify(input) {
  return String(input)
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\+/g, "-plus-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function sql(s) {
  return String(s).replace(/'/g, "''");
}

const ID_ALIAS = {
  "suv-bmw-x5": "oto-bmw-X5",
  "suv-honda-cr-v": "oto-honda-cr-v",
  "suv-toyota-c-hr": "oto-toyota-c-hr",
  "moto-yamaha-mt-07": "moto-yamaha-mt07",
};

function bslug(brand) {
  const s = slugify(brand);
  if (s === "volkswagen") return "vw";
  if (s === "mercedes-benz") return "mercedes";
  if (s === "ds-automobiles") return "ds";
  if (s === "the-london-taxi") return "london-taxi";
  if (s === "kgm-ssangyong") return "kgm";
  return s;
}

function brandId(prefix, brand) {
  return `${prefix}-${bslug(brand)}`;
}

function modelId(prefix, brand, model) {
  const raw = `${prefix}-${bslug(brand)}-${slugify(model)}`;
  return ID_ALIAS[raw] ?? raw;
}

function cid(...parts) {
  const raw = parts.map((p) => slugify(p)).filter(Boolean).join("-");
  return ID_ALIAS[raw] ?? raw;
}

const cats = [];
const seen = new Set();

function addCat(id, name, parent, icon = null, sort = 0, slug = null) {
  if (seen.has(id)) {
    const prev = cats.find((c) => c.id === id);
    if (prev) {
      prev.name = name;
      prev.parent = parent;
      if (icon) prev.icon = icon;
      prev.sort = sort;
    }
    return id;
  }
  seen.add(id);
  cats.push({ id, name, slug: slug ?? id, parent, icon, sort });
  return id;
}

function addChildren(parentId, names, sortStart = 1, prefix = null) {
  names.forEach((n, i) => addCat(cid(prefix ?? parentId, n), n, parentId, null, sortStart + i));
}

function brands(parentId, prefix, list) {
  const names = Object.keys(list).sort((a, b) => a.localeCompare(b, "tr"));
  names.forEach((brand, i) => {
    const bid = brandId(prefix, brand);
    addCat(bid, brand, parentId, null, i);
    addModelTree(bid, list[brand], bid);
  });
}

function hasKids(children) {
  if (!children) return false;
  if (Array.isArray(children)) return children.length > 0;
  return Object.keys(children).filter((k) => k !== "__wrap").length > 0;
}

function isWrap(spec) {
  return Boolean(spec && typeof spec === "object" && !Array.isArray(spec) && spec.__wrap === true);
}

function unwrap(spec) {
  if (!isWrap(spec)) return spec;
  const { __wrap: _w, ...rest } = spec;
  return rest;
}

function normalizeEntries(spec) {
  if (spec == null) return [];
  const raw = unwrap(spec);
  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === "string" ? [item, null] : [item[0], item[1]]));
  }
  return Object.entries(raw).filter(([k]) => k !== "__wrap");
}

const wrapFolders = new Set();

function addModelTree(parentId, spec, brandRoot = parentId) {
  const entries = normalizeEntries(spec);
  if (!entries.some(([n]) => slugify(n) === "diger")) entries.push(["Diğer", null]);
  entries.forEach(([name, children], j) => {
    const nested = `${parentId}-${slugify(name)}`;
    let id = ID_ALIAS[nested] ?? nested;
    if (wrapFolders.has(parentId)) {
      const short = `${brandRoot}-${slugify(name)}`;
      id = ID_ALIAS[nested] ?? ID_ALIAS[short] ?? short;
    }
    if (!seen.has(id)) addCat(id, name, parentId, null, j);
    else addCat(id, name, parentId, null, j);
    if (isWrap(children)) wrapFolders.add(id);
    if (hasKids(children)) addModelTree(id, unwrap(children), brandRoot);
  });
}

/* ---------------- 10 ana kategori ---------------- */
addCat("emlak", "Emlak", null, "home", 1);
addCat("vasita", "Vasıta", null, "car", 2);
addCat("alisveris", "İkinci El ve Sıfır Alışveriş", null, "bag", 3);
addCat("yedek-parca", "Yedek Parça, Aksesuar, Donanım & Tuning", null, "cog", 4);
addCat("sanayi", "İş Makineleri & Sanayi", null, "tractor", 5);
addCat("hizmetler", "Ustalar ve Hizmetler", null, "wrench", 6);
addCat("ozel-ders", "Özel Ders Verenler", null, "grad", 7);
addCat("is-ilanlari", "İş İlanları", null, "briefcase", 8);
addCat("yardimci", "Yardımcı Arayanlar", null, "users", 9);
addCat("hayvanlar", "Hayvanlar Alemi", null, "paw", 10, "hayvanlar-alemi");

/* ---------------- Emlak ---------------- */
addCat("konut", "Konut", "emlak", null, 1);
[
  ["satilik-konut", "Satılık Daire"],
  ["satilik-residence", "Satılık Residence"],
  ["satilik-mustakil", "Satılık Müstakil Ev"],
  ["satilik-villa", "Satılık Villa"],
  ["satilik-kooperatif", "Satılık Kooperatif"],
  ["satilik-yazlik", "Satılık Yazlık"],
  ["satilik-prefabrik", "Satılık Prefabrik Ev"],
  ["satilik-ciftlik", "Satılık Çiftlik Evi"],
  ["satilik-yali", "Satılık Yalı"],
  ["satilik-kosk", "Satılık Köşk & Konak"],
  ["satilik-yali-daire", "Satılık Yalı Dairesi"],
  ["satilik-koy-evi", "Satılık Köy Evi"],
  ["satilik-loft", "Satılık Loft"],
  ["satilik-cati-dubleks", "Satılık Çatı Dubleks"],
  ["satilik-bahce-dubleks", "Satılık Bahçe Dubleks"],
  ["satilik-tripleks", "Satılık Tripleks"],
  ["satilik-tiny-house", "Satılık Tiny House"],
].forEach(([id, name], i) => addCat(id, name, "konut", null, i + 1));
[
  ["kiralik-konut", "Kiralık Daire"],
  ["kiralik-residence", "Kiralık Residence"],
  ["kiralik-mustakil", "Kiralık Müstakil Ev"],
  ["kiralik-villa", "Kiralık Villa"],
  ["kiralik-yazlik", "Kiralık Yazlık"],
  ["kiralik-prefabrik", "Kiralık Prefabrik Ev"],
  ["kiralik-ciftlik", "Kiralık Çiftlik Evi"],
  ["kiralik-yali", "Kiralık Yalı"],
  ["kiralik-kosk", "Kiralık Köşk & Konak"],
  ["kiralik-koy-evi", "Kiralık Köy Evi"],
  ["kiralik-loft", "Kiralık Loft"],
  ["kiralik-cati-dubleks", "Kiralık Çatı Dubleks"],
  ["kiralik-bahce-dubleks", "Kiralık Bahçe Dubleks"],
  ["kiralik-tripleks", "Kiralık Tripleks"],
  ["gunluk-kiralik", "Turistik Günlük Kiralık"],
].forEach(([id, name], i) => addCat(id, name, "konut", null, 30 + i));

addCat("isyeri", "İşyeri", "emlak", null, 2);
[
  ["kiralik-isyeri", "Kiralık İşyeri"],
  ["satilik-isyeri", "Satılık İşyeri"],
  ["satilik-ofis", "Satılık Ofis"],
  ["kiralik-ofis", "Kiralık Ofis"],
  ["satilik-plaza", "Satılık Plaza / Plaza Katı"],
  ["kiralik-plaza", "Kiralık Plaza / Plaza Katı"],
  ["satilik-dukkan", "Satılık Dükkan & Mağaza"],
  ["kiralik-dukkan", "Kiralık Dükkan & Mağaza"],
  ["satilik-depo", "Satılık Depo & Antrepo"],
  ["kiralik-depo", "Kiralık Depo & Antrepo"],
  ["satilik-fabrika", "Satılık Fabrika & Üretim Tesisi"],
  ["kiralik-fabrika", "Kiralık Fabrika & Üretim Tesisi"],
  ["satilik-atolye", "Satılık Atölye"],
  ["kiralik-atolye", "Kiralık Atölye"],
  ["satilik-buro", "Satılık Büro"],
  ["kiralik-buro", "Kiralık Büro"],
  ["satilik-avm", "Satılık AVM & İş Hanı"],
  ["kiralik-avm", "Kiralık AVM & İş Hanı"],
  ["satilik-kafe", "Satılık Café & Restoran"],
  ["kiralik-kafe", "Kiralık Café & Restoran"],
  ["satilik-otel", "Satılık Otel"],
  ["kiralik-otel", "Kiralık Otel"],
  ["satilik-otopark-is", "Satılık Otopark"],
  ["kiralik-otopark-is", "Kiralık Otopark"],
  ["satilik-benzinlik", "Satılık Benzinlik"],
  ["kiralik-benzinlik", "Kiralık Benzinlik"],
  ["satilik-malzeme", "Satılık Malzeme & Ekipman"],
  ["kiralik-malzeme", "Kiralık Malzeme & Ekipman"],
  ["satilik-egitim", "Satılık Eğitim Tesisi"],
  ["kiralik-egitim", "Kiralık Eğitim Tesisi"],
  ["satilik-saglik", "Satılık Sağlık Tesisi"],
  ["kiralik-saglik", "Kiralık Sağlık Tesisi"],
  ["satilik-spor-tesis", "Satılık Spor Tesisi"],
  ["kiralik-spor-tesis", "Kiralık Spor Tesisi"],
].forEach(([id, name], i) => addCat(id, name, "isyeri", null, i + 1));

addCat("arsa", "Arsa", "emlak", null, 3);
[
  ["arsa-imarli-konut", "İmarlı Konut Arsası"],
  ["arsa-imarli-ticari", "İmarlı Ticari Arsa"],
  ["arsa-tarla", "Tarla"],
  ["arsa-bahce", "Bahçe"],
  ["arsa-bag", "Bağ"],
  ["arsa-zeytinlik", "Zeytinlik"],
  ["arsa-ifrazli", "İfrazlı Parsel"],
  ["arsa-kosk-arsasi", "Köşk Arsası"],
  ["arsa-villa-arsasi", "Villa Arsası"],
  ["arsa-sanayi", "Sanayi Arsası"],
  ["arsa-turizm", "Turizm Arsası"],
  ["arsa-sera", "Sera"],
  ["arsa-ciftlik", "Çiftlik"],
  ["arsa-diger", "Diğer Arsa"],
].forEach(([id, name], i) => addCat(id, name, "arsa", null, i + 1));

addCat("bina", "Bina", "emlak", null, 4);
addChildren("bina", ["Satılık Bina", "Kiralık Bina", "Satılık Apartman", "Kiralık Apartman", "Satılık İş Hanı", "Kiralık İş Hanı"]);

addCat("devre-mulk", "Devre Mülk", "emlak", null, 5);
addChildren("devre-mulk", ["Satılık Devre Mülk", "Kiralık Devre Mülk"], 1, "devre");

addCat("turistik", "Turistik Tesis", "emlak", null, 6);
addChildren("turistik", ["Otel", "Apart Otel", "Pansiyon", "Tatil Köyü", "Kamp & Karavan Yeri", "Butik Otel", "Motel", "Hostel", "Diğer Tesis"]);

addCat("devren", "Devren Satılık / Kiralık", "emlak", null, 7);
addChildren("devren", ["Devren Satılık İşyeri", "Devren Kiralık İşyeri", "Devren Satılık Fabrika", "Devren Satılık Café & Restoran"]);

/* ---------------- Vasıta ---------------- */
addCat("otomobil", "Otomobil", "vasita", null, 1);
addCat("arazi-suv", "Arazi, SUV & Pickup", "vasita", null, 2);
addCat("moto", "Motosiklet", "vasita", null, 3, "motosiklet");
addCat("minivan", "Minivan & Panelvan", "vasita", null, 4);
addCat("ticari", "Ticari Araçlar", "vasita", null, 5);
addCat("kiralik-arac", "Kiralık Araçlar", "vasita", null, 6);
addCat("deniz", "Deniz Araçları", "vasita", null, 7);
addCat("karavan", "Karavan", "vasita", null, 8);
addCat("hasarli", "Hasarlı Araçlar", "vasita", null, 9);
addCat("klasik", "Klasik Araçlar", "vasita", null, 10);
addCat("atv", "ATV / UTV", "vasita", null, 11);
addCat("engelli-plaka", "Engelli Plakalı Araçlar", "vasita", null, 12);
addCat("hava", "Hava Araçları", "vasita", null, 13);
addCat("elektrikli-bisiklet", "Elektrikli Bisiklet", "vasita", null, 14);

brands("otomobil", "oto", CARS);
brands("arazi-suv", "suv", SUVS);
brands("moto", "moto", MOTOS);

brands("minivan", "van", MINIVANS);

addCat("ticari-kamyonet", "Kamyonet", "ticari", null, 1);
addCat("ticari-kamyon", "Kamyon", "ticari", null, 2);
addCat("ticari-cekici", "Çekici", "ticari", null, 3);
addCat("ticari-minibus", "Minibüs", "ticari", null, 4);
addCat("ticari-otobus", "Otobüs", "ticari", null, 5);

brands("ticari-kamyon", "kamyon", TRUCKS);

brands("ticari-kamyonet", "kamyonet", PICKUPS_LIGHT);

addChildren("ticari-cekici", ["Mercedes Actros", "Volvo FH", "Scania S", "MAN TGX", "DAF XF", "Ford F-Max", "Iveco S-Way", "Renault T"]);
addChildren("ticari-minibus", ["Mercedes Sprinter", "Ford Transit", "Volkswagen Crafter", "Peugeot Boxer", "Fiat Ducato", "Iveco Daily", "Renault Master"]);
addChildren("ticari-otobus", ["Mercedes", "MAN", "Temsa", "Otokar", "Karsan", "BMC", "Volvo", "Setra", "Isuzu"]);

addChildren("deniz", ["Yat", "Hız Teknesi", "Yelkenli", "Jet Ski", "Şişme Bot", "Balıkçı Teknesi", "Katamaran", "Gulet", "Sürat Teknesi", "Motor Yat", "Kotra", "Römorkör", "Sandal"]);
addChildren("karavan", ["Motokaravan", "Çekme Karavan", "Tiny House", "Pino Karavan", "Müstakil Karavan", "Alkoven", "Entegre"]);
addChildren("atv", ["ATV", "UTV", "Quad", "SSV"]);
addChildren("hava", ["Helikopter", "Uçak", "Ultralight", "Planör", "Drone (Ticari)", "Balon"]);
addChildren("elektrikli-bisiklet", ["Şehir", "Dağ", "Katlanır", "Scooter (Elektrikli)", "Kargo Bisiklet"]);
addChildren("kiralik-arac", ["Otomobil", "SUV", "Minivan", "Motosiklet", "Ticari", "Karavan", "Deniz Aracı", "Lüks & Düğün"]);
addChildren("hasarli", ["Otomobil", "SUV", "Minivan", "Motosiklet", "Ticari"]);
addChildren("klasik", ["Otomobil", "Motosiklet", "Ticari"]);
addChildren("engelli-plaka", ["Otomobil", "SUV", "Minivan"], 1, "engelli");

/* ---------------- İş makineleri & sanayi (kök) ---------------- */
addCat("is-makineleri", "İş Makineleri", "sanayi", null, 1);
addChildren("is-makineleri", [
  "Ekskavatör", "Mini Ekskavatör", "Loader", "Bekçi Dozer", "Greyder", "Silindir", "Forklift", "Manlift",
  "Telehandler", "Kepçe", "Traktör", "Beton Pompası", "Asfalt Makinesi", "Kazıcı Yükleyici", "Kule Vinç", "Mobil Vinç",
], 1, "ismak");
addCat("tarim", "Tarım Makineleri", "sanayi", null, 2);
addChildren("tarim", ["Traktör", "Biçerdöver", "Pulluk", "Mibzer", "Pülverizatör", "Balya Makinesi", "Römork", "Süt Sağım", "Sulama"]);
addCat("sanayi-makine", "Sanayi & Endüstri", "sanayi", null, 3);
addChildren("sanayi-makine", [
  "CNC & Takım Tezgahı", "Paketleme", "Gıda İşleme", "Tekstil", "Ahşap", "Plastik Enjeksiyon", "Kaynak",
  "Kompresör", "Jeneratör", "Konteyner & Kabin", "Raf & Teşhir", "Endüstriyel Mutfak", "Temizlik Makinesi",
  "Güneş Paneli", "Akaryakıt Ekipmanı",
]);
addCat("ismak-kiralik", "Kiralık İş Makinesi", "sanayi", null, 4);
addChildren("ismak-kiralik", ["Ekskavatör", "Forklift", "Vinç", "Manlift", "Jeneratör", "Kompresör"]);
addCat("ismak-parca", "Parça & Ataşman", "sanayi", null, 5);

/* ---------------- Alışveriş ---------------- */
addCat("telefon", "Cep Telefonu", "alisveris", null, 1, "cep-telefonu");
const PHONES = {
  Apple: [
    "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Air", "iPhone 17", "iPhone 16e",
    "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
    "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
    "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini",
    "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
    "iPhone SE (2022)", "iPhone SE (2020)",
    "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
    "iPhone 8 Plus", "iPhone 8", "iPhone 7 Plus", "iPhone 7", "iPhone 6s", "iPhone 6",
  ],
  Samsung: [
    "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25", "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24",
    "Galaxy S23 Ultra", "Galaxy S23", "Galaxy S22 Ultra", "Galaxy S21 Ultra", "Galaxy S21",
    "Galaxy Z Fold 7", "Galaxy Z Fold 6", "Galaxy Z Fold 5", "Galaxy Z Flip 7", "Galaxy Z Flip 6", "Galaxy Z Flip 5",
    "Galaxy A56", "Galaxy A55", "Galaxy A54", "Galaxy A36", "Galaxy A35", "Galaxy A25", "Galaxy A15",
    "Galaxy Note 20 Ultra", "Galaxy Note 10+", "Galaxy M55", "Galaxy M34",
  ],
  Xiaomi: ["15 Ultra", "15", "14 Ultra", "14", "13T Pro", "13T", "13", "Redmi Note 14 Pro", "Redmi Note 13 Pro", "Redmi Note 13", "Redmi Note 12", "Redmi 14", "Poco F7", "Poco X6 Pro", "Poco F6", "Mi 11", "Mi 10"],
  Huawei: ["Pura 70 Ultra", "Pura 70", "Pura 80", "P60 Pro", "P50", "Mate 70", "Mate 60", "Nova 13", "Nova 12", "Nova 11"],
  Oppo: ["Find X8", "Find X7", "Reno 13", "Reno 12", "Reno 11", "A80", "A79", "A60", "A38"],
  Realme: ["GT 7", "GT 6", "14 Pro+", "12 Pro+", "12 Pro", "C75", "C67", "Note 50"],
  Honor: ["Magic 7 Pro", "Magic 6 Pro", "400 Pro", "200 Pro", "200", "90", "X9c", "X9b"],
  Google: ["Pixel 9 Pro", "Pixel 9", "Pixel 8 Pro", "Pixel 8", "Pixel 7a", "Pixel 7", "Pixel 6"],
  OnePlus: ["13", "13R", "12", "11", "Nord 4", "Nord CE 4"],
  Nothing: ["Phone (3)", "Phone (2a)", "Phone (2)", "Phone (1)"],
  Tecno: ["Camon 30", "Spark 20", "Pova 6", "Phantom V"],
  Infinix: ["Note 40", "Hot 40", "Zero 30", "GT 20"],
  Motorola: ["Edge 50", "Razr 50", "G84", "G85"],
  Nokia: ["G42", "XR21", "3210", "G22"],
  Sony: ["Xperia 1 VI", "Xperia 5 V", "Xperia 10 VI"],
  Casper: ["VIA X30", "VIA M30"],
  "General Mobile": ["GM 24", "GM 23", "GM 22"],
  Reeder: ["S19 Max", "P13 Blue", "S23"],
  Vestel: ["Venus V6", "Venus Z20"],
  Omix: ["X600", "X500"],
};
addCat("tel-apple", "Apple", "telefon", null, 0);
addCat("tel-samsung", "Samsung", "telefon", null, 1);
addCat("tel-xiaomi", "Xiaomi", "telefon", null, 2);
brands("telefon", "tel", PHONES);

addCat("akilli-saat", "Akıllı Saat", "alisveris", null, 2);
addChildren("akilli-saat", ["Apple Watch", "Samsung Galaxy Watch", "Xiaomi / Redmi Watch", "Huawei Watch", "Garmin", "Amazfit", "Diğer"]);

addCat("bilgisayar", "Bilgisayar", "alisveris", null, 3);
addCat("laptop", "Dizüstü", "bilgisayar", null, 0, "dizustu-laptop");
addChildren("bilgisayar", ["Masaüstü", "Monitör", "Tablet", "Yazıcı & Tarayıcı", "Parça & Aksesuar", "Ağ & Modem", "Oyun Bilgisayarı", "Sunucu", "Veri Depolama"]);
addChildren("laptop", ["MacBook Air", "MacBook Pro", "Windows Dizüstü", "Oyun Laptop", "Chromebook", "2'si 1 Arada"]);

addCat("oyun-konsol", "Oyun & Konsol", "alisveris", null, 4);
addChildren("oyun-konsol", ["PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "Nintendo Switch 2", "Steam Deck", "Oyun", "Kol & Aksesuar", "Retro Konsol", "VR"]);

addCat("foto-kamera", "Fotoğraf & Kamera", "alisveris", null, 5);
addChildren("foto-kamera", ["DSLR", "Mirrorless", "Kompakt", "Aksiyon Kamera", "Drone", "Lens", "Tripod & Stabilizer", "Aydınlatma", "Hafıza Kartı"]);

addCat("ev-elektronigi", "Ev Elektroniği", "alisveris", null, 6);
addChildren("ev-elektronigi", ["TV", "Ses Sistemi", "Kulaklık", "Projeksiyon", "Uydu & Receiver", "Media Player", "Hoparlör"]);

addCat("beyaz-esya", "Beyaz Eşya & Elektrikli Ev Aletleri", "alisveris", null, 7);
addChildren("beyaz-esya", [
  "Buzdolabı", "Çamaşır Makinesi", "Bulaşık Makinesi", "Fırın", "Ocak", "Davlumbaz", "Klima", "Süpürge",
  "Mikrodalga", "Kurutma Makinesi", "Ütü", "Kahve Makinesi", "Çay Makinesi", "Blender & Mikser", "Isıtıcı", "Su Sebili",
]);

addCat("mobilya", "Mobilya", "alisveris", null, 8);
addChildren("mobilya", [
  "Koltuk Takımı", "Köşe Koltuk", "Yatak Odası", "Yemek Odası", "Çalışma Masası", "Dolap", "Gardırop",
  "TV Ünitesi", "Bahçe Mobilyası", "Yatak & Baza", "Kitaplık", "Sehpa", "Ayna", "Avize & Aydınlatma", "Halı & Kilim",
]);

addCat("giyim", "Giyim & Aksesuar", "alisveris", null, 9);
addChildren("giyim", ["Kadın Giyim", "Erkek Giyim", "Çocuk Giyim", "Ayakkabı", "Çanta", "Takı", "Gözlük", "Şapka & Bere", "İç Giyim"]);

addCat("saat", "Saat", "alisveris", null, 10);
addChildren("saat", ["Kol Saati", "Duvar Saati", "Cep Saati", "Lüks Saat"]);

addCat("anne-bebek", "Anne & Bebek", "alisveris", null, 11);
addChildren("anne-bebek", ["Bebek Arabası", "Oto Koltuğu", "Beşik", "Mama Sandalyesi", "Oyuncak", "Giyim", "Banyo", "Emzirme"]);

addCat("kisisel-bakim", "Kişisel Bakım & Kozmetik", "alisveris", null, 12);
addChildren("kisisel-bakim", ["Parfüm", "Makyaj", "Cilt Bakımı", "Saç", "Tıraş", "Ağız Bakımı"]);

addCat("hobi", "Hobi & Oyuncak", "alisveris", null, 13);
addChildren("hobi", ["Oyuncak", "Model & Maket", "Puzzle", "RC Araç", "Drone (Hobi)", "Oyun Konsolu Aksesuar"]);

addCat("koleksiyon", "Koleksiyon", "alisveris", null, 14);
addChildren("koleksiyon", ["Antika", "Pul", "Para", "Kart", "Figür", "Plak", "Sanat Eseri"]);

addCat("muzik", "Müzik", "alisveris", null, 15);
addChildren("muzik", ["Gitar", "Piyano & Klavye", "Davul & Perküsyon", "Yaylı", "Nefesli", "DJ & Prodüksiyon", "Amfi", "Plakçalar"]);

addCat("kitap", "Kitap, Dergi, Film", "alisveris", null, 16);
addChildren("kitap", ["Kitap", "Dergi", "DVD & Blu-ray", "Ders Kitabı", "Çizgi Roman"]);

addCat("ofis", "Ofis & Kırtasiye", "alisveris", null, 17);
addChildren("ofis", ["Ofis Mobilyası", "Kırtasiye", "Projeksiyon", "Yazıcı Sarf", "Kasa"]);

addCat("spor", "Spor", "alisveris", null, 18);
addChildren("spor", ["Fitness", "Bisiklet", "Kamp & Doğa", "Su Sporları", "Kış Sporları", "Futbol", "Basketbol", "Tenis", "Boks & Dövüş", "Yoga"]);

addCat("bahce", "Bahçe & Yapı Market", "alisveris", null, 19);
addChildren("bahce", ["Bahçe Aletleri", "Çim Biçme", "Sulama", "Mangal & Barbekü", "Çadır & Tente", "Hırdavat", "Boya", "Elektrik Malzeme", "Tesisat"]);

/* ---------------- Yedek parça ---------------- */
addCat("yp-oto", "Otomotiv Ekipmanları", "yedek-parca", null, 1);
addChildren("yp-oto", ["Yedek Parça", "Aksesuar & Tuning", "Jant & Lastik", "Ses & Görüntü", "Navigasyon", "Aydınlatma", "Kaporta", "Motor", "Fren", "Süspansiyon", "Egzoz", "Elektrik"]);
addCat("yp-moto", "Motosiklet Ekipmanları", "yedek-parca", null, 2);
addChildren("yp-moto", ["Yedek Parça", "Aksesuar & Tuning", "Jant & Lastik", "Kask, Kıyafet & Ekipman", "Elektronik"]);
addCat("yp-deniz", "Deniz Aracı Ekipmanları", "yedek-parca", null, 3);
addChildren("yp-deniz", ["Deniz Motorları", "Boya & Bakım", "Demirleme & Rıhtım", "Dümen & Kumanda", "Elektrik", "Yelken Donanımı", "Yakıt Sistemi"]);
addCat("yp-karavan", "Karavan Ekipmanı", "yedek-parca", null, 4);

/* ---------------- Hizmetler ---------------- */
addCat("tamir", "Tamir, Tadilat & Dekorasyon", "hizmetler", null, 1);
addChildren("tamir", ["Boyacı", "Tesisatçı", "Elektrikçi", "Marangoz", "Alçıpan", "Fayans", "Parke", "Klima Servisi", "Kombi Servisi", "Çilingir", "Camcı", "Çatı"]);
addCat("nakliyat", "Nakliyat", "hizmetler", null, 2);
addChildren("nakliyat", ["Evden Eve", "Şehirlerarası", "Ofis Taşıma", "Parça Eşya", "Depolama"]);
addCat("temizlik-hiz", "Temizlik", "hizmetler", null, 3);
addChildren("temizlik-hiz", ["Ev Temizliği", "Ofis Temizliği", "İnşaat Sonrası", "Koltuk Yıkama", "Cam Temizliği"]);
addCat("guzellik-hiz", "Güzellik & Bakım", "hizmetler", null, 4);
addChildren("guzellik-hiz", ["Kuaför", "Güzellik Salonu", "Masaj", "Tırnak", "Dövmeci"]);
addCat("organizasyon", "Organizasyon & Organizatör", "hizmetler", null, 5);
addChildren("organizasyon", ["Düğün", "Nişan", "Doğum Günü", "Kurumsal", "Fotoğrafçılık", "DJ & Müzik", "Sünnet"]);
["Sağlık", "Çeviri", "Yazılım & Tasarım", "Evcil Hayvan Bakımı", "Oto Yıkama & Detay", "Emlak Danışmanlığı", "Hukuk", "Muhasebe", "Reklam & Baskı", "Güvenlik"].forEach((n, i) =>
  addCat(cid("hizmet", n), n, "hizmetler", null, 20 + i),
);

/* ---------------- Özel ders (kök) ---------------- */
addChildren("ozel-ders", [
  "Matematik", "Fen Bilimleri", "Fizik", "Kimya", "Biyoloji", "Türkçe", "İngilizce", "Almanca", "Fransızca",
  "Yabancı Dil", "Üniversite", "LGS", "YKS", "KPSS", "Müzik", "Spor", "Resim", "Yazılım", "Direksiyon", "Diksiyon",
], 1, "ders");

/* ---------------- İş ---------------- */
addChildren("is-ilanlari", [
  "Bilişim", "Eğitim", "Sağlık", "Satış & Pazarlama", "Muhasebe & Finans", "Mühendislik", "İnşaat",
  "Turizm & Otel", "Lojistik", "Güvenlik", "İnsan Kaynakları", "Üretim", "Restoran & Cafe", "Mağaza",
  "Part-time", "Staj", "Freelance", "Eleman Arıyorum", "İş Arıyorum", "Çağrı Merkezi", "Teknik Servis",
], 1, "is");

/* ---------------- Yardımcı ---------------- */
addChildren("yardimci", ["Bebek Bakıcısı", "Çocuk Bakıcısı", "Yaşlı Bakımı", "Hasta Bakımı", "Temizlikçi", "Aşçı", "Şoför", "Bahçıvan", "Güvenlik", "Dadı", "Evde Destek"]);

/* ---------------- Hayvanlar ---------------- */
addCat("kedi", "Kedi", "hayvanlar", null, 1);
addChildren("kedi", [
  "British Shorthair", "Scottish Fold", "İran", "Tekir", "Siyam", "Maine Coon", "Sphynx", "Ankara Kedisi",
  "Van Kedisi", "Bengal", "Ragdoll", "Sibirya", "British Longhair", "Scottish Straight", "Sarman", "Diğer Kedi",
]);
addCat("kopek", "Köpek", "hayvanlar", null, 2);
addChildren("kopek", [
  "Golden Retriever", "Labrador", "German Shepherd", "Kangal", "Husky", "Poodle", "Bulldog", "Terrier",
  "Rottweiler", "Cane Corso", "Doberman", "Malinois", "Chihuahua", "Pomeranian", "Shih Tzu", "Boxer",
  "Akita", "Samoyed", "Border Collie", "Diğer Köpek",
]);
addCat("hayvan-kus", "Kuş", "hayvanlar", null, 3);
addChildren("hayvan-kus", ["Muhabbet", "Sultan", "Papağan", "Kanarya", "Finch", "Güvercin", "Tavus", "Diğer"]);
addCat("hayvan-balik", "Akvaryum & Balık", "hayvanlar", null, 4);
addChildren("hayvan-balik", ["Tatlı Su", "Tuzlu Su", "Akvaryum Seti", "Ekipman"]);
addChildren("hayvanlar", ["Kemirgen", "Sürüngen", "Büyükbaş", "Küçükbaş", "Kümes", "At", "Aksesuar & Mama", "Yem"], 10, "hayvan");

/* ---------------- Attributes ---------------- */
const evetHayir = ["Evet", "Hayır"];
const attrs = [
  { id: "oda", name: "Oda Sayısı", type: "SELECT", options: ["Stüdyo", "1+0", "1+1", "2+0", "2+1", "3+1", "3+2", "4+1", "4+2", "5+1", "5+2", "6+1", "7+1", "8+1", "10+"], unit: null },
  { id: "m2", name: "m² (Net)", type: "NUMBER", options: null, unit: "m²" },
  { id: "m2_brut", name: "m² (Brüt)", type: "NUMBER", options: null, unit: "m²" },
  { id: "bina_yasi", name: "Bina Yaşı", type: "SELECT", options: ["0 (Sıfır)", "1", "2", "3", "4", "5", "6-10", "11-15", "16-20", "21-25", "26-30", "31-40", "41+"], unit: null },
  { id: "kat", name: "Bulunduğu Kat", type: "SELECT", options: ["Bodrum", "Zemin", "Bahçe Katı", "Giriş Katı", "Yüksek Giriş", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11-15", "16-20", "21+", "Çatı", "Çatı Dubleks", "Villa Katı"], unit: null },
  { id: "kat_sayisi", name: "Binadaki Kat Sayısı", type: "NUMBER", options: null, unit: null },
  { id: "isitma", name: "Isıtma", type: "SELECT", options: ["Yok", "Soba", "Doğalgaz Sobası", "Kat Kaloriferi", "Kombi (Doğalgaz)", "Kombi (Elektrik)", "Merkezi", "Merkezi (Pay Ölçer)", "Yerden Isıtma", "Klima", "Fancoil", "Jeotermal", "Güneş Enerjisi", "Şömine", "VRV"], unit: null },
  { id: "banyo", name: "Banyo Sayısı", type: "SELECT", options: ["Yok", "1", "2", "3", "4+"], unit: null },
  { id: "wc", name: "WC Sayısı", type: "SELECT", options: ["Yok", "1", "2", "3+"], unit: null },
  { id: "mutfak", name: "Mutfak", type: "SELECT", options: ["Açık", "Kapalı", "Amerikan"], unit: null },
  { id: "balkon", name: "Balkon", type: "SELECT", options: ["Yok", "1", "2", "3+"], unit: null },
  { id: "asansor", name: "Asansör", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "otopark", name: "Otopark", type: "SELECT", options: ["Yok", "Açık", "Kapalı", "Açık & Kapalı"], unit: null },
  { id: "esyali", name: "Eşyalı", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "kullanim", name: "Kullanım Durumu", type: "SELECT", options: ["Boş", "Kiracılı", "Mülk Sahibi Oturuyor"], unit: null },
  { id: "site", name: "Site İçerisinde", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "aidat", name: "Aidat", type: "NUMBER", options: null, unit: "TL" },
  { id: "kredi", name: "Krediye Uygun", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "tapu", name: "Tapu Durumu", type: "SELECT", options: ["Kat Mülkiyeti", "Kat İrtifakı", "Arsa Tapulu", "Tahsis", "Hisseli Tapu", "Yabancıya Tapu Satışa Uygun"], unit: null },
  { id: "kimden_emlak", name: "Kimden", type: "SELECT", options: ["Sahibinden", "Emlak Ofisinden", "İnşaattan", "Bankadan"], unit: null },
  { id: "takas", name: "Takas", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "cephe", name: "Cephe", type: "MULTI", options: ["Kuzey", "Güney", "Doğu", "Batı"], unit: null },
  { id: "zemin", name: "Zemin Etüdü / Kaplama", type: "SELECT", options: ["Laminat", "Parke", "Seramik", "Mermer", "PVC", "Şap", "Halı", "Laminant Parke"], unit: null },
  { id: "yapi_durum", name: "Yapının Durumu", type: "SELECT", options: ["Sıfır", "İkinci El", "Yapım Aşamasında"], unit: null },
  { id: "iskan", name: "İskan", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "havuz", name: "Yüzme Havuzu", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "guvenlik", name: "Güvenlik", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "depozito", name: "Depozito", type: "NUMBER", options: null, unit: "TL" },
  { id: "min_kiralama", name: "Minimum Kiralama", type: "SELECT", options: ["Günlük", "1 Ay", "3 Ay", "6 Ay", "1 Yıl", "1 Yıldan Uzun"], unit: null },
  { id: "esya_durumu_detay", name: "Beyaz Eşya", type: "SELECT", options: ["Yok", "Sadece Mutfak", "Komple"], unit: null },
  { id: "ic_ozellik", name: "İç Özellikler", type: "MULTI", options: [
    "Ebeveyn Banyosu", "Giyinme Odası", "Teras", "Balkon", "Ankastre Mutfak", "Beyaz Eşya", "Klima", "Şömine",
    "Barbekü", "Duşakabin", "Jakuzi", "Vestiyer", "Gömme Dolap", "Amerikan Kapı", "Spot Aydınlatma", "Kartonpiyer",
    "Parke Zemin", "Seramik Zemin", "Laminat", "Isıcam", "Çelik Kapı", "Görüntülü Diafon", "Uydu", "Fiber Altyapı",
    "Akıllı Ev", "Pencere Tül / Stor",
  ], unit: null },
  { id: "dis_ozellik", name: "Dış Özellikler", type: "MULTI", options: [
    "Asansör", "Açık Otopark", "Kapalı Otopark", "Güvenlik", "Kamera Sistemi", "7/24 Güvenlik", "Kapıcı",
    "Yüzme Havuzu", "Açık Havuz", "Kapalı Havuz", "Spor Salonu", "Çocuk Parkı", "Jeneratör", "Su Deposu",
    "Yangın Merdiveni", "Hidrofor", "Isı Yalıtımı", "Ses Yalıtımı", "Bahçe", "Oyun Parkı", "Tenis Kortu",
    "Sauna", "Hamam", "Buhar Odası", "Mescit", "Misafir Otoparkı", "Şarj İstasyonu",
  ], unit: null },
  { id: "muhit", name: "Muhit", type: "MULTI", options: [
    "Deniz Manzarası", "Boğaz Manzarası", "Göl Manzarası", "Doğa Manzarası", "Şehir Manzarası", "Cadde Üzeri",
    "Park", "Okul", "Hastane", "AVM", "Toplu Taşıma", "Metro", "Metrobüs", "Sahil", "Cami", "Market", "Eczane",
  ], unit: null },
  { id: "konut_sekli", name: "Konut Şekli", type: "SELECT", options: ["Ara Kat", "Dubleks", "Tripleks", "Ters Dubleks", "Kot", "En Üst Kat", "Bahçe Katı", "Çatı Katı"], unit: null },
  { id: "takasli_emlak", name: "Takaslı", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "bolum", name: "Bölüm / Oda Sayısı", type: "NUMBER", options: null, unit: null },
  { id: "dukkan_cephe", name: "Cephe Genişliği", type: "NUMBER", options: null, unit: "m" },
  { id: "isyeri_tip", name: "İşyeri Tipi", type: "SELECT", options: ["Ofis", "Plaza Katı", "Dükkan", "Mağaza", "Depo", "Fabrika", "Atölye", "Café / Restoran", "Showroom"], unit: null },
  { id: "imar", name: "İmar Durumu", type: "SELECT", options: ["Konut", "Ticari", "Tarla", "Bağ-Bahçe", "Sanayi", "Turizm", "Belirsiz", "Çiftlik", "Sera"], unit: null },
  { id: "ada", name: "Ada", type: "TEXT", options: null, unit: null },
  { id: "parsel", name: "Parsel", type: "TEXT", options: null, unit: null },
  { id: "kaks", name: "KAKS (Emsal)", type: "NUMBER", options: null, unit: null },
  { id: "gabari", name: "Gabari", type: "NUMBER", options: null, unit: "m" },
  { id: "taahhut", name: "Taahhütname", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "pafta", name: "Pafta", type: "TEXT", options: null, unit: null },
  { id: "tapu_pay", name: "Hisse Durumu", type: "SELECT", options: ["Tamamı", "Hisseli"], unit: null },
  { id: "yil", name: "Yıl", type: "NUMBER", options: null, unit: null },
  { id: "km", name: "KM", type: "NUMBER", options: null, unit: "km" },
  { id: "yakit", name: "Yakıt", type: "SELECT", options: ["Benzin", "Dizel", "LPG", "Benzin & LPG", "Hibrit", "Plug-in Hibrit", "Elektrik", "CNG", "Hidrojen"], unit: null },
  { id: "vites", name: "Vites", type: "SELECT", options: ["Manuel", "Otomatik", "Yarı Otomatik"], unit: null },
  { id: "kasa", name: "Kasa Tipi", type: "SELECT", options: ["Sedan", "Hatchback", "Station Wagon", "Coupe", "Cabrio", "SUV", "Crossover", "Pickup", "MPV", "Van", "Panelvan", "Roadster", "Liftback"], unit: null },
  { id: "renk", name: "Renk", type: "SELECT", options: ["Beyaz", "Siyah", "Gri", "Gümüş", "Füme", "Kırmızı", "Mavi", "Lacivert", "Yeşil", "Sarı", "Turuncu", "Kahverengi", "Bej", "Şampanya", "Mor", "Eflatun", "Altın", "Bordo", "Turkuaz"], unit: null },
  { id: "kimden", name: "Kimden", type: "SELECT", options: ["Sahibinden", "Galeriden", "Yetkili Bayiden", "Filodan", "Rent a Car"], unit: null },
  { id: "hasar", name: "Hasar Kaydı", type: "SELECT", options: ["Yok", "Var", "Tramer Sorgulanmadı"], unit: null },
  { id: "cekis", name: "Çekiş", type: "SELECT", options: ["Önden", "Arkadan", "4x4", "AWD"], unit: null },
  { id: "motor_hacmi", name: "Motor Hacmi", type: "SELECT", options: ["0-1000 cm³", "1001-1200 cm³", "1201-1400 cm³", "1401-1600 cm³", "1601-1800 cm³", "1801-2000 cm³", "2001-2500 cm³", "2501-3000 cm³", "3001-4000 cm³", "4001+ cm³"], unit: null },
  { id: "motor_gucu", name: "Motor Gücü", type: "NUMBER", options: null, unit: "hp" },
  { id: "arac_durumu", name: "Araç Durumu", type: "SELECT", options: ["İkinci El", "Sıfır"], unit: null },
  { id: "kacinci_el", name: "Kaçıncı El", type: "SELECT", options: ["1. El", "2. El", "3. El", "4+ El"], unit: null },
  { id: "plaka", name: "Plaka Uyruk", type: "SELECT", options: ["Türkiye (TR) Plakalı", "Yabancı Plaka"], unit: null },
  { id: "agir_hasar", name: "Ağır Hasar Kayıtlı", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "yedek_anahtar", name: "Yedek Anahtar", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "garanti", name: "Garanti", type: "BOOLEAN", options: ["Var", "Yok"], unit: null },
  { id: "boya_degisen", name: "Boya-Değişen", type: "SELECT", options: ["Belirtilmemiş", "Yok", "Boyalı", "Değişen", "Boyalı + Değişen", "Tamamı Orijinal"], unit: null },
  { id: "klima_arac", name: "Klima", type: "SELECT", options: ["Yok", "Manuel", "Otomatik", "Çift Bölge", "Üç Bölge+"], unit: null },
  { id: "airbag", name: "Airbag", type: "SELECT", options: ["Yok", "Sürücü", "Sürücü + Yolcu", "Yan", "Perde", "6+", "8+"], unit: null },
  { id: "koltuk", name: "Koltuk", type: "SELECT", options: ["Kumaş", "Deri", "Kısmi Deri", "Alcantara", "Ventilasyonlu"], unit: null },
  { id: "donanim", name: "Donanım", type: "MULTI", options: [
    "ABS", "ESP", "TCS", "Hava Yastığı", "Isofix", "Merkezi Kilit", "Immobilizer", "Alarm",
    "Sunroof", "Panoramik Cam Tavan", "Xenon Far", "LED Far", "Sis Farı", "Far Yıkama", "Adaptif Far",
    "Yağmur Sensörü", "Işık Sensörü", "Park Sensörü (Arkası)", "Park Sensörü (Ön)", "Geri Görüş Kamerası", "360° Kamera",
    "Cruise Control", "Adaptif Cruise", "Şerit Takip", "Kör Nokta Uyarı", "Çarpışma Önleyici", "Yokuş Kalkış Destek",
    "Lastik Basınç", "Start/Stop", "Anahtarsız Giriş", "Anahtarsız Çalıştırma", "Elektrikli Bagaj", "Head-up Display",
    "Navigasyon", "Apple CarPlay", "Android Auto", "Bluetooth", "USB", "Kablosuz Şarj",
    "Deri Direksiyon", "Isıtmalı Direksiyon", "Isıtmalı Koltuk", "Soğutmalı Koltuk", "Hafızalı Koltuk", "Spor Koltuk",
    "Elektrikli Camlar", "Katlanır Ayna", "Isıtmalı Ayna", "Çelik Jant", "Yedek Lastik", "Çeki Demiri", "Tavan Rayı",
    "Dijital Gösterge", "Hız Sabitleyici",
  ], unit: null },
  { id: "moto_tip", name: "Tip", type: "SELECT", options: ["Naked", "Sport", "Scooter", "Maxi Scooter", "Enduro", "Adventure", "Motocross", "Chopper / Cruiser", "Touring", "Supermoto", "Cafe Racer", "ATV", "Elektrikli", "Classic"], unit: null },
  { id: "silindir", name: "Silindir", type: "SELECT", options: ["1", "2", "3", "4", "6+"], unit: null },
  { id: "sogutma", name: "Soğutma", type: "SELECT", options: ["Hava", "Sıvı", "Karışık"], unit: null },
  { id: "ehliyet", name: "Ehliyet", type: "SELECT", options: ["M", "A1", "A2", "A", "B"], unit: null },
  { id: "abs", name: "ABS", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "donanim_moto", name: "Donanım", type: "MULTI", options: [
    "ABS", "Traction Control", "Çift Kanal ABS", "LED Far", "Hız Sabitleyici", "Hızlı Vites",
    "Ters Çevirme", "Elcik Isıtma", "Sele Isıtma", "Hızlı Şarj Prizi", "Yan Çanta", "Üst Çanta",
    "Koruma Demiri", "Cam", "Akıllı Ekran", "Keyless", "Immobilizer", "Alarm",
  ], unit: null },
  { id: "durum", name: "Durumu", type: "SELECT", options: ["Sıfır", "İkinci El", "Yenilenmiş"], unit: null },
  { id: "hafiza", name: "Dahili Hafıza", type: "SELECT", options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB", "2 TB"], unit: null },
  { id: "ram", name: "RAM", type: "SELECT", options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "24 GB", "32 GB", "64 GB"], unit: null },
  { id: "islemci", name: "İşlemci", type: "SELECT", options: ["Apple M1", "Apple M2", "Apple M3", "Apple M4", "Intel i3", "Intel i5", "Intel i7", "Intel i9", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9"], unit: null },
  { id: "ekran", name: "Ekran Boyutu", type: "SELECT", options: ["11\"", "13\"", "14\"", "15\"", "16\"", "17\""], unit: null },
  { id: "renk_tel", name: "Renk", type: "SELECT", options: ["Siyah", "Beyaz", "Gri", "Mavi", "Mor", "Yeşil", "Kırmızı", "Altın", "Gümüş", "Pembe", "Titanyum"], unit: null },
  { id: "batarya", name: "Pil Sağlığı", type: "SELECT", options: ["%95+", "%90-95", "%80-90", "%80 altı", "Bilinmiyor"], unit: null },
  { id: "kutu", name: "Kutu / Fatura", type: "SELECT", options: ["Kutulu + Faturalı", "Kutulu", "Faturalı", "Yok"], unit: null },
  { id: "cinsiyet", name: "Cinsiyet", type: "SELECT", options: ["Erkek", "Dişi"], unit: null },
  { id: "yas_hayvan", name: "Yaş", type: "SELECT", options: ["0-3 ay", "3-6 ay", "6-12 ay", "1-2 yaş", "2-5 yaş", "5+ yaş"], unit: null },
  { id: "asi", name: "Aşıları Tam", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "chip", name: "Çipli", type: "BOOLEAN", options: evetHayir, unit: null },
  { id: "egitim", name: "Eğitim Seviyesi", type: "SELECT", options: ["İlkokul", "Ortaokul", "Lise", "Ön Lisans", "Lisans", "Yüksek Lisans", "Doktora"], unit: null },
  { id: "calisma", name: "Çalışma Şekli", type: "SELECT", options: ["Tam Zamanlı", "Yarı Zamanlı", "Dönemsel", "Stajyer", "Uzaktan", "Hibrit"], unit: null },
  { id: "pozisyon", name: "Pozisyon Seviyesi", type: "SELECT", options: ["Eleman", "Uzman", "Yönetici", "Üst Düzey Yönetici"], unit: null },
  { id: "deneyim", name: "Deneyim", type: "SELECT", options: ["Deneyimsiz", "1 yıl", "1-3 yıl", "3-5 yıl", "5-10 yıl", "10+ yıl"], unit: null },
  { id: "ders_sekli", name: "Ders Şekli", type: "SELECT", options: ["Yüz yüze (öğretmenin evi)", "Yüz yüze (öğrencinin evi)", "Online", "Hibrit"], unit: null },
  { id: "beden", name: "Beden", type: "SELECT", options: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Standart"], unit: null },
  { id: "marka_serbest", name: "Marka", type: "TEXT", options: null, unit: null },
];

const links = [];
function link(catId, attrId, required = false) {
  links.push([catId, attrId, required]);
}
function linkMany(catId, ids, requiredIds = []) {
  for (const id of ids) link(catId, id, requiredIds.includes(id));
}

const KONUT_ATTRS = [
  "oda", "m2", "m2_brut", "bina_yasi", "kat", "kat_sayisi", "isitma", "banyo", "wc", "mutfak", "balkon",
  "asansor", "otopark", "esyali", "kullanim", "site", "aidat", "kredi", "tapu", "kimden_emlak", "takas",
  "cephe", "zemin", "yapi_durum", "iskan", "havuz", "guvenlik", "esya_durumu_detay", "konut_sekli",
  "ic_ozellik", "dis_ozellik", "muhit",
];
linkMany("konut", KONUT_ATTRS, ["oda", "m2", "bina_yasi", "kat"]);
for (const id of [
  "kiralik-konut", "kiralik-residence", "kiralik-mustakil", "kiralik-villa", "kiralik-yazlik",
  "kiralik-prefabrik", "kiralik-ciftlik", "kiralik-loft", "kiralik-cati-dubleks", "kiralik-bahce-dubleks",
  "kiralik-tripleks", "kiralik-koy-evi", "kiralik-kosk", "kiralik-yali",
]) {
  link(id, "depozito", false);
  link(id, "min_kiralama", false);
}
link("gunluk-kiralik", "depozito", false);
link("gunluk-kiralik", "min_kiralama", true);

const ISYERI_ATTRS = [
  "m2", "m2_brut", "isitma", "asansor", "otopark", "aidat", "kredi", "tapu", "kimden_emlak", "takas",
  "bolum", "dukkan_cephe", "yapi_durum", "kullanim", "isyeri_tip", "dis_ozellik", "muhit",
];
linkMany("isyeri", ISYERI_ATTRS, ["m2"]);
linkMany("arsa", ["m2", "imar", "ada", "parsel", "pafta", "kaks", "gabari", "tapu", "tapu_pay", "kredi", "taahhut", "kimden_emlak", "takas"], ["m2", "imar"]);
linkMany("bina", ["m2", "kat_sayisi", "isitma", "asansor", "kredi", "tapu", "kimden_emlak", "bolum"], ["m2"]);
linkMany("devre-mulk", ["m2", "oda", "kimden_emlak", "esyali"], ["m2"]);
linkMany("turistik", ["m2", "oda", "kimden_emlak", "kredi", "bolum", "havuz"], ["m2"]);
linkMany("devren", ["m2", "aidat", "kimden_emlak", "isyeri_tip"], ["m2"]);

const VASITA_BASE = ["yil", "km", "renk", "kimden", "takas", "arac_durumu", "garanti"];
linkMany("vasita", VASITA_BASE, ["yil", "km"]);
const OTO_EXTRA = [
  "yakit", "vites", "kasa", "cekis", "hasar", "motor_hacmi", "motor_gucu", "kacinci_el", "plaka",
  "agir_hasar", "yedek_anahtar", "boya_degisen", "klima_arac", "airbag", "koltuk", "donanim",
];
linkMany("otomobil", OTO_EXTRA, ["yakit", "vites"]);
linkMany("arazi-suv", OTO_EXTRA, ["yakit", "vites"]);
linkMany("minivan", OTO_EXTRA, ["yakit", "vites"]);
linkMany("klasik", OTO_EXTRA, ["yakit"]);
linkMany("hasarli", OTO_EXTRA, ["yakit"]);
linkMany("kiralik-arac", ["yakit", "vites", "kasa"], ["yakit"]);
linkMany("engelli-plaka", OTO_EXTRA, ["yakit", "vites"]);
linkMany("ticari", ["yakit", "vites", "hasar", "motor_hacmi", "plaka", "donanim"], ["yakit"]);
linkMany("moto", ["yakit", "vites", "moto_tip", "motor_hacmi", "silindir", "sogutma", "ehliyet", "abs", "hasar", "donanim_moto"], ["yakit", "moto_tip"]);
linkMany("deniz", ["yil", "kimden"], ["yil"]);
linkMany("karavan", ["yil", "km", "kimden", "m2"], ["yil"]);
linkMany("atv", ["yil", "km", "motor_hacmi", "kimden"], ["yil"]);
linkMany("hava", ["yil", "kimden"], ["yil"]);
linkMany("elektrikli-bisiklet", ["yil", "durum", "garanti"], ["durum"]);
linkMany("is-makineleri", ["yil", "km", "kimden", "garanti"], ["yil"]);
linkMany("tarim", ["yil", "km", "kimden"], ["yil"]);
linkMany("sanayi-makine", ["durum", "garanti", "yil"], ["durum"]);

linkMany("telefon", ["durum", "garanti", "hafiza", "renk_tel", "batarya", "kutu"], ["durum"]);
linkMany("akilli-saat", ["durum", "garanti"], ["durum"]);
linkMany("laptop", ["durum", "garanti", "islemci", "ram", "ekran"], ["durum"]);
linkMany("bilgisayar", ["durum", "garanti"], ["durum"]);
linkMany("oyun-konsol", ["durum", "garanti"], ["durum"]);
linkMany("foto-kamera", ["durum", "garanti"], ["durum"]);
linkMany("mobilya", ["durum"], ["durum"]);
linkMany("giyim", ["durum", "beden"], ["durum"]);
linkMany("saat", ["durum", "garanti"], ["durum"]);
linkMany("ev-elektronigi", ["durum", "garanti"], ["durum"]);
linkMany("beyaz-esya", ["durum", "garanti"], ["durum"]);
linkMany("yp-oto", ["durum", "marka_serbest"], ["durum"]);
linkMany("yp-moto", ["durum"], ["durum"]);
linkMany("kedi", ["cinsiyet", "yas_hayvan", "asi", "chip"], ["cinsiyet"]);
linkMany("kopek", ["cinsiyet", "yas_hayvan", "asi", "chip"], ["cinsiyet"]);
linkMany("hayvan-kus", ["cinsiyet", "yas_hayvan"], []);
linkMany("ozel-ders", ["egitim", "ders_sekli", "deneyim"], []);
linkMany("is-ilanlari", ["egitim", "calisma", "pozisyon", "deneyim"], ["calisma"]);
linkMany("yardimci", ["deneyim", "calisma"], []);

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const parentIds = new Set(cats.map((c) => c.id));
parentIds.add(null);
for (const c of cats) {
  if (c.parent && !seen.has(c.parent)) {
    console.error(`orphan ${c.id} parent ${c.parent}`);
  }
}

const lines = [];
lines.push("-- Complete GeldeSat catalog (Sahibinden-scale)");
lines.push("-- Generated by scripts/generate-catalog.mjs");

for (const part of chunk(cats, 80)) {
  lines.push("insert into categories (id, name, slug, parent_id, icon, sort_order) values");
  lines.push(
    part
      .map((c, i) => {
        const parent = c.parent ? `'${sql(c.parent)}'` : "null";
        const icon = c.icon ? `'${sql(c.icon)}'` : "null";
        const comma = i === part.length - 1 ? "" : ",";
        return `  ('${sql(c.id)}', '${sql(c.name)}', '${sql(c.slug)}', ${parent}, ${icon}, ${c.sort})${comma}`;
      })
      .join("\n"),
  );
  lines.push(
    "on conflict (id) do update set name = excluded.name, slug = excluded.slug, parent_id = excluded.parent_id, icon = coalesce(excluded.icon, categories.icon), sort_order = excluded.sort_order;",
  );
}

for (const part of chunk(attrs, 40)) {
  lines.push("insert into attribute_defs (id, name, type, options, unit) values");
  lines.push(
    part
      .map((a, i) => {
        const opt = a.options ? `'${sql(JSON.stringify(a.options))}'::jsonb` : "null";
        const unit = a.unit ? `'${sql(a.unit)}'` : "null";
        const comma = i === part.length - 1 ? "" : ",";
        return `  ('${sql(a.id)}', '${sql(a.name)}', '${sql(a.type)}', ${opt}, ${unit})${comma}`;
      })
      .join("\n"),
  );
  lines.push(
    "on conflict (id) do update set name = excluded.name, type = excluded.type, options = excluded.options, unit = excluded.unit;",
  );
}

const uniqLinks = [];
const linkSeen = new Set();
for (const l of links) {
  const k = `${l[0]}|${l[1]}`;
  if (linkSeen.has(k)) continue;
  linkSeen.add(k);
  uniqLinks.push(l);
}

for (const part of chunk(uniqLinks, 80)) {
  lines.push("insert into category_attributes (category_id, attribute_id, required) values");
  lines.push(
    part
      .map((l, i) => {
        const comma = i === part.length - 1 ? "" : ",";
        return `  ('${sql(l[0])}', '${sql(l[1])}', ${l[2] ? "true" : "false"})${comma}`;
      })
      .join("\n"),
  );
  lines.push("on conflict (category_id, attribute_id) do update set required = excluded.required;");
}

lines.push(`-- ${cats.length} categories, ${attrs.length} attributes, ${uniqLinks.length} links`);

const SUPERSEDED = [
  "alisveris-anne-bebek",
  "alisveris-kitap-dergi-film",
  "alisveris-muzik",
  "alisveris-koleksiyon",
  "alisveris-hobi-oyuncak",
  "alisveris-bahce-yapi-market",
  "alisveris-ofis-kirtasiye",
  "alisveris-spor",
  "alisveris-fotograf-kamera",
  "yp-otomotiv-yedek-parca",
  "yp-motosiklet-yedek-parca",
  "yp-lastik-jant",
  "yp-audio-goruntu",
  "yp-navigasyon",
  "yp-tuning",
  "yp-deniz-arac-ekipmani",
  "yp-karavan-ekipmani",
  "oto-bmw-m135i",
  "oto-bmw-m340i",
];
lines.push(
  `delete from categories where id in (${SUPERSEDED.map((id) => `'${sql(id)}'`).join(", ")}) and not exists (select 1 from listings where category_id = categories.id);`,
);

const slugs = new Map();
for (const c of cats) {
  if (slugs.has(c.slug)) console.error(`duplicate slug ${c.slug}: ${slugs.get(c.slug)} vs ${c.id}`);
  slugs.set(c.slug, c.id);
}

writeFileSync("/workspace/migrations/0012_series_groups.sql", lines.join("\n") + "\n");
console.log(`wrote 0012_series_groups.sql (${cats.length} cats, ${attrs.length} attrs, ${uniqLinks.length} links)`);
