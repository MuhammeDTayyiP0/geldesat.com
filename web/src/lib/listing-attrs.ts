/** Server-side limits for a listing's attribute values; pure so it can be tested without a database. */

export type AttrRule = { name: string; type: string; options?: string[] | null };
export type AttrValues = Record<string, string | number>;

const MAX_ATTRS = 60;
const MAX_KEY_LENGTH = 60;
const MAX_VALUE_LENGTH = 200;
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;
const YEAR_NAMES = new Set(["Yıl", "Model Yılı"]);
export const MIN_YEAR = 1950;

/**
 * Keeps what the category defines and rejects values the catalog cannot use:
 * a NUMBER that is not a plain number would break numeric filters for everyone.
 * Values the listing already has stay accepted, so old listings remain editable
 * after an admin changes a category's attributes.
 */
export function cleanAttrs(raw: AttrValues, rules: AttrRule[], existing: AttrValues = {}, now = new Date()): AttrValues {
  const byName = new Map(rules.map((rule) => [rule.name, rule]));
  const clean: AttrValues = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value === "" || value == null) continue;
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`"${name}" için geçerli bir sayı girin.`);
    const text = String(value).trim();
    if (text.length > MAX_VALUE_LENGTH) throw new Error(`"${name}" en fazla ${MAX_VALUE_LENGTH} karakter olabilir.`);
    const unchanged = name in existing && String(existing[name]) === text;
    const rule = byName.get(name);
    if (!rule) {
      if (unchanged) clean[name] = value;
      continue;
    }
    if (!unchanged) {
      if (rule.type === "NUMBER") {
        if (!PLAIN_NUMBER.test(text)) throw new Error(`"${name}" için geçerli bir sayı girin.`);
        if (YEAR_NAMES.has(name)) {
          const year = Number(text);
          if (!Number.isInteger(year) || year < MIN_YEAR || year > now.getFullYear() + 1) {
            throw new Error(`"${name}" ${MIN_YEAR} ile ${now.getFullYear() + 1} arasında olmalı.`);
          }
        }
      }
      if (rule.type === "SELECT" && rule.options?.length && !rule.options.includes(text)) {
        throw new Error(`"${name}" için listeden bir seçenek seçin.`);
      }
    }
    clean[name] = typeof value === "string" ? text : value;
  }
  if (Object.keys(clean).length > MAX_ATTRS || Object.keys(clean).some((name) => name.length > MAX_KEY_LENGTH)) {
    throw new Error("İlan özellikleri çok uzun.");
  }
  return clean;
}
