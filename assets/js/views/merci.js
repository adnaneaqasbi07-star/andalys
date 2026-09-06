/* Confirmation de commande. */

import { h, remplir } from "../core/dom.js";
import { t } from "../i18n/index.js";
import { lien } from "../core/routeur.js";
import { marque } from "../ui/logo.js";

export default function merci(hote, params) {
  const numero = params.numero || "";
  remplir(hote, h("div.wrap.section",
    h("div.card.card-pad", {
      style: { maxWidth: "560px", margin: "0 auto", textAlign: "center", padding: "40px 28px" }
    },
      h("div", { style: { display: "grid", placeItems: "center", marginBottom: "16px" } }, marque(56)),
      h("h1", {}, t("merci")),
      h("p.muted", {}, t("merci_d")),
      numero ? h("div", {
        style: { margin: "22px 0", padding: "16px", background: "var(--gold-wash)",
                 borderRadius: "var(--r)" }
      },
        h("div.eyebrow", {}, t("numero_commande")),
        h("div", { style: { fontSize: "24px", fontWeight: "600", letterSpacing: ".04em" } }, numero)) : null,
      h("div.row", { style: { justifyContent: "center", gap: "10px", flexWrap: "wrap" } },
        h("a.btn.btn-primary", { href: lien("/suivi?n=" + encodeURIComponent(numero)) },
          t("suivre_commande")),
        h("a.btn.btn-ghost", { href: lien("/produits") }, t("continuer_achats"))))));
  window.scrollTo(0, 0);
}
