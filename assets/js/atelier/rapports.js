/* =====================================================================
   Les rapports de veille.
   ---------------------------------------------------------------------
   Un rapport constate un état du marché à une date donnée. Il ne se
   modifie pas — la base le refuse au lanceur comme à cette page — et il
   ne vit pas sans ses sources : `ia_rapports.sources` ne peut pas être un
   tableau vide. Cet écran ne fait donc que lire, et il montre toujours
   d'où vient ce qu'il affiche.
   ===================================================================== */

import { h, remplir } from "../core/dom.js";
import { lire } from "../core/supa.js";
import { table, vide, panneau, fermerPanneau } from "../admin/commun.js";
import { quand, exact, relatif, ecranErreur } from "./commun.js";

/* Une rubrique du rapport, rendue selon la forme de ses entrées. */
function rubrique(titre, entrees, dessiner) {
  if (!entrees || !entrees.length) return null;
  return h("div.fieldset",
    h("legend", {}, titre + " (" + entrees.length + ")"),
    h("div", { style: { display: "grid", gap: "10px" } }, entrees.map(dessiner)));
}

function ligneSource(s) {
  /* Adresse extérieure : nouvelle fenêtre, et jamais d'accès à l'ouvreur. */
  return h("div.rangee",
    h("a.grow", { href: s.url, target: "_blank", rel: "noopener noreferrer",
                  title: s.url }, s.titre || s.url),
    s.recueilli_le ? h("span.quand", { title: exact(s.recueilli_le) },
                       "consultée " + relatif(s.recueilli_le)) : null);
}

function detail(r) {
  const c = r.contenu || {};
  const zone = h("div", {},
    h("p.faint", { style: { marginTop: 0, fontSize: "13px" } },
      [r.marche, r.periode, "relevé le " + exact(r.cree_le)].filter(Boolean).join(" · ")),

    h("div.fieldset", h("legend", {}, "Résumé exécutif"),
      h("p", { style: { margin: 0, lineHeight: "1.6" } }, r.resume)),

    rubrique("Tendances", c.tendances, function (t) {
      return h("div", {}, h("strong", {}, t.titre),
        h("p.faint", { style: { margin: "2px 0 0", fontSize: "13.5px" } }, t.constat),
        t.source ? h("div", {}, h("a", { href: t.source, target: "_blank",
                                         rel: "noopener noreferrer",
                                         style: { fontSize: "12px" } }, t.source)) : null);
    }),

    rubrique("Concurrents", c.concurrents, function (x) {
      return h("div", {}, h("strong", {}, x.nom),
        h("p.faint", { style: { margin: "2px 0 0", fontSize: "13.5px" } },
          [x.positionnement, x.prix_observes].filter(Boolean).join(" — ")),
        x.source ? h("div", {}, h("a", { href: x.source, target: "_blank",
                                         rel: "noopener noreferrer",
                                         style: { fontSize: "12px" } }, x.source)) : null);
    }),

    rubrique("Opportunités", c.opportunites, function (o) {
      return h("div", {}, h("strong", {}, o.titre),
        h("p.faint", { style: { margin: "2px 0 0", fontSize: "13.5px" } }, o.pourquoi));
    }),

    rubrique("Risques", c.risques, function (x) {
      return h("div.rangee", h("span.grow", {}, x.titre),
        h("span.badge", {}, x.gravite || "—"));
    }),

    rubrique("Actions proposées", c.actions, function (a) {
      return h("div", {},
        h("div.rangee", h("strong.grow", {}, a.titre),
          h("span.badge" + (a.priorite === "haute" ? ".badge-promo" : ""), {}, a.priorite || "normale")),
        a.detail ? h("p.faint", { style: { margin: "2px 0 0", fontSize: "13.5px" } }, a.detail) : null);
    }),

    /* Ce que la veille n'a PAS trouvé. C'est une information, pas un
       échec : une lacune nommée vaut mieux qu'un chiffre inventé. */
    rubrique("Ce qui n'a pas été trouvé", c.lacunes, function (l) {
      return h("div.faint", { style: { fontSize: "13.5px" } }, "· " + l);
    }),

    h("div.fieldset", h("legend", {}, "Sources (" + (r.sources || []).length + ")"),
      h("div.liste-fine", {}, (r.sources || []).map(ligneSource))),

    c.rapport_brut
      ? h("details.repli", h("summary", {}, "Le rapport tel que l'agent l'a écrit"),
          h("pre.charge", { style: { whiteSpace: "pre-wrap" } }, c.rapport_brut))
      : null);

  panneau(r.sujet, zone,
    [h("button.btn.btn-ghost", { type: "button", onclick: fermerPanneau }, "Fermer")]);
}

/* ------------------------------------------------------------------ */
export default async function rapports(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Veille")), h("p.faint", {}, "Chargement…"));

  let liste;
  try {
    liste = await lire("ia_rapports", {
      select: "id,agent,execution_id,sujet,marche,periode,resume,contenu,sources,cree_le",
      order: "cree_le.desc", limit: 100
    });
  } catch (e) { ecranErreur(hote, e); return; }

  const recherche = h("input.input.grow", { type: "search", placeholder: "Chercher un sujet…" });
  const zone = h("div");

  function dessiner() {
    const q = recherche.value.trim().toLowerCase();
    const vues = q
      ? liste.filter(function (r) {
          return (r.sujet + " " + (r.resume || "")).toLowerCase().indexOf(q) >= 0;
        })
      : liste;

    remplir(zone, vues.length
      ? table(["Sujet", "Marché", "Période", "Sources", "Relevé", ""], vues, function (r) {
          return h("tr",
            h("td", {}, h("div", {}, h("strong", {}, r.sujet)),
              h("span.faint", { style: { fontSize: "12.5px" } },
                (r.resume || "").slice(0, 110) + ((r.resume || "").length > 110 ? "…" : ""))),
            h("td", {}, r.marche || "—"),
            h("td", {}, h("span.faint", { style: { fontSize: "12.5px" } }, r.periode || "—")),
            h("td", {}, h("span.badge", {}, (r.sources || []).length)),
            h("td", {}, quand(r.cree_le)),
            h("td", {}, h("button.btn.btn-quiet.btn-sm", {
              type: "button", onclick: function () { detail(r); } }, "Lire")));
        })
      : vide(q ? "Aucun rapport sur ce sujet" : "Aucune veille encore"));
  }

  recherche.addEventListener("input", dessiner);

  remplir(hote,
    h("div.adm-tete",
      h("h1", {}, "Veille"),
      h("span.faint", {}, liste.length + (liste.length > 1 ? " rapports" : " rapport")),
      h("span.grow"),
      h("span.faint", { style: { fontSize: "12.5px" },
                        title: "Un rapport constate une date. La base en refuse la réécriture." },
        "🔒 non modifiable")),
    h("div.outils", recherche),
    zone);

  dessiner();
}
