import { formatPrice } from "./utils";
import type { CategoryRow, ListingCard } from "./server/helpers";

export const SITE_NAME = "GeldeSat";
export const BASE_URL = "https://www.geldesat.com";
export const DEFAULT_OG_IMAGE = `${BASE_URL}/og.jpg`;

/**
 * Generic root category names that don't add value when subcategories exist.
 */
const GENERIC_ROOTS = new Set([
  "vasita",
  "vasıta",
  "emlak",
  "ikinci el ve sıfır alışveriş",
  "alisveris",
  "yedek parça, aksesuar, donanım & tuning",
  "is makineleri & sanayi",
  "hizmetler",
  "is ilanlari",
  "hayvanlar alemi",
  "ozel ders verenler",
  "yardimci arayanlar",
]);

/**
 * Builds a natural, brand-rich hierarchical name from category breadcrumb path.
 *
 * Examples:
 *   [Vasıta, Otomobil, BMW, 5 Serisi, 520d] => "BMW 5 Serisi 520d"
 *   [Vasıta, Otomobil, Renault, Megane]     => "Renault Megane"
 *   [Emlak, Konut, Satılık, Daire]          => "Satılık Daire"
 *   [Emlak, İş Yeri, Kiralık, Dükkan]       => "Kiralık Dükkan"
 *   [Alışveriş, Telefon, Apple, iPhone 15]  => "Apple iPhone 15"
 *   [Vasıta, Otomobil]                      => "Otomobil"
 *   [Vasıta]                                => "Vasıta"
 */
export function getCategoryHierarchicalName(
  path: { name: string; slug?: string }[],
  leafCategoryName?: string,
): string {
  if (!path || path.length === 0) {
    return leafCategoryName || "Tüm Kategoriler";
  }

  const names = path.map((p) => p.name.trim()).filter(Boolean);
  if (names.length === 0) return leafCategoryName || "Tüm Kategoriler";
  if (names.length === 1) return names[0];

  const rootLower = names[0].toLowerCase();

  // 1. Vasıta hiyerarşisi: [Vasıta, Otomobil, BMW, 5 Serisi, 520d]
  if (rootLower.includes("vasıt") || rootLower.includes("vasit")) {
    if (names.length >= 3) {
      // E.g. [Vasıta, Otomobil, BMW, 5 Serisi, 520d] -> names.slice(2) = ["BMW", "5 Serisi", "520d"]
      return names.slice(2).join(" ");
    }
    // E.g. [Vasıta, Otomobil] -> "Otomobil"
    return names.slice(1).join(" ");
  }

  // 2. Emlak hiyerarşisi: [Emlak, Konut, Satılık, Daire]
  if (rootLower.includes("emlak")) {
    if (names.length >= 4) {
      // ["Konut", "Satılık", "Daire"] -> "Satılık Daire"
      const sub = names.slice(2).join(" ");
      return sub;
    }
    if (names.length >= 3) {
      // ["Konut", "Satılık"] -> "Satılık Konut"
      const action = names[2];
      const type = names[1];
      return `${action} ${type}`;
    }
    return names.slice(1).join(" ");
  }

  // 3. Alışveriş / Elektronik: [İkinci El..., Telefon, Cep Telefonu, Apple, iPhone 15]
  if (GENERIC_ROOTS.has(rootLower) || rootLower.includes("alışveriş") || rootLower.includes("alisveris")) {
    if (names.length >= 4) {
      // Take brand + model or last 2-3 items
      return names.slice(-2).join(" ");
    }
    return names.slice(1).join(" ");
  }

  // Genel kural: Kök çok genel değilse son 2 veya 3 öğeyi birleştir
  if (names.length > 3) {
    return names.slice(-3).join(" ");
  }
  return names.join(" ");
}

export interface CategorySeoInput {
  category: { id?: string; name: string; slug: string };
  path: { id?: string; name: string; slug: string }[];
  result?: { total: number; page: number; pages: number } | null;
  search?: {
    city?: string;
    district?: string;
    neighborhood?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
  };
}

export interface CategorySeoOutput {
  title: string;
  description: string;
  h1: string;
  canonicalUrl: string;
  pageUrl: string;
  breadcrumbItems: Array<{ "@type": string; position: number; name: string; item: string }>;
  itemListSchema: Record<string, unknown> | null;
  paginationLinks: Array<{ rel: string; href: string }>;
}

export function buildCategorySeo(input: CategorySeoInput): CategorySeoOutput {
  const { category, path, result, search } = input;
  const pageUrl = `${BASE_URL}/category/${category.slug}`;
  const totalCount = result?.total ?? 0;
  const currentPage = result?.page ?? 1;
  const totalPages = result?.pages ?? 1;

  // Hiyerarşik ve zengin kategori ismi: "BMW 5 Serisi 520d", "Satılık Daire", vb.
  const hierarchicalName = getCategoryHierarchicalName(path, category.name);

  // Konum filtreleri var mı?
  const locationPrefix = [search?.district, search?.city].filter(Boolean).join(" ");

  // H1: Ekranda ve arama motorunda görünecek ana başlık
  const h1 = locationPrefix
    ? `${locationPrefix} ${hierarchicalName} İlanları`
    : `${hierarchicalName} İlanları`;

  // Title: Google SERP için maksimum tıklanma ve alaka sağlayan başlık
  // Örn: "BMW 5 Serisi 520d İlanları ve Fiyatları (3 İlan) | GeldeSat"
  // Sayfa 2 için: "BMW 5 Serisi 520d İlanları ve Fiyatları - Sayfa 2 | GeldeSat"
  let titleCore = `${h1} ve Fiyatları`;
  if (totalCount > 0 && currentPage === 1) {
    titleCore += ` (${totalCount.toLocaleString("tr-TR")} İlan)`;
  }
  if (currentPage > 1) {
    titleCore += ` - Sayfa ${currentPage}`;
  }
  const title = `${titleCore} | ${SITE_NAME}`;

  // Description: Arama sonuçlarında kullanıcıyı tıklamaya yönlendiren zengin açıklama
  const locText = locationPrefix ? `${locationPrefix} bölgesinde ` : "";
  const countText = totalCount > 0 ? `${totalCount.toLocaleString("tr-TR")} güncel` : "en güncel";
  let description = `${SITE_NAME}'ta ${locText}${hierarchicalName} kategorisinde ${countText} ilan! Sahibinden ve yetkili satıcıdan satılık ve kiralık seçeneklerini inceleyin, fiyatları karşılaştırıp güvenle satın alın.`;
  if (currentPage > 1) {
    description = `${hierarchicalName} ilanları listesi - Sayfa ${currentPage}. ${description}`;
  }
  if (description.length > 160) {
    description = description.slice(0, 157) + "...";
  }

  // Canonical: Filtreleme yapıldığında canonical ana kategoriye yönlendirilir (duplicate önlemi)
  // Ancak sayfa 2, 3 gibi sayfalamalarda canonical ?page=N olmalıdır
  const canonicalUrl = currentPage === 1 ? pageUrl : `${pageUrl}?page=${currentPage}`;

  const paginationLinks: { rel: string; href: string }[] = [
    { rel: "canonical", href: canonicalUrl },
  ];
  if (currentPage > 1) {
    paginationLinks.push({
      rel: "prev",
      href: currentPage === 2 ? pageUrl : `${pageUrl}?page=${currentPage - 1}`,
    });
  }
  if (currentPage < totalPages) {
    paginationLinks.push({
      rel: "next",
      href: `${pageUrl}?page=${currentPage + 1}`,
    });
  }

  // BreadcrumbList JSON-LD
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Anasayfa", item: BASE_URL },
    ...(path ?? []).map((p, i) => ({
      "@type": "ListItem",
      position: i + 2,
      name: p.name,
      item: `${BASE_URL}/category/${p.slug}`,
    })),
  ];

  return {
    title,
    description,
    h1,
    canonicalUrl,
    pageUrl,
    breadcrumbItems,
    itemListSchema: null,
    paginationLinks,
  };
}

export interface ListingSeoInput {
  listing: ListingCard;
  path: { id?: string; name: string; slug: string }[];
  seller?: { id: string; name: string; rating_avg: number; rating_count: number } | null;
}

export interface ListingSeoOutput {
  title: string;
  description: string;
  coverImage: string;
  absoluteImages: string[];
  canonicalUrl: string;
  pageUrl: string;
  breadcrumbItems: Array<{ "@type": string; position: number; name: string; item: string }>;
  structuredData: Record<string, unknown>;
}

export function buildListingSeo(input: ListingSeoInput): ListingSeoOutput {
  const { listing, path, seller } = input;
  const pageUrl = `${BASE_URL}/ilan/${listing.slug}`;

  // Kategori hiyerarşisi
  const hierarchicalCat = getCategoryHierarchicalName(path, listing.category_name);

  // Görseller
  const rawImage = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  const coverImage = rawImage
    ? rawImage.startsWith("http")
      ? rawImage
      : `${BASE_URL}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`
    : DEFAULT_OG_IMAGE;

  const absoluteImages = (listing.images ?? []).map((img) =>
    img.startsWith("http") ? img : `${BASE_URL}${img.startsWith("/") ? "" : "/"}${img}`,
  );

  // Konum bilgisi
  const locationString = [listing.district, listing.city].filter(Boolean).join(", ");

  // İlan Özellikleri (Yıl, KM, Yakıt, Vites, m², vb.)
  const attrs = listing.attrs || {};
  const conditionLabel = String(attrs["Durum"] ?? "").trim().toLocaleLowerCase("tr");
  const itemCondition = conditionLabel === "yeni" || conditionLabel === "sıfır"
    ? "https://schema.org/NewCondition"
    : conditionLabel === "ikinci el" || conditionLabel === "kullanılmış"
      ? "https://schema.org/UsedCondition"
      : conditionLabel === "yenilenmiş"
        ? "https://schema.org/RefurbishedCondition"
        : undefined;
  const priceValidUntil = listing.expires_at && Number.isFinite(Date.parse(listing.expires_at))
    ? new Date(listing.expires_at).toISOString().slice(0, 10)
    : undefined;
  const year = attrs["Yıl"] ? String(attrs["Yıl"]) : null;
  const km = attrs["KM"] ? `${attrs["KM"]} KM` : null;
  const fuel = attrs["Yakıt"] ? String(attrs["Yakıt"]) : null;
  const transmission = attrs["Vites"] ? String(attrs["Vites"]) : null;
  const m2 = attrs["m²"] || attrs["m² (Net)"] ? `${attrs["m²"] || attrs["m² (Net)"]} m²` : null;
  const rooms = attrs["Oda Sayısı"] ? String(attrs["Oda Sayısı"]) : null;

  // Akıllı Başlık: Kullanıcının girdiği başlık marka/model içermiyorsa kategoriyle destekle
  // Örn: "Acil Satılık | BMW 5 Serisi 520d (2016) İstanbul - 1.850.000 TL | GeldeSat"
  const titleLower = listing.title.toLowerCase();
  const catLower = hierarchicalCat.toLowerCase();
  const alreadyIncludesCategory = catLower.split(" ").some((w) => w.length > 2 && titleLower.includes(w));

  let enrichedContext = "";
  if (!alreadyIncludesCategory && hierarchicalCat && hierarchicalCat !== "Tüm Kategoriler") {
    enrichedContext = ` | ${hierarchicalCat}`;
  }
  if (year && !listing.title.includes(year)) {
    enrichedContext += ` (${year})`;
  }

  const locationContext = locationString ? ` ${locationString}` : "";
  const priceFormatted = formatPrice(listing.price, listing.currency);

  const title = `${listing.title}${enrichedContext}${locationContext} - ${priceFormatted} | ${SITE_NAME}`;

  // Açıklama (Meta Description): Teknik özellikleri öne çıkaran, kullanıcı aramalarına tam yanıt veren şablon
  const keySpecs = [year ? `${year} Model` : null, transmission, fuel, km, m2, rooms]
    .filter(Boolean)
    .join(", ");

  const cleanUserDesc = (listing.description || "").replace(/\s+/g, " ").trim();
  let description = `${hierarchicalCat} - ${listing.title}. ${keySpecs ? `Özellikler: ${keySpecs}. ` : ""}${locationString ? `Konum: ${locationString}. ` : ""}Fiyat: ${priceFormatted}. ${cleanUserDesc}`;
  if (description.length > 160) {
    description = description.slice(0, 157) + "...";
  }

  // Breadcrumbs
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Anasayfa", item: BASE_URL },
    ...(path ?? []).map((p, i) => ({
      "@type": "ListItem",
      position: i + 2,
      name: p.name,
      item: `${BASE_URL}/category/${p.slug}`,
    })),
    {
      "@type": "ListItem",
      position: (path?.length ?? 0) + 2,
      name: listing.title,
      item: pageUrl,
    },
  ];

  // Schema.org Structured Data: Kategoriye göre Vehicle, RealEstate veya Product
  const isVehicle = path.some((p) => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("vasita") || s.includes("otomobil") || s.includes("motosiklet") || n.includes("vasıta") || n.includes("otomobil");
  });

  const isRealEstate = path.some((p) => {
    const s = p.slug.toLowerCase();
    const n = p.name.toLowerCase();
    return s.includes("emlak") || n.includes("emlak") || s.includes("konut") || s.includes("arsa");
  });

  const datePublished = listing.created_at ? new Date(listing.created_at).toISOString() : undefined;
  const dateModified = listing.updated_at ? new Date(listing.updated_at).toISOString() : datePublished;

  const baseOffer = {
    "@type": "Offer",
    priceCurrency: listing.currency || "TRY",
    price: listing.price,
    ...(priceValidUntil ? { priceValidUntil } : {}),
    availability:
      listing.status === "ACTIVE"
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    url: pageUrl,
    ...(seller?.name
      ? {
          seller: {
            "@type": "Person",
            name: seller.name,
            url: `${BASE_URL}/satici/${seller.id ?? ""}`,
          },
        }
      : {}),
    ...(listing.city
      ? {
          availableAtOrFrom: {
            "@type": "Place",
            name: listing.city,
            address: {
              "@type": "PostalAddress",
              addressLocality: listing.district || listing.city,
              addressRegion: listing.city,
              addressCountry: "TR",
            },
          },
        }
      : {}),
  };

  let structuredData: Record<string, unknown>;

  if (isVehicle) {
    // Brand & Model tespit et
    const brandItem = path.find((p) => p.slug.startsWith("oto-") || p.slug.includes("-serisi") || !GENERIC_ROOTS.has(p.slug));
    const brandName = brandItem?.name || hierarchicalCat.split(" ")[0];

    structuredData = {
      "@context": "https://schema.org/",
      "@type": "Car",
      name: listing.title,
      description,
      url: pageUrl,
      image: absoluteImages.length > 0 ? absoluteImages : [coverImage],
      sku: listing.id?.substring(0, 8),
      ...(brandName ? { brand: { "@type": "Brand", name: brandName } } : {}),
      ...(year ? { vehicleModelDate: year, modelDate: year } : {}),
      ...(fuel ? { fuelType: fuel } : {}),
      ...(transmission ? { vehicleTransmission: transmission } : {}),
      ...(km
        ? {
            mileageFromOdometer: {
              "@type": "QuantitativeValue",
              value: Number(attrs["KM"]) || 0,
              unitCode: "KMT",
            },
          }
        : {}),
      ...(itemCondition ? { itemCondition } : {}),
      offers: baseOffer,
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
    };
  } else if (isRealEstate) {
    structuredData = {
      "@context": "https://schema.org/",
      "@type": "RealEstateListing",
      name: listing.title,
      description,
      url: pageUrl,
      image: absoluteImages.length > 0 ? absoluteImages : [coverImage],
      ...(m2 ? { floorSize: { "@type": "QuantitativeValue", value: Number(attrs["m²"]) || 0, unitCode: "MTK" } } : {}),
      ...(rooms ? { numberOfRooms: rooms } : {}),
      offers: baseOffer,
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
    };
  } else {
    structuredData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      name: listing.title,
      description,
      url: pageUrl,
      sku: listing.id?.substring(0, 8),
      image: absoluteImages.length > 0 ? absoluteImages : [coverImage],
      ...(itemCondition ? { itemCondition } : {}),
      offers: baseOffer,
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
    };
  }

  return {
    title,
    description,
    coverImage,
    absoluteImages,
    canonicalUrl: pageUrl,
    pageUrl,
    breadcrumbItems,
    structuredData,
  };
}
