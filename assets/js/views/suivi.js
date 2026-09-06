/* =====================================================================
   Suivi d'une commande. Sans compte, le numéro seul ne suffit pas :
   la fonction Postgres exige aussi le téléphone de la commande.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { prix, dateHeure } from "../core/format.js";
import { analyser } from "../core/routeur.js";
import * as commandes from "../data/commandes.js";

export function chronologie(statutActuel, suivi) {
  const journal = {};
  (suivi || []).forEach(function (s) { if (!journal[s.statut]) journal[s.statut] = s.cree_le; });

  if (statutActuel === "annulee") {
    return h("div.etapes", h("div.etape.active",
      h("div.puce", h("i")),
      h("div.txt", h("div.t", {}, t("st_annulee")),
        journal.annulee ? h("div.d", {}, dateHeure(journal.annulee)) : null)));
  }

  const rang = commandes.PARCOURS.indexOf(statutActuel);
  return h("div.etapes", {}, commandes.PARCOURS.map(function (s, i) {
    const classe = i < rang ? ".faite" : i === rang ? ".active" : "";
    return h("div.etape" + classe,
      h("div.puce", h("i")),
      h("div.txt",
        h("div.t", {}, t("st_" + s)),
        journal[s] ? h("div.d", {}, dateHeure(journal[s])) : null));
  }));
}

function resultat(d) {
  const c = d.commande;
  return h("div", { style: { display: "grid", gap: "20px" } },
    h("div.card.card-pad",
      h("div.row", { style: { justifyContent: "space-between", flexWrap: "wrap", gap: "10px" } },
        h("div",
          h("div.eyebrow", {}, t("numero_commande")),
          h("div", { style: { fontSize: "21px", fontWeight: "600" } }, c.numero)),
        h("span.badge" + (c.statut === "livree" ? ".badge-ok" : ""), {}, t("st_" + c.statut))),
      h("div.faint", { style: { marginTop: "8px" } },
        dateHeure(c.cree_le) + " · " + c.ville +
        (c.delai_estime ? " · " + c.delai_estime + " " + t("jours") : ""))),

    h("div.card.card-pad", h("h3", {}, t("suivi")), chronologie(c.statut, d.suivi)),

    h("div.card.card-pad",
      h("h3", {}, t("recapitulatif")),
      h("div", { style: { display: "grid", gap: "8px" } }, (d.lignes || []).map(function (l) {
        return h("div.row", { style: { gap: "10px", fontSize: "14px" } },
          h("span.grow", {}, L(l.nom) + (l.variante_nom ? " · " + L(l.variante_nom) : "") +
            "  ×" + l.quantite),
          h("span", { style: { fontVariantNumeric: "tabular-nums" } }, prix(l.total)));
      })),
      h("div.totaux", { style: { marginTop: "14px" } },
        h("div.t", {}, h("span", {}, t("sous_total")), h("span", {}, prix(c.sous_total))),
        h("div.t", {}, h("span", {}, t("livraison")),
          h("span", {}, Number(c.frais_livraison) > 0
            ? prix(c.frais_livraison) : t("livraison_offerte"))),
        Number(c.remise) ? h("div.t", {}, h("span", {}, t("remise")),
          h("span", {}, "−" + prix(c.remise))) : null,
        h("div.t.grand", {}, h("span", {}, t("total")), h("span", {}, prix(c.total))))));
}

export default function suivi(hote) {
  const { requete } = analyser();
  const zone = h("div");

  const champNumero = h("input.input", { placeholder: "EF-2026-000001",
    value: requete.get("n") || "", autocapitalize: "characters" });
  const champTel = h("input.input", { type: "tel", placeholder: "06 12 34 56 78" });
  const bouton = h("button.btn.btn-primary", { type: "submit" }, t("suivre_commande"));

  const chercher = async function (e) {
    if (e) e.preventDefault();
    const n = champNumero.value.trim(), tel = champTel.value.trim();
    if (!n || !tel) { notice(t("champ_requis"), true); return; }
    bouton.disabled = true;
    try {
      const d = await commandes.suivrePublic(n, tel);
      if (d && d.ok) remplir(zone, resultat(d));
      else remplir(zone, h("div.vide-etat",
        h("div.em", {}, "🔎"), h("h3", {}, t("aucun_resultat")),
        h("p", {}, t("aucun_resultat_d"))));
    } catch (err) { notice(err.message || t("erreur_reseau"), true); }
    bouton.disabled = false;
  };

  remplir(hote, h("div.wrap.section",
    h("h1", {}, t("suivre_commande")),
    h("form.card.card-pad", { style: { maxWidth: "560px" }, onsubmit: chercher },
      h("div.grid-2",
        h("div.field", h("label", {}, t("numero_commande")), champNumero),
        h("div.field", h("label", {}, t("telephone")), champTel)),
      bouton),
    h("div", { style: { marginTop: "24px" } }, zone)));

  if (requete.get("n")) champTel.focus();
}
