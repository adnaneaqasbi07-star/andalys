/* Liste des favoris. */

import { h, remplir } from "../core/dom.js";
import { t } from "../i18n/index.js";
import { lien } from "../core/routeur.js";
import { etat } from "../core/etat.js";
import * as catalogue from "../data/catalogue.js";
import { grille, squelettes } from "../ui/carte.js";

export default async function favoris(hote) {
  const ids = Array.from(etat.favoris);
  const zone = h("div", {}, ids.length ? squelettes(4) : null);

  remplir(hote, h("div.wrap.section", h("h1", {}, t("mes_favoris")), zone));

  if (!ids.length) {
    remplir(zone, h("div.vide-etat",
      h("div.em", {}, "♡"),
      h("h3", {}, t("aucun_favori")),
      h("p", {}, t("aucun_favori_d")),
      h("a.btn.btn-primary", { href: lien("/produits"), style: { marginTop: "14px" } },
        t("nos_produits"))));
    return;
  }

  try {
    const liste = await catalogue.parIds(ids);
    if (!liste.length) {
      remplir(zone, h("div.vide-etat", h("div.em", {}, "♡"), h("h3", {}, t("aucun_favori"))));
      return;
    }
    remplir(zone, grille(liste));
  } catch (e) {
    remplir(zone, h("div.vide-etat", h("div.em", {}, "⚠️"), h("h3", {}, t("erreur_reseau"))));
  }
}
