/* =====================================================================
   Journal — la liste des articles.
   ===================================================================== */

import { h, remplir, image } from "../core/dom.js";
import { t, L, langue } from "../i18n/index.js";
import { date } from "../core/format.js";
import { lien } from "../core/routeur.js";
import * as journal from "../data/journal.js";

/** Vignette d'article, réutilisée par la page d'une porte. */
export function carteArticle(a) {
  return h("article.acard",
    h("a.vis", { href: lien("/journal/" + a.slug), "aria-label": L(a.titre) },
      a.image ? image(a.image, L(a.titre))
              : h("div.vide", h("span.em", { "aria-hidden": "true" },
                  (a.porte && a.porte.icone) || "✦"))),
    h("div.txt",
      a.porte
        ? h("div.mq", {}, L(a.porte.nom, langue() === "ar" ? "ar" : langue()))
        : null,
      h("a.nm", { href: lien("/journal/" + a.slug) }, L(a.titre)),
      L(a.chapo) ? h("p.ds", {}, L(a.chapo)) : null,
      h("div.meta", {}, date(a.publie_le))));
}

export function grilleArticles(liste) {
  return h("div.articles", {}, liste.map(carteArticle));
}

export default async function vueJournal(hote) {
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));

  remplir(hote, h("div.wrap.section",
    h("div.section-head", h("div",
      h("div.eyebrow", {}, t("journal")),
      h("h1", { style: { marginBottom: "4px" } }, t("journal_titre")),
      h("p", {}, t("journal_lede")))),
    zone));

  try {
    const liste = await journal.articles({ limite: 24 });
    if (!liste.length) {
      remplir(zone, h("div.vide-etat",
        h("div.em", {}, "📖"), h("h3", {}, t("journal_vide"))));
      return;
    }
    remplir(zone, grilleArticles(liste));
  } catch (e) {
    remplir(zone, h("div.vide-etat",
      h("div.em", {}, "⚠️"),
      h("h3", {}, e.schemaNonExpose ? t("schema_absent") : t("erreur_reseau")),
      h("p", {}, e.message || "")));
  }
  window.scrollTo(0, 0);
}
