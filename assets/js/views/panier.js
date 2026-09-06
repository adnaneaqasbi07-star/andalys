/* Page panier — même contenu que le tiroir, en pleine largeur. */

import { h, remplir, image, vider } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { prix, emojiType } from "../core/format.js";
import { lien, aller } from "../core/routeur.js";
import { etat, surEtat } from "../core/etat.js";
import * as panier from "../data/panier.js";

function ligne(l) {
  const majQte = function (d) { panier.definirQuantite(l.produit_id, l.variante_id, l.quantite + d); };
  return h("div.ligne", { style: { gridTemplateColumns: "92px 1fr auto" } },
    h("a", { href: lien("/p/" + l.slug) },
      l.image ? image(l.image, L(l.nom), "vis")
              : h("div.vis", { style: { display: "grid", placeItems: "center", fontSize: "30px" } },
                  emojiType(l.type))),
    h("div",
      h("a.nm", { href: lien("/p/" + l.slug) }, L(l.nom)),
      l.variante_nom ? h("div.mt", {}, L(l.variante_nom)) : null,
      h("div.mt", {}, prix(l.prix)),
      h("div.row", { style: { marginTop: "9px", gap: "10px" } },
        h("div.qte",
          h("button", { type: "button", "aria-label": "−", onclick: function () { majQte(-1); } }, "−"),
          h("input", { type: "text", inputmode: "numeric", value: l.quantite, readOnly: true,
                       "aria-label": t("quantite") }),
          h("button", { type: "button", "aria-label": "+", onclick: function () { majQte(1); } }, "+")),
        h("button.btn.btn-quiet.btn-sm", {
          type: "button", onclick: function () { panier.retirer(l.produit_id, l.variante_id); }
        }, t("supprimer")))),
    h("div.px", {}, prix(l.prix * l.quantite)));
}

export default function pagePanier(hote) {
  const zone = h("div");

  const dessiner = function () {
    if (!etat.panier.length) {
      remplir(zone, h("div.vide-etat",
        h("div.em", {}, "🛍"),
        h("h3", {}, t("panier_vide")),
        h("p", {}, t("panier_vide_d")),
        h("a.btn.btn-primary", { href: lien("/produits"), style: { marginTop: "14px" } },
          t("continuer_achats"))));
      return;
    }
    const st = panier.sousTotal();
    const seuil = Number((etat.parametres.livraison || {}).gratuite_des) || 0;
    const manque = seuil - st;

    remplir(zone, h("div", { style: { display: "grid", gap: "26px" } },
      h("div.card.card-pad", {}, etat.panier.map(ligne)),
      h("div.card.card-pad", { style: { alignSelf: "start" } },
        h("h3", {}, t("recapitulatif")),
        h("div.totaux",
          h("div.t", {}, h("span", {}, t("sous_total")), h("span", {}, prix(st))),
          h("div.t.faint", {}, h("span", {}, t("livraison")), h("span", {}, t("calcule_ensuite"))),
          h("div.t.grand", {}, h("span", {}, t("total")), h("span", {}, prix(st)))),
        seuil && manque > 0
          ? h("p.faint", { style: { marginTop: "10px" } },
              t("plus_que") + " " + prix(manque) + " " + t("pour_offerte"))
          : null,
        h("button.btn.btn-primary.btn-block.btn-lg", {
          type: "button", style: { marginTop: "16px" }, onclick: function () { aller("/commande"); }
        }, t("passer_commande")),
        h("a.btn.btn-quiet.btn-block", { href: lien("/produits"), style: { marginTop: "6px" } },
          t("continuer_achats")))));

    zone.firstChild.style.gridTemplateColumns = window.innerWidth >= 900 ? "1fr 340px" : "1fr";
  };

  remplir(hote, h("div.wrap.section",
    h("h1", {}, t("mon_panier")),
    zone));

  dessiner();
  const desabonner = surEtat("panier", dessiner);
  window.addEventListener("hashchange", desabonner, { once: true });
}
