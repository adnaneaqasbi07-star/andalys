/* =====================================================================
   Vignette produit — utilisée sur l'accueil, les listes et les favoris.
   ===================================================================== */

import { h, image, etoiles, notice } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { prix, pourcentageRemise, emojiType } from "../core/format.js";
import { lien } from "../core/routeur.js";
import { estFavori, basculer } from "../data/favoris.js";
import * as panier from "../data/panier.js";

/**
 * Le visuel affiché quand un produit n'a pas encore de photo. Une niche en
 * arche plutôt qu'un emoji perdu au milieu du vide : l'absence de photo
 * devient une intention, pas un oubli.
 */
export function visuelVide(type, grand) {
  return h("div.vide" + (grand ? ".vide-grand" : ""),
    h("span.em", { "aria-hidden": "true" }, emojiType(type)));
}

export function carte(p, options) {
  options = options || {};
  const remise = pourcentageRemise(p.prix, p.prix_barre);
  const rupture = Number(p.stock) <= 0 && !(p.variantes && p.variantes.length);

  const vis = h("a.vis", { href: lien("/p/" + p.slug), "aria-label": L(p.nom) },
    p.image ? image(p.image, L(p.nom)) : visuelVide(p.type),
    h("div.tags",
      remise  ? h("span.badge.badge-promo", {}, "−" + remise + "%") : null,
      p.nouveaute && !remise ? h("span.badge.badge-new", {}, t("nouveautes")) : null,
      rupture ? h("span.badge.badge-rupt", {}, t("rupture")) : null)
  );

  const coeur = h("button.icon-btn.fav" + (estFavori(p.id) ? ".on" : ""), {
    type: "button",
    "aria-label": t("favoris"),
    "aria-pressed": estFavori(p.id) ? "true" : "false",
    onclick: async function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        const ajoute = await basculer(p.id);
        coeur.classList.toggle("on", ajoute);
        coeur.setAttribute("aria-pressed", ajoute ? "true" : "false");
        notice(t(ajoute ? "ajoute_favoris" : "retire_favoris"));
      } catch (err) { notice(t("erreur"), true); }
    }
  }, estFavori(p.id) ? "♥" : "♡");
  vis.appendChild(coeur);

  /* Un produit vendu au format (3 ml, 6 ml…) ne peut pas être ajouté depuis
     une vignette : le client n'a pas choisi, et le prix dépend du format.
     Le bouton renvoie alors vers la fiche. La base refuse de toute façon
     une commande sans format. */
  const aFormats = !!(p.variantes && p.variantes.some(function (v) { return v.actif !== false; }));

  const bouton = aFormats
    ? h("a.btn.btn-sm.btn-ghost.add", { href: lien("/p/" + p.slug) }, t("choisir_format"))
    : h("button.btn.btn-sm.btn-ghost.add", {
        type: "button",
        disabled: rupture,
        onclick: function () {
          panier.ajouter(p, null, 1);
          notice(t("ajoute"));
        }
      }, rupture ? t("rupture") : t("ajouter_panier"));

  return h("article.pcard",
    vis,
    h("div.txt",
      p.marque ? h("div.mq", {}, p.marque.nom) : null,
      h("a.nm", { href: lien("/p/" + p.slug) }, L(p.nom)),
      Number(p.nb_avis) > 0
        ? h("div.row", { style: { gap: "6px" } }, etoiles(p.note_moyenne),
            h("span.faint", {}, "(" + p.nb_avis + ")"))
        : null,
      h("div.pr",
        h("span.px", {}, prix(p.prix)),
        p.prix_barre ? h("span.px-old", {}, prix(p.prix_barre)) : null)),
    options.sansBouton ? null : bouton
  );
}

export function grille(liste, options) {
  return h("div.produits", {}, liste.map(function (p) { return carte(p, options); }));
}

/** Bandeau horizontal de squelettes pendant le chargement. */
export function squelettes(n) {
  const items = [];
  for (let i = 0; i < (n || 8); i++) {
    items.push(h("div.pcard",
      h("div.squelette", { style: { aspectRatio: "1" } }),
      h("div.txt",
        h("div.squelette", { style: { height: "13px", width: "55%" } }),
        h("div.squelette", { style: { height: "17px", width: "85%", marginTop: "6px" } }),
        h("div.squelette", { style: { height: "17px", width: "40%", marginTop: "10px" } }))));
  }
  return h("div.produits", {}, items);
}
