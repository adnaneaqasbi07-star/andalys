/* =====================================================================
   Un article du journal.
   Le corps est du texte, avec ses sauts de ligne : il est posé par
   textContent et jamais interprété comme du HTML.
   ===================================================================== */

import { h, remplir, image } from "../core/dom.js";
import { t, L, langue } from "../i18n/index.js";
import { date } from "../core/format.js";
import { lien } from "../core/routeur.js";
import * as journal from "../data/journal.js";
import * as catalogue from "../data/catalogue.js";
import { grille } from "../ui/carte.js";
import { grilleArticles } from "./journal.js";

export default async function vueArticle(hote, params) {
  remplir(hote, h("div.wrap.section", h("p.faint", {}, t("chargement"))));

  let a;
  try { a = await journal.article(params.slug); }
  catch (e) {
    remplir(hote, h("div.wrap", h("div.vide-etat",
      h("div.em", {}, "⚠️"),
      h("h3", {}, e.schemaNonExpose ? t("schema_absent") : t("erreur_reseau")))));
    return;
  }

  if (!a) {
    remplir(hote, h("div.wrap", h("div.vide-etat",
      h("div.em", {}, "🕳"), h("h3", {}, t("aucun_resultat")),
      h("a.btn.btn-primary", { href: lien("/journal") }, t("journal")))));
    return;
  }

  document.title = L(a.titre) + " · Andalys";
  const zoneSuite = h("div");
  const zoneProduits = h("div");

  remplir(hote,
    h("article.papier",
      h("div.wrap",
        h("nav.fil",
          h("a", { href: lien("/") }, t("accueil")), "›",
          h("a", { href: lien("/journal") }, t("journal")),
          a.porte ? "›" : null,
          a.porte ? h("a", { href: lien("/c/" + a.porte.slug) },
            L(a.porte.nom, langue() === "ar" ? "ar" : langue())) : null),

        h("header.article-tete",
          a.porte
            ? h("div.eyebrow", {}, (a.porte.icone ? a.porte.icone + " " : "") +
                L(a.porte.nom, langue() === "ar" ? "ar" : langue()))
            : null,
          h("h1", {}, L(a.titre)),
          L(a.chapo) ? h("p.chapo", {}, L(a.chapo)) : null,
          h("div.meta", {},
            [a.auteur, date(a.publie_le)].filter(Boolean).join(" · "))),

        a.image ? h("figure.article-image", image(a.image, L(a.titre))) : null,

        h("div.corps", { style: { whiteSpace: "pre-line" } }, L(a.corps)),

        h("div.losange", { style: { margin: "40px 0 30px" } }, "✦"),
        zoneProduits,
        zoneSuite)));

  window.scrollTo(0, 0);

  /* Ce dont parle l'article se trouve derrière sa porte : on le montre. */
  if (a.categorie_id) {
    catalogue.produits({ categorie: a.categorie_id, parPage: 4, tri: "populaires" })
      .then(function (liste) {
        if (!liste.length) return;
        remplir(zoneProduits, h("section",
          h("div.section-head", h("div",
            h("div.eyebrow", {}, t("derriere_porte")),
            h("h2", {}, a.porte ? L(a.porte.nom, langue() === "ar" ? "ar" : langue())
                                : t("nos_produits")))),
          grille(liste)));
      }).catch(function () { /* section simplement absente */ });
  }

  journal.autres(a.slug, 3).then(function (liste) {
    if (!liste.length) return;
    remplir(zoneSuite, h("section", { style: { marginTop: "40px" } },
      h("div.section-head", h("div", h("h2", {}, t("journal_suite")))),
      grilleArticles(liste)));
  }).catch(function () { /* idem */ });
}
