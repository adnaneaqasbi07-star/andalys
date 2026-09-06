/* =====================================================================
   Trilingue — arabe, français, anglais
   ---------------------------------------------------------------------
   Deux fonctions suffisent :
     t("panier")   → le libellé d'interface dans la langue courante
     L(champ)      → le bon volet d'un jsonb {"ar":…,"fr":…,"en":…} venu
                     de la base, avec repli sur le français puis l'anglais
   ===================================================================== */

import { UI } from "./dictionnaire.js";
import { APP } from "../core/config.js";

export const LANGUES = ["ar", "fr", "en"];
export const ETIQUETTES = { ar: "ع", fr: "FR", en: "EN" };
export const NOMS_LANGUE = { ar: "العربية", fr: "Français", en: "English" };

const INDEX = { ar: 0, fr: 1, en: 2 };
let courante = "fr";

export function langue() { return courante; }
export function estRTL() { return courante === "ar"; }

export function detecterLangue() {
  let l = null;
  try { l = localStorage.getItem(APP.cleLangue); } catch (e) { /* privé */ }
  if (!l) {
    const p = new URLSearchParams(location.search).get("lang");
    if (p && LANGUES.indexOf(p) >= 0) l = p;
  }
  if (!l) {
    const n = (navigator.language || "fr").slice(0, 2).toLowerCase();
    l = LANGUES.indexOf(n) >= 0 ? n : "fr";
  }
  return LANGUES.indexOf(l) >= 0 ? l : "fr";
}

/** Applique la langue au document : direction, attribut lang, mémorisation. */
export function definirLangue(l, silencieux) {
  if (LANGUES.indexOf(l) < 0) l = "fr";
  courante = l;
  const html = document.documentElement;
  html.lang = l;
  html.dir = l === "ar" ? "rtl" : "ltr";
  try { localStorage.setItem(APP.cleLangue, l); } catch (e) { /* privé */ }
  if (!silencieux) window.dispatchEvent(new CustomEvent("langue", { detail: l }));
}

/** Libellé d'interface. */
export function t(cle, lang) {
  const e = UI[cle];
  if (!e) return cle;
  const i = INDEX[lang || courante];
  return e[i] || e[1] || e[2] || e[0] || cle;
}

/** Volet linguistique d'un champ jsonb de la base. */
export function L(champ, lang) {
  if (champ === null || champ === undefined) return "";
  if (typeof champ === "string") return champ;
  const l = lang || courante;
  return champ[l] || champ.fr || champ.en || champ.ar || "";
}

/** Toutes les langues d'un champ, pour la recherche locale. */
export function toutesLangues(champ) {
  if (!champ) return "";
  if (typeof champ === "string") return champ;
  return LANGUES.map(function (l) { return champ[l] || ""; }).join(" ");
}
