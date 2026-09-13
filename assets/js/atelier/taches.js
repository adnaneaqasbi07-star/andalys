/* =====================================================================
   Les tâches.
   ---------------------------------------------------------------------
   C'est ici que le travail des agents redevient du travail humain. Un
   agent qui trouve une donnée manquante ou propose une idée ne la met
   pas dans un rapport qu'on relira peut-être : il pose une tâche, et
   cette page est l'endroit où on la coche.

   Une tâche garde toujours son origine — quelle exécution l'a produite,
   sur quel produit elle porte. Sans ce fil, une liste de tâches devient
   en trois semaines une liste de choses dont personne ne sait plus d'où
   elles viennent.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { lire, modifier, messageErreur } from "../core/supa.js";
import { table, vide, panneau, fermerPanneau, confirmer } from "../admin/commun.js";
import { puce, mono, quand, exact, charge, ecranErreur } from "./commun.js";

const CHAMPS = "id,titre,detail,agent,origine_id,priorite,statut,echeance,cible_table,cible_id,contexte,resultat,cree_le,modifie_le";

const ONGLETS = [
  ["ouvertes",   "À faire"],
  ["a_faire",    "Pas commencées"],
  ["en_cours",   "En cours"],
  ["faite",      "Faites"],
  ["abandonnee", "Abandonnées"],
  ["",           "Toutes"]
];

const RANG = { haute: 0, normale: 1, basse: 2 };

/* Où mène une tâche qui porte sur quelque chose du catalogue. */
const VERS = {
  produits: "admin.html#/produits",
  commandes: "admin.html#/commandes",
  clients: "admin.html#/clients",
  marques: "admin.html#/marques",
  categories: "admin.html#/categories",
  articles: "admin.html#/journal",
  promotions: "admin.html#/promos"
};

function enRetard(t) {
  return t.echeance && t.statut !== "faite" && t.statut !== "abandonnee"
      && t.echeance < new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
async function changer(t, statut, recharger) {
  try {
    const valeurs = { statut: statut };
    /* Ce qui est fait est daté : `resultat` garde la trace du moment et
       de la main. `modifie_le` suit par déclencheur. */
    if (statut === "faite" || statut === "abandonnee") {
      valeurs.resultat = Object.assign({}, t.resultat || {},
        { clos_le: new Date().toISOString(), par: "humain" });
    }
    await modifier("ia_taches", { id: "eq." + t.id }, valeurs);
    notice(statut === "faite" ? "Tâche faite."
         : statut === "abandonnee" ? "Tâche abandonnée."
         : statut === "en_cours" ? "Tâche commencée."
         : "Tâche rouverte.");
    recharger();
  } catch (e) { notice(messageErreur(e), true); }
}

async function repousser(t, valeur, recharger) {
  try {
    await modifier("ia_taches", { id: "eq." + t.id }, { echeance: valeur || null });
    notice(valeur ? "Échéance au " + valeur + "." : "Échéance retirée.");
    recharger();
  } catch (e) { notice(messageErreur(e), true); }
}

/* ------------------------------------------------------------------ */
function detail(t, recharger) {
  const echeance = h("input.input", { type: "date", value: t.echeance || "" });
  echeance.addEventListener("change", function () {
    repousser(t, echeance.value, recharger);
  });

  const ouverte = t.statut === "a_faire" || t.statut === "en_cours";
  const boutons = [];
  if (t.statut === "a_faire") {
    boutons.push(h("button.btn.btn-quiet", { type: "button",
      onclick: function () { fermerPanneau(); changer(t, "en_cours", recharger); } }, "Commencer"));
  }
  if (ouverte) {
    boutons.push(h("button.btn.btn-primary", { type: "button",
      onclick: function () { fermerPanneau(); changer(t, "faite", recharger); } }, "C'est fait"));
    boutons.push(h("button.btn.btn-ghost", { type: "button",
      onclick: async function () {
        if (!await confirmer("Abandonner « " + t.titre + " » ? Elle restera au journal.")) return;
        fermerPanneau(); changer(t, "abandonnee", recharger);
      } }, "Abandonner"));
  } else {
    boutons.push(h("button.btn.btn-quiet", { type: "button",
      onclick: function () { fermerPanneau(); changer(t, "a_faire", recharger); } }, "Rouvrir"));
  }

  const cible = t.cible_table && VERS[t.cible_table]
    ? h("a", { href: VERS[t.cible_table] }, "ouvrir « " + t.cible_table + " » au back-office")
    : null;

  panneau(t.titre, h("div", {},
    h("div.row", { style: { gap: "8px", flexWrap: "wrap", marginBottom: "14px" } },
      puce(t.statut),
      h("span.badge" + (t.priorite === "haute" ? ".badge-promo" : ""), {}, t.priorite),
      t.agent ? mono(t.agent) : null,
      enRetard(t) ? h("span.badge.badge-promo", {}, "en retard") : null),

    t.detail ? h("p", { style: { lineHeight: "1.6", whiteSpace: "pre-wrap" } }, t.detail)
             : h("p.faint", {}, "Pas de détail."),

    h("div.fieldset", h("legend", {}, "Échéance"),
      h("div.field", echeance),
      h("div.hint", {}, "Vide : aucune date. Une tâche en retard remonte en tête de liste.")),

    cible ? h("div.fieldset", h("legend", {}, "Ce sur quoi elle porte"),
      h("p", { style: { margin: 0 } }, cible),
      t.cible_id ? h("p.faint", { style: { margin: "4px 0 0", fontSize: "12px" } },
                     mono(t.cible_id)) : null) : null,

    Object.keys(t.contexte || {}).length
      ? h("div.fieldset", h("legend", {}, "Contexte laissé par l'agent"),
          charge(t.contexte, "Voir les données")) : null,

    h("p.faint", { style: { fontSize: "12.5px" } },
      "Créée le " + exact(t.cree_le) +
      (t.origine_id ? " par une exécution de l'agent " + (t.agent || "?") : " à la main") +
      (t.modifie_le && t.modifie_le !== t.cree_le ? " · modifiée le " + exact(t.modifie_le) : ""))),
    boutons.concat([h("button.btn.btn-quiet", { type: "button", onclick: fermerPanneau }, "Fermer")]));
}

/* ------------------------------------------------------------------ */
export default async function taches(hote) {
  let onglet = "ouvertes";
  const zone = h("div");
  const compte = h("span.faint");

  const recherche = h("input.input.grow", { type: "search", placeholder: "Chercher une tâche…" });
  const parAgent = h("select.select", {}, h("option", { value: "" }, "Tous les agents"));

  let tout = [];

  async function charger() {
    remplir(zone, h("p.faint", {}, "Chargement…"));
    try {
      tout = await lire("ia_taches", {
        select: CHAMPS, order: "cree_le.desc", limit: 400
      });
    } catch (e) { ecranErreur(zone, e); return; }

    const agents = [];
    tout.forEach(function (t) { if (t.agent && agents.indexOf(t.agent) < 0) agents.push(t.agent); });
    remplir(parAgent, h("option", { value: "" }, "Tous les agents"),
      agents.sort().map(function (a) { return h("option", { value: a }, a); }));

    dessiner();
  }

  function dessiner() {
    const q = recherche.value.trim().toLowerCase();
    const a = parAgent.value;

    let vues = tout.filter(function (t) {
      if (onglet === "ouvertes") { if (t.statut !== "a_faire" && t.statut !== "en_cours") return false; }
      else if (onglet && t.statut !== onglet) return false;
      if (a && t.agent !== a) return false;
      if (q && (t.titre + " " + (t.detail || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    /* En retard d'abord, puis par priorité, puis par échéance : c'est
       l'ordre dans lequel on veut les voir un lundi matin. */
    vues.sort(function (x, y) {
      const rx = enRetard(x) ? 0 : 1, ry = enRetard(y) ? 0 : 1;
      if (rx !== ry) return rx - ry;
      const px = RANG[x.priorite] === undefined ? 1 : RANG[x.priorite];
      const py = RANG[y.priorite] === undefined ? 1 : RANG[y.priorite];
      if (px !== py) return px - py;
      return String(x.echeance || "9999").localeCompare(String(y.echeance || "9999"));
    });

    compte.textContent = vues.length + (vues.length > 1 ? " tâches" : " tâche");

    if (!vues.length) {
      remplir(zone, h("div.vide-etat",
        h("div.em", { "aria-hidden": "true" }, onglet === "ouvertes" ? "✓" : "∅"),
        h("h3", {}, onglet === "ouvertes" ? "Rien à faire" : "Aucune tâche dans cet état"),
        onglet === "ouvertes"
          ? h("p.faint", {}, "Les agents déposent ici ce qu'ils trouvent et ne peuvent pas "
              + "faire eux-mêmes : une donnée manquante, une idée à instruire.")
          : null));
      return;
    }

    remplir(zone, table(
      ["Tâche", "Agent", "Priorité", "Échéance", "État", ""],
      vues, function (t) {
        const close = t.statut === "faite" || t.statut === "abandonnee";
        return h("tr",
          h("td", { style: { maxWidth: "460px" } },
            h("div", { style: close ? { textDecoration: "line-through", opacity: ".6" } : {} },
              h("strong", {}, t.titre)),
            t.detail ? h("span.faint", { style: { fontSize: "12.5px" } },
                         t.detail.slice(0, 120) + (t.detail.length > 120 ? "…" : "")) : null),
          h("td", {}, t.agent ? mono(t.agent) : h("span.faint", {}, "—")),
          h("td", {}, h("span.badge" + (t.priorite === "haute" ? ".badge-promo" : ""), {}, t.priorite)),
          h("td", {}, t.echeance
            ? h("span" + (enRetard(t) ? ".j-echec" : ""), {}, t.echeance)
            : h("span.faint", {}, "—")),
          h("td", {}, puce(t.statut)),
          h("td", {}, h("div.row", { style: { gap: "6px", justifyContent: "flex-end" } },
            !close ? h("button.btn.btn-quiet.btn-sm", {
              type: "button", title: "Marquer faite",
              onclick: function () { changer(t, "faite", charger); } }, "✓") : null,
            h("button.btn.btn-quiet.btn-sm", {
              type: "button", onclick: function () { detail(t, charger); } }, "Voir"))));
      }));
  }

  const barre = h("div.outils", {}, ONGLETS.map(function (o) {
    return h("button.btn.btn-sm" + (o[0] === onglet ? ".btn-primary" : ".btn-quiet"), {
      type: "button", "data-onglet": o[0],
      onclick: function () {
        onglet = o[0];
        Array.prototype.forEach.call(barre.querySelectorAll("button[data-onglet]"), function (b) {
          const actif = b.getAttribute("data-onglet") === onglet;
          b.classList.toggle("btn-primary", actif);
          b.classList.toggle("btn-quiet", !actif);
        });
        dessiner();
      }
    }, o[1]);
  }));

  recherche.addEventListener("input", dessiner);
  parAgent.addEventListener("change", dessiner);

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Tâches"), compte),
    barre,
    h("div.outils", recherche, parAgent),
    zone);

  await charger();
}
