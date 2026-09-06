/* =====================================================================
   Accueil — hero, garanties, catégories, sélection, nouveautés, marques.
   Chaque bande se remplit dès que sa requête revient : la page ne reste
   pas blanche en attendant la plus lente.
   ===================================================================== */

import { h, remplir, image } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { lien } from "../core/routeur.js";
import { etat } from "../core/etat.js";
import * as catalogue from "../data/catalogue.js";
import { grille, squelettes } from "../ui/carte.js";

function hero() {
  const b = etat.parametres.boutique || {};
  return h("section.hero",
    h("div.wrap",
      h("div.hero-in",
        h("div",
          h("div.eyebrow", {}, t("hero_eyebrow")),
          h("h1", {}, L(b.baseline) || t("hero_titre")),
          h("p.lede", {}, t("hero_lede")),
          h("div.hero-cta",
            h("a.btn.btn-gold.btn-lg", { href: lien("/produits") }, "🛍️ " + t("cta_produits")),
            h("a.btn.btn-ghost.btn-lg", { href: lien("/c/parfums-de-fes") }, "🌿 " + t("cta_parfums")),
            h("a.btn.btn-ghost.btn-lg", { href: lien("/c/patisseries-de-fes") }, "🍯 " + t("cta_saveurs")))),
        h("div.hero-art", h("div", { style: { fontSize: "84px", opacity: ".5" } }, "🕌")))));
}

function assurances() {
  const items = [
    ["🚚", t("assur_livraison"),   t("assur_livraison_d")],
    ["🏛️", t("assur_authentique"), t("assur_authentique_d")],
    ["💵", t("assur_paiement"),    t("assur_paiement_d")],
    ["🌿", t("assur_conseil"),     t("assur_conseil_d")]
  ];
  return h("div.assurances", {}, items.map(function (i) {
    return h("div",
      h("span.em", { "aria-hidden": "true" }, i[0]),
      h("span", {}, h("div.t", {}, i[1]), h("div.d", {}, i[2])));
  }));
}

function categories() {
  const racines = catalogue.racines();
  if (!racines.length) return null;
  return h("section.section",
    h("div.wrap",
      h("div.section-head", h("div",
        h("div.eyebrow", {}, t("categories")),
        h("h2", {}, t("nos_categories")))),
      h("div.cats", {}, racines.map(function (c) {
        return h("a.cat", { href: lien("/c/" + c.slug) },
          c.image_url ? image(c.image_url, "") : null,
          h("div.em", { "aria-hidden": "true" }, c.icone || "✦"),
          h("div.nm", {}, L(c.nom)),
          L(c.description) ? h("div.ds", {}, L(c.description)) : null);
      }))));
}

function bande(titre, surTitre, lienVoirTout) {
  const contenu = h("div", {}, squelettes(4));
  const sec = h("section.section",
    h("div.wrap",
      h("div.section-head",
        h("div", h("div.eyebrow", {}, surTitre), h("h2", {}, titre)),
        lienVoirTout ? h("a.btn.btn-ghost.btn-sm", { href: lienVoirTout }, t("voir_tout")) : null),
      contenu));
  return { section: sec, contenu: contenu };
}

async function remplirBande(bande, filtres) {
  try {
    const liste = await catalogue.produits(filtres);
    if (!liste.length) { bande.section.remove(); return; }
    remplir(bande.contenu, grille(liste));
  } catch (e) {
    /* la bande disparaît plutôt que d'afficher un trou, mais l'erreur
       doit rester visible en développement */
    console.error("bande", e);
    bande.section.remove();
  }
}

function marques() {
  const liste = etat.marques.filter(function (m) { return m.logo_url || m.nom; }).slice(0, 12);
  if (!liste.length) return null;
  return h("section.section",
    h("div.wrap",
      h("div.section-head",
        h("div", h("div.eyebrow", {}, t("marques")), h("h2", {}, t("toutes_marques")))),
      h("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap" } },
        liste.map(function (m) {
          return h("a.chip", { href: lien("/m/" + m.slug), style: { height: "44px" } },
            m.logo_url ? image(m.logo_url, m.nom) : null, m.nom);
        }))));
}

export default function accueil(hote) {
  const vedettes  = bande(t("vedettes"),   t("nos_produits"),  lien("/produits"));
  const nouveaux  = bande(t("nouveautes"), t("boutique"),      lien("/produits?tri=nouveautes"));
  const promos    = bande(t("promotions"), t("boutique"),      lien("/produits?promo=1"));

  remplir(hote,
    hero(),
    assurances(),
    categories(),
    vedettes.section,
    promos.section,
    nouveaux.section,
    marques());

  remplirBande(vedettes, { vedette: true, parPage: 8 });
  remplirBande(promos,   { enPromo: true, parPage: 8, tri: "populaires" });
  remplirBande(nouveaux, { tri: "nouveautes", parPage: 8 });
}
