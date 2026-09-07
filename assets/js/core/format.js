/* =====================================================================
   Mise en forme : prix, dates, remises, téléphone.
   ===================================================================== */

import { APP } from "./config.js";
import { langue, t } from "../i18n/index.js";

const LOCALES = { ar: "ar-MA", fr: "fr-MA", en: "en-MA" };

export function prix(montant, lang) {
  const l = lang || langue();
  const n = Number(montant) || 0;
  try {
    return new Intl.NumberFormat(LOCALES[l] || "fr-MA", {
      style: "currency", currency: APP.devise,
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(n);
  } catch (e) {
    return n.toFixed(n % 1 === 0 ? 0 : 2) + " " + APP.devise;
  }
}

export function nombre(n, lang) {
  try { return new Intl.NumberFormat(LOCALES[lang || langue()] || "fr-MA").format(Number(n) || 0); }
  catch (e) { return String(n); }
}

export function pourcentageRemise(prixActuel, prixBarre) {
  const a = Number(prixActuel), b = Number(prixBarre);
  if (!b || b <= a) return 0;
  return Math.round((1 - a / b) * 100);
}

export function date(v, lang) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  try {
    return new Intl.DateTimeFormat(LOCALES[lang || langue()] || "fr-MA",
      { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch (e) { return d.toLocaleDateString(); }
}

export function dateHeure(v, lang) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  try {
    return new Intl.DateTimeFormat(LOCALES[lang || langue()] || "fr-MA",
      { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
  } catch (e) { return d.toLocaleString(); }
}

export function delai(min, max, lang) {
  if (!min && !max) return "";
  const l = lang || langue();
  return (min === max ? String(min) : min + "–" + max) + " " + t("jours", l);
}

/* --- validations ---------------------------------------------------- */
export function emailValide(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
}

/** Numéros marocains : 06xxxxxxxx, 07xxxxxxxx, +2126xxxxxxxx… */
export function telephoneValide(v) {
  const n = String(v || "").replace(/[^\d+]/g, "");
  return /^(?:\+212|00212|0)[5-7]\d{8}$/.test(n);
}

export function normaliserTelephone(v) {
  let n = String(v || "").replace(/[^\d+]/g, "");
  if (n.startsWith("00212")) n = "+212" + n.slice(5);
  if (n.startsWith("0") && n.length === 10) n = "+212" + n.slice(1);
  return n;
}

/** Repli d'affichage quand une image manque, selon le type de produit. */
export function emojiType(type) {
  return { parfum: "🫗", alimentaire: "🍯", artisanat: "🫖",
           beaute: "🌿", coffret: "🎁" }[type] || "✨";
}

export function slug(v) {
  return String(v || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   /* accents */
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")           /* lettres latines et arabes */
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
