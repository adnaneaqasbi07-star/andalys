/* =====================================================================
   Le journal des agents.
   ---------------------------------------------------------------------
   En ajout seul : ni cette page, ni la clé de service, ni le
   superutilisateur ne peuvent réécrire une ligne — un déclencheur Postgres
   refuse `update` et `delete`. Il n'y a donc ici ni bouton de
   modification, ni bouton de suppression, et ce n'est pas un oubli.

   À ne pas confondre avec le « Journal » du back-office, qui est le
   magazine de la boutique. Celui-ci est le registre de sécurité.
   ===================================================================== */

import { h, remplir } from "../core/dom.js";
import { lire } from "../core/supa.js";
import { table, vide } from "../admin/commun.js";   /* briques d'interface partagées */
import { puce, mono, quand, exact, charge, ecranErreur, VALIDATIONS } from "./commun.js";

const PAGE = 100;

export default async function journal(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Journal")), h("p.faint", {}, "Chargement…"));

  let lignes, agents;
  try {
    lignes = await lire("ia_audit", {
      select: "id,cree_le,agent,acteur,action,cible_table,cible_id,donnees,resultat,execution_id,validation_id,validation,detail",
      order: "cree_le.desc", limit: PAGE
    });
    agents = await lire("ia_agents", { select: "code,nom", order: "code.asc" });
  } catch (e) { ecranErreur(hote, e); return; }

  const noms = {};
  agents.forEach(function (a) { noms[a.code] = a.nom; });

  const filtreAgent = h("select.select", {},
    h("option", { value: "" }, "Tous les agents"),
    agents.map(function (a) { return h("option", { value: a.code }, a.nom); }));
  const filtreResultat = h("select.select", {},
    h("option", { value: "" }, "Tous les résultats"),
    h("option", { value: "succes" }, "Succès"),
    h("option", { value: "echec" }, "Échecs"),
    h("option", { value: "refuse" }, "Refus"));
  const recherche = h("input.input.grow", { type: "search", placeholder: "Chercher une action…" });

  const zone = h("div");

  function dessiner() {
    const a = filtreAgent.value, r = filtreResultat.value;
    const q = recherche.value.trim().toLowerCase();

    const vues = lignes.filter(function (l) {
      if (a && l.agent !== a) return false;
      if (r && l.resultat !== r) return false;
      if (q && (l.action + " " + (l.cible_table || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    remplir(zone, vues.length
      ? table(["Quand", "Agent", "Action", "Cible", "Résultat", "Validation", ""],
          vues, function (l) {
            const detail = h("tr", { hidden: true },
              h("td", { colspan: 7 },
                charge({ donnees: l.donnees, detail: l.detail }, "Données utilisées")));

            const ligne = h("tr",
              h("td", {}, quand(l.cree_le)),
              h("td", {}, l.agent ? (noms[l.agent] || l.agent)
                                  : h("span.faint", {}, l.acteur ? "humain" : "système")),
              h("td", {}, mono(l.action)),
              h("td", {}, l.cible_table
                ? h("span.faint", { style: { fontSize: "12.5px" },
                                    title: l.cible_id || "" }, l.cible_table)
                : "—"),
              h("td", {}, h("span" + (l.resultat === "echec" ? ".j-echec"
                                     : l.resultat === "refuse" ? ".j-refuse" : ""),
                  {}, puce(l.resultat))),
              h("td", {}, l.validation_id
                ? h("a", { href: "#/validations/" + l.validation_id },
                    VALIDATIONS[l.validation] || l.validation || "voir le dossier")
                : h("span.faint", {}, VALIDATIONS[l.validation] || l.validation || "—")),
              h("td", {}, h("button.btn.btn-quiet.btn-sm", {
                type: "button", "aria-expanded": "false",
                onclick: function (e) {
                  detail.hidden = !detail.hidden;
                  e.currentTarget.setAttribute("aria-expanded", String(!detail.hidden));
                }
              }, "Données")));

            /* `table()` attend une ligne par entrée : on rend un fragment
               qui en porte deux, celle qu'on lit et celle qu'on déplie. */
            const frag = document.createDocumentFragment();
            frag.appendChild(ligne);
            frag.appendChild(detail);
            return frag;
          })
      : vide("Aucune ligne ne correspond"));
  }

  [filtreAgent, filtreResultat].forEach(function (s) { s.addEventListener("change", dessiner); });
  recherche.addEventListener("input", dessiner);

  remplir(hote,
    h("div.adm-tete",
      h("h1", {}, "Journal"),
      h("span.faint", {}, lignes.length + " dernières lignes"),
      h("span.grow"),
      h("span.faint", { style: { fontSize: "12.5px" },
                        title: "Un déclencheur Postgres refuse update et delete sur ia_audit" },
        "🔒 en ajout seul")),
    h("div.outils", recherche, filtreAgent, filtreResultat),
    zone);

  dessiner();
  if (lignes.length) {
    zone.appendChild(h("p.faint", { style: { marginTop: "12px", fontSize: "12.5px" } },
      "La plus ancienne ligne affichée date du " + exact(lignes[lignes.length - 1].cree_le) + "."));
  }
}
