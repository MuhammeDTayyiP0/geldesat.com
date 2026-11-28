export const ACCOUNT_TYPES = ["INDIVIDUAL", "CORPORATE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const BUSINESS_TYPES = ["SOLE", "COMPANY"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  SOLE: "Şahıs Şirketi",
  COMPANY: "Limited / A.Ş.",
};

export const STORE_SECTORS = [
  "Otomotiv / Galeri",
  "Emlak Ofisi",
  "Elektronik & Teknoloji",
  "Ev, Bahçe & Mobilya",
  "Giyim & Aksesuar",
  "İş Makineleri & Sanayi",
  "Hizmet & Ticaret",
  "Diğer",
] as const;

export const INDIVIDUAL_ACTIVE_LISTING_LIMIT = 5;

export const STORE_ACTIVE_LISTING_LIMIT: Record<string, number> = {
  FREE: 30,
  BASIC: 50,
  PRO: 200,
  ENTERPRISE: 1000,
};

export const STORE_APP_COOLDOWN_DAYS = 7;

export function maxActiveListingsFor(
  accountType: string | null | undefined,
  storePlan: string | null | undefined,
): number {
  if (accountType === "CORPORATE" && storePlan) {
    return STORE_ACTIVE_LISTING_LIMIT[storePlan] ?? 50;
  }
  return INDIVIDUAL_ACTIVE_LISTING_LIMIT;
}

export function normalizeAndValidateTaxNo(raw: string, businessType: BusinessType): string {
  const digits = raw.replace(/\D/g, "");
  if (businessType === "COMPANY") {
    if (digits.length !== 10) {
      throw new Error("Limited / A.Ş. için 10 haneli Vergi Kimlik Numarası (VKN) girin.");
    }
    return digits;
  }
  if (digits.length === 10) return digits;
  if (digits.length === 11 && !digits.startsWith("0")) return digits;
  throw new Error("Şahıs şirketi için 10 haneli VKN veya 11 haneli T.C. Kimlik Numarası girin.");
}
