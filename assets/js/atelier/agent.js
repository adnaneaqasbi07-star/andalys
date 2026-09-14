/* =====================================================================
   L'état d'un agent — tout ce qui le concerne, sur un écran.
   ---------------------------------------------------------------------
   La liste des agents dit qui existe ; celle-ci dit comment celui-là se
   porte. C'est l'écran qu'on ouvre quand on se demande « pourquoi cet
   agent n'a rien produit depuis mardi ».

   L'ordre des blocs est celui des questions qu'on se pose vraiment :
   est-il allumé, a-t-il sa clé, quand est-il passé pour la dernière
   fois, qu'a-t-il coûté, qu'attend-il de moi, et qu'a-t-il fait.
   ===================================================================== */

import { h, remplir } from "../core/dom.js";
import { lire } from "../core/supa.js";
import { table, vide } from "../admin/commun.js";
import { niveau, puce, mono, quand, exact, duree, cout, charge, ecranErreur,
         DECLENCHEURS, SERVICES, conseilPour, porteLocale, cleParNom } from "./commun.js";

function bloc(cle, valeur, detail, options) {
  options = options || {};
  return h("div.stat" + (options.urgent ? ".urgent" : ""),
    h("div.k", {}, cle),
    options.lien ? h("a.v", { href: options.lien }, valeur) : h("div.v", {}, valeur),
    detail ? h("div.d", {}, detail) : null);
}

export default async function agent(hote, params) {
  const code = params && params.code;
  if (!code) { remplir(hote, vide("Aucun agent demandé")); return; }

  remplir(hote, h("div.adm-tete", h("h1", {}, code)), h("p.faint", {}, "Chargement…"));

  let a, passages, taches, validations, plans, rapports;
  try {
    a = (await lire("ia_agents", {
      select: "code,nom,mission,niveau_max,modele,fournisseur,cle_env,config,actif,cree_le",
      where: { code: "eq." + code }
    }))[0];
    if (!a) { remplir(hote, vide("Aucun agent « " + code + " » en base")); return; }

    passages = await lire("ia_executions", {
      select: "id,agent,declencheur,statut,erreur,debut,fin,cout_usd,jetons_entree,jetons_sortie,entree,sortie",
      where: { agent: "eq." + code }, order: "debut.desc", limit: 40
    });
    taches = await lire("ia_taches", {
      select: "id,titre,statut,priorite,echeance,cree_le",
      where: { agent: "eq." + code }, order: "cree_le.desc", limit: 40
    });
    validations = await lire("ia_validations", {
      select: "id,action,niveau,resume,statut,cree_le",
      where: { agent: "eq." + code }, order: "cree_le.desc", limit: 20
    });
    plans = await lire("ia_planifications", {
      select: "id,libelle,cadence,actif,dernier_essai,derniere_reussite",
      where: { agent: "eq." + code }, order: "libelle.asc"
    });
    rapports = code === "recherche"
      ? await lire("ia_rapports", { select: "id,sujet,cree_le",
                                    where: { agent: "eq." + code },
                                    order: "cree_le.desc", limit: 5 })
      : [];
  } catch (e) { ecranErreur(hote, e); return; }

  const local = await porteLocale();
  const service = SERVICES[a.fournisseur || "anthropic"] || SERVICES.anthropic;
  const variable = a.cle_env || service.variable;
  const etatCle = cleParNom(local, variable);
  const c = conseilPour(a.code);

  const ouvertes = taches.filter(function (t) {
    return t.statut === "a_faire" || t.statut === "en_cours";
  });
  const attente = validations.filter(function (v) { return v.statut === "en_attente"; });
  const echecs = passages.filter(function (p) { return p.statut === "echoue"; });
  const total = passages.reduce(function (s, p) { return s + (Number(p.cout_usd) || 0); }, 0);
  const derniere = passages[0];

  /* Ce qui empêche cet agent de tourner, dit en clair et en haut. Un
     agent éteint, sans clé ou sans planification ne « ne marche pas » :
     il n'est pas appelé, ce qui n'est pas la même chose. */
  const empechements = [];
  if (!a.actif) empechements.push("il est éteint — l'interrupteur est dans la liste des agents");
  if (local && etatCle && !etatCle.posee) {
    empechements.push("sa clé « " + variable + " » n'est pas posée dans .env");
  }
  if (!plans.filter(function (p) { return p.actif; }).length) {
    empechements.push("aucune planification active : il ne part que lancé à la main");
  }

  remplir(hote,
    h("div.adm-tete",
      h("a.btn.btn-quiet.btn-sm", { href: "#/agents" }, "← Agents"),
      h("h1", {}, a.nom),
      niveau(a.niveau_max),
      a.actif ? null : h("span.badge", {}, "éteint"),
      h("span.grow"),
      mono(a.code)),

    h("p.faint", { style: { marginTop: 0, maxWidth: "70ch", lineHeight: "1.6" } }, a.mission),

    empechements.length
      ? h("div.stat.urgent", { style: { marginBottom: "16px" } },
          h("div.k", {}, empechements.length > 1 ? "Ce qui l'empêche de tourner"
                                                 : "Ce qui l'empêche de tourner"),
          h("ul", { style: { margin: "8px 0 0", paddingInlineStart: "18px",
                             fontSize: "14px", lineHeight: "1.7" } },
            empechements.map(function (e) { return h("li", {}, e); })))
      : null,

    h("div.stats",
      bloc("Dernier passage", derniere ? quand(derniere.debut).textContent : "jamais",
        derniere ? (puce(derniere.statut).textContent
                    + " · " + duree(derniere.debut, derniere.fin)) : null),
      bloc("Échecs récents", String(echecs.length),
        echecs.length ? "sur " + passages.length + " passages" : "aucun",
        { urgent: echecs.length > 0 }),
      bloc("Coût cumulé", cout(total), passages.length + " passages connus"),
      bloc("À valider", String(attente.length),
        attente.length ? "en attente de vous" : "rien",
        { urgent: attente.length > 0, lien: "#/validations" }),
      bloc("Tâches ouvertes", String(ouvertes.length), null, { lien: "#/taches" })),

    h("div.duo",
      /* Réglages */
      h("div.stat",
        h("div.k", {}, "Réglages"),
        h("div.liste-fine", {},
          h("div.rangee", h("span.grow", {}, "Fournisseur"), h("strong", {}, a.fournisseur || "anthropic")),
          h("div.rangee", h("span.grow", {}, "Modèle"), mono(a.modele || "—")),
          h("div.rangee", h("span.grow", {}, "Clé"), mono(variable)),
          h("div.rangee", h("span.grow", {}, "Plafond de risque"), niveau(a.niveau_max)),
          h("div.rangee", h("span.grow", {}, "Conseillé"),
            ((a.fournisseur || "anthropic") === c.fournisseur && a.modele === c.modele)
              ? h("span.badge.badge-ok", {}, "c'est le réglage actuel")
              : h("span.badge", { title: c.pourquoi }, c.fournisseur + " · " + c.modele))),
        h("div.row", { style: { gap: "8px", marginTop: "12px", flexWrap: "wrap" } },
          h("a.btn.btn-quiet.btn-sm", { href: "#/agents" }, "Régler"),
          h("a.btn.btn-quiet.btn-sm", { href: "#/cles" },
            etatCle ? (etatCle.posee ? "Clé posée ✓" : "Poser la clé") : "Clés"),
          h("a.btn.btn-quiet.btn-sm", { href: "#/cadence" }, "Planifier")),
        Object.keys(a.config || {}).length
          ? h("div", { style: { marginTop: "10px" } }, charge(a.config, "Sa configuration"))
          : h("p.faint", { style: { marginTop: "10px", marginBottom: 0, fontSize: "13px" } },
              "Aucune configuration particulière.")),

      /* Planifications */
      h("div.stat",
        h("div.k", {}, "Quand il part"),
        plans.length
          ? h("div.liste-fine", {}, plans.map(function (p) {
              return h("div.rangee",
                h("span.grow", { title: p.cadence }, p.libelle),
                mono(p.cadence),
                p.actif ? h("span.badge.badge-ok", {}, "active")
                        : h("span.badge", {}, "en sommeil"));
            }))
          : h("p.faint", { style: { marginTop: "8px" } },
              "Aucune planification. Il ne part que lancé à la main."),
        rapports.length
          ? h("div", { style: { marginTop: "14px" } },
              h("div.k", {}, "Derniers rapports"),
              h("div.liste-fine", {}, rapports.map(function (x) {
                return h("div.rangee", h("a.grow", { href: "#/veille" }, x.sujet),
                  quand(x.cree_le));
              })))
          : null)),

    h("div.adm-tete", { style: { marginTop: "26px" } },
      h("h1", { style: { fontSize: "20px" } }, "Ses passages")),

    passages.length
      ? table(["Déclenchée", "Statut", "Début", { titre: "Durée", num: true },
               { titre: "Jetons", num: true }, { titre: "Coût", num: true }, ""],
          passages, function (p) {
            const detail = h("tr", { hidden: true },
              h("td", { colspan: 7 },
                p.erreur
                  ? h("p", { style: { color: "var(--danger)", margin: "0 0 8px" } }, p.erreur)
                  : null,
                charge({ entree: p.entree, sortie: p.sortie }, "Entrée et sortie")));
            const ligne = h("tr",
              h("td", {}, h("span.faint", { style: { fontSize: "13px" } },
                DECLENCHEURS[p.declencheur] || p.declencheur)),
              h("td", {}, puce(p.statut)),
              h("td", { title: exact(p.debut) }, quand(p.debut)),
              h("td.num", {}, duree(p.debut, p.fin)),
              h("td.num", {}, (Number(p.jetons_entree) || 0) + (Number(p.jetons_sortie) || 0) || "—"),
              h("td.num", {}, cout(p.cout_usd)),
              h("td", {}, h("button.btn.btn-quiet.btn-sm", {
                type: "button", "aria-expanded": "false",
                onclick: function (e) {
                  detail.hidden = !detail.hidden;
                  e.currentTarget.setAttribute("aria-expanded", String(!detail.hidden));
                }
              }, "Détail")));
            const frag = document.createDocumentFragment();
            frag.appendChild(ligne);
            frag.appendChild(detail);
            return frag;
          })
      : h("p.faint", {}, "Il n'a encore jamais tourné."));
}
