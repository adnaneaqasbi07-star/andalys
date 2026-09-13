/* =====================================================================
   Le résumé du jour.
   ---------------------------------------------------------------------
   Tout vient d'un seul appel : `boutique.ia_resume()`. Postgres compte,
   la page affiche — la même règle que le tableau de bord de la boutique.
   Un aller-retour, pas dix.
   ===================================================================== */

import { h, remplir } from "../core/dom.js";
import { nombre } from "../core/format.js";
import { rpc } from "../core/supa.js";
import { niveau, quand, cout, ecranErreur, signalerAttente } from "./commun.js";

const JOURS = 7;

function stat(cle, valeur, detail, options) {
  options = options || {};
  const v = options.lien
    ? h("a.v", { href: options.lien }, valeur)
    : h("div.v", {}, valeur);
  return h("div.stat" + (options.urgent ? ".urgent" : ""),
    h("div.k", {}, cle), v, detail ? h("div.d", {}, detail) : null);
}

function ligneAgent(a) {
  return h("div.rangee",
    h("span.grow", { title: a.nom }, a.nom),
    a.echecs ? h("span.badge.badge-promo", {}, a.echecs + " éch.") : null,
    a.actif ? niveau(a.niveau_max) : h("span.badge", {}, "éteint"),
    quand(a.derniere));
}

export default async function accueil(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Atelier")),
    h("p.faint", {}, "Chargement…"));

  let s;
  try { s = await rpc("ia_resume", { p_jours: JOURS }); }
  catch (e) { ecranErreur(hote, e); return; }

  if (!s || !s.ok) {
    remplir(hote, h("div.vide-etat", h("div.em", { "aria-hidden": "true" }, "🔒"),
      h("h3", {}, "Accès refusé")));
    return;
  }

  signalerAttente(s.validations_en_attente);

  const agents = s.agents || [];
  const erreurs = s.dernieres_erreurs || [];
  const allumes = agents.filter(function (a) { return a.actif; });
  const jamais = agents.every(function (a) { return !a.derniere; });

  remplir(hote,
    h("div.adm-tete",
      h("h1", {}, "Atelier"),
      h("span.faint.grow", {}, JOURS + " derniers jours")),

    h("div.stats",
      stat("À valider", nombre(s.validations_en_attente),
        s.validations_rouges ? s.validations_rouges + " au niveau rouge" : "rien d'urgent",
        { urgent: s.validations_en_attente > 0, lien: "#/validations" }),
      stat("Tâches ouvertes", nombre(s.taches_ouvertes),
        s.taches_en_retard ? s.taches_en_retard + " en retard" : null,
        { urgent: s.taches_en_retard > 0, lien: "#/taches" }),
      stat("Exécutions", nombre(s.executions),
        (s.executions_en_cours ? s.executions_en_cours + " en cours · " : "") +
        (s.executions_echouees ? s.executions_echouees + " échouées" : "aucun échec")),
      stat("Coût de la période", cout(s.cout_usd), "API Claude")),

    /* Tant que le lanceur n'existe pas, aucun agent ne s'est jamais
       exécuté. Le dire franchement vaut mieux que quatre zéros muets. */
    jamais
      ? h("div.stat", { style: { marginTop: "16px" } },
          h("div.k", {}, "Aucun agent n'a encore tourné"),
          h("p.faint", { style: { marginTop: "8px", marginBottom: 0 } },
            "Les " + agents.length + " agents sont déclarés en base, " + allumes.length +
            " sont allumés, mais rien ne les appelle encore : le lanceur " +
            "(phase 4) reste à écrire. En attendant, tout ce qui arrive ici " +
            "peut être déposé à la main depuis un script ou depuis Supabase."))
      : null,

    h("div.duo",
      h("div.stat",
        h("div.k", {}, "Les agents"),
        agents.length
          ? h("div.liste-fine", {}, agents.map(ligneAgent))
          : h("p.faint", { style: { marginTop: "8px" } }, "Aucun agent déclaré")),

      h("div.stat",
        h("div.k", {}, "Dernières erreurs"),
        erreurs.length
          ? h("div.liste-fine", {}, erreurs.map(function (e) {
              return h("div", {},
                h("div.rangee",
                  h("span.grow", {}, e.agent),
                  quand(e.debut)),
                h("p.faint", { style: { margin: "2px 0 0", fontSize: "13px" } },
                  e.erreur || "sans message"));
            }))
          : h("p.faint", { style: { marginTop: "8px" } },
              "Aucune exécution en échec sur la période"))));
}
