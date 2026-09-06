/* =====================================================================
   Pages éditoriales : conditions de vente, confidentialité, mentions,
   contact. Le texte vient de boutique.parametres, ce qui permet de le
   modifier depuis le back-office sans redéployer.
   ===================================================================== */

import { h, remplir } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { etat } from "../core/etat.js";
import { lien } from "../core/routeur.js";

const TITRES = {
  conditions:      "conditions",
  confidentialite: "confidentialite",
  mentions:        "mentions",
  contact:         "contact"
};

export default function page(hote, params) {
  const cle = params.slug;
  const b = etat.parametres.boutique || {};
  const contenu = (etat.parametres["page_" + cle]) || null;

  const corps = contenu
    ? h("div", { style: { whiteSpace: "pre-line" } }, L(contenu))
    : cle === "contact"
      ? h("div", { style: { display: "grid", gap: "10px" } },
          b.telephone ? h("p", {}, "📞 ", h("a", { href: "tel:" + b.telephone }, b.telephone)) : null,
          b.whatsapp  ? h("p", {}, "💬 ", h("a", {
            href: "https://wa.me/" + String(b.whatsapp).replace(/\D/g, ""), rel: "noopener"
          }, "WhatsApp")) : null,
          b.email     ? h("p", {}, "✉️ ", h("a", { href: "mailto:" + b.email }, b.email)) : null,
          L(b.adresse) ? h("p", {}, "📍 " + L(b.adresse)) : null,
          !b.telephone && !b.email
            ? h("p.faint", {}, t("chargement"))
            : null)
      : h("p.faint", {}, t("chargement"));

  remplir(hote, h("div.wrap.section",
    h("div", { style: { maxWidth: "740px" } },
      h("h1", {}, t(TITRES[cle] || "aide")),
      corps,
      h("p", { style: { marginTop: "28px" } },
        h("a.btn.btn-ghost", { href: lien("/") }, t("accueil"))))));
  window.scrollTo(0, 0);
}
