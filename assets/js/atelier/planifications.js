/* =====================================================================
   Les planifications — ce qui part tout seul.
   ---------------------------------------------------------------------
   Une expression cron est exacte et illisible. Cet écran la relit en
   français sous le champ, et annonce le prochain départ : c'est ce qui
   empêche d'écrire « 0 8 * * 1 » en croyant dire « tous les jours à 8 h ».

   Il ne lance rien lui-même. C'est `bin/lanceur.py --tour`, appelé par
   cron, qui lit cette table. Tant que la ligne de crontab n'est pas
   posée, ces planifications sont des intentions — et l'écran le dit.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { lire, inserer, modifier, supprimer, messageErreur } from "../core/supa.js";
import { table, vide, panneau, fermerPanneau, confirmer } from "../admin/commun.js";
import { mono, quand, exact, ecranErreur } from "./commun.js";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"];

const MODELES = [
  ["0 8 * * *",    "chaque jour à 8 h"],
  ["0 3 * * *",    "chaque nuit à 3 h"],
  ["0 8 * * 1",    "chaque lundi à 8 h"],
  ["0 9 1 * *",    "le 1er de chaque mois à 9 h"],
  ["*/30 * * * *", "toutes les demi-heures"]
];

/* ------------------------------------------------------------------ */
/* Lire une cadence                                                    */
/* ------------------------------------------------------------------ */
function champ(expression, valeur, mini, maxi) {
  const morceaux = String(expression).split(",");
  for (let i = 0; i < morceaux.length; i++) {
    let m = morceaux[i], pas = 1;
    if (m.indexOf("/") >= 0) { const p = m.split("/"); m = p[0]; pas = Number(p[1]) || 1; }
    let debut, fin;
    if (m === "*" || m === "") { debut = mini; fin = maxi; }
    else if (m.indexOf("-") > 0) { const p = m.split("-"); debut = Number(p[0]); fin = Number(p[1]); }
    else { debut = fin = Number(m); }
    if (valeur >= debut && valeur <= fin && (valeur - debut) % pas === 0) return true;
  }
  return false;
}

export function correspond(cadence, date) {
  const c = String(cadence).trim().split(/\s+/);
  if (c.length !== 5) return false;
  const js = date.getDay();                       /* 0 = dimanche, comme cron */
  return champ(c[0], date.getMinutes(), 0, 59)
      && champ(c[1], date.getHours(), 0, 23)
      && champ(c[2], date.getDate(), 1, 31)
      && champ(c[3], date.getMonth() + 1, 1, 12)
      && (champ(c[4], js, 0, 6) || champ(c[4], js === 0 ? 7 : js, 0, 7));
}

/** Le prochain départ, cherché minute par minute sur quarante jours.
    Comme dans le lanceur : la boucle est bête, et personne ne l'a jamais
    déboguée. */
export function prochain(cadence, depuis) {
  const d = new Date(depuis || Date.now());
  d.setSeconds(0, 0);
  for (let i = 1; i <= 40 * 24 * 60; i++) {
    d.setMinutes(d.getMinutes() + 1);
    if (correspond(cadence, d)) return new Date(d);
  }
  return null;
}

/** La même chose, en français. Approximatif par construction : on couvre
    les formes qu'on écrit vraiment, et l'on rend l'expression brute pour
    le reste plutôt que d'inventer une phrase fausse. */
export function enFrancais(cadence) {
  const c = String(cadence || "").trim().split(/\s+/);
  if (c.length !== 5) return "cadence mal formée";
  const mn = c[0], hr = c[1], jr = c[2], ms = c[3], sm = c[4];

  if (mn.indexOf("*/") === 0 && hr === "*" && jr === "*" && ms === "*" && sm === "*") {
    const n = Number(mn.slice(2));
    return n === 1 ? "chaque minute" : "toutes les " + n + " minutes";
  }
  if (mn === "0" && hr.indexOf("*/") === 0 && jr === "*" && ms === "*" && sm === "*") {
    const n = Number(hr.slice(2));
    return n === 1 ? "chaque heure" : "toutes les " + n + " heures";
  }

  const heure = (/^\d+$/.test(hr) && /^\d+$/.test(mn))
    ? "à " + Number(hr) + " h " + String(mn).padStart(2, "0") : null;
  if (!heure) return cadence;

  if (jr === "*" && ms === "*" && sm === "*") return "chaque jour " + heure;
  if (jr === "*" && ms === "*" && /^\d+$/.test(sm)) {
    return "chaque " + JOURS[Number(sm) % 7] + " " + heure;
  }
  if (/^\d+$/.test(jr) && ms === "*" && sm === "*") {
    return "le " + (jr === "1" ? "1er" : jr) + " de chaque mois " + heure;
  }
  if (/^\d+$/.test(jr) && /^\d+$/.test(ms) && sm === "*") {
    return "le " + jr + " " + MOIS[Number(ms) - 1] + " " + heure;
  }
  return cadence;
}

/* ------------------------------------------------------------------ */
function editer(p, agents, recharger) {
  const neuf = !p;
  p = p || { agent: agents.length ? agents[0].code : "", libelle: "",
             cadence: "0 8 * * *", entree: {}, actif: true };

  const libelle = h("input.input", { value: p.libelle || "", maxlength: 120 });
  const agent = h("select.select", {}, agents.map(function (a) {
    return h("option", { value: a.code, selected: a.code === p.agent },
      a.nom + (a.actif ? "" : " — éteint"));
  }));
  const cadence = h("input.input", { value: p.cadence || "", placeholder: "0 8 * * *" });
  const lecture = h("div.hint");
  const entree = h("textarea.textarea", { rows: 3 });
  entree.value = JSON.stringify(p.entree || {}, null, 1);
  const actif = h("input", { type: "checkbox", checked: p.actif !== false,
                             style: { width: "18px", height: "18px", accentColor: "var(--accent)" } });

  function relire() {
    const texte = cadence.value.trim();
    const suivant = prochain(texte);
    remplir(lecture,
      h("strong", {}, enFrancais(texte)),
      suivant ? h("span", {}, " · prochain départ " + exact(suivant))
              : h("span", {}, " · aucun départ dans les 40 prochains jours"));
  }
  cadence.addEventListener("input", relire);
  relire();

  const raccourcis = h("div.row", { style: { gap: "6px", flexWrap: "wrap", marginTop: "6px" } },
    MODELES.map(function (m) {
      return h("button.btn.btn-quiet.btn-sm", { type: "button", onclick: function () {
        cadence.value = m[0]; relire();
      } }, m[1]);
    }));

  const enregistrer = h("button.btn.btn-primary", { type: "button" }, "Enregistrer");
  enregistrer.addEventListener("click", async function () {
    let charge;
    try { charge = JSON.parse(entree.value.trim() || "{}"); }
    catch (e) { notice("L'entrée n'est pas du JSON valide.", true); return; }
    if (!libelle.value.trim()) { notice("Un libellé, pour reconnaître la ligne.", true); return; }

    enregistrer.disabled = true;
    const valeurs = {
      agent: agent.value, libelle: libelle.value.trim(),
      cadence: cadence.value.trim(), entree: charge, actif: actif.checked
    };
    try {
      if (neuf) await inserer("ia_planifications", valeurs);
      else await modifier("ia_planifications", { id: "eq." + p.id }, valeurs);
      notice(neuf ? "Planification créée." : "Planification enregistrée.");
      fermerPanneau();
      recharger();
    } catch (e) {
      /* La base refuse une cadence mal formée : son message est plus
         précis que tout ce qu'on écrirait ici. */
      notice(messageErreur(e), true);
      enregistrer.disabled = false;
    }
  });

  panneau(neuf ? "Nouvelle planification" : "Régler « " + p.libelle + " »", h("div", {},
    h("div.field", h("label", {}, "Libellé *"), libelle),
    h("div.field", h("label", {}, "Agent"), agent),
    h("div.field", h("label", {}, "Cadence (cron, cinq champs)"), cadence, lecture, raccourcis),
    h("div.field", h("label", {}, "Entrée passée à l'agent (JSON)"), entree,
      h("div.hint", {}, "Ce que l'agent recevra dans ctx.entree. « {} » s'il n'a besoin de rien.")),
    h("label.row", { style: { gap: "10px", padding: "8px 0", cursor: "pointer" } },
      actif, h("span", {}, "Active"))),
    [enregistrer, h("button.btn.btn-quiet", { type: "button", onclick: fermerPanneau }, "Annuler")]);
}

/* ------------------------------------------------------------------ */
export default async function planifications(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Planification")), h("p.faint", {}, "Chargement…"));

  let liste, agents;
  try {
    liste = await lire("ia_planifications", {
      select: "id,agent,libelle,cadence,entree,actif,dernier_essai,derniere_reussite,cree_le,modifie_le",
      order: "libelle.asc"
    });
    agents = await lire("ia_agents", { select: "code,nom,actif", order: "code.asc" });
  } catch (e) { ecranErreur(hote, e); return; }

  const eteints = {};
  agents.forEach(function (a) { if (!a.actif) eteints[a.code] = true; });
  const recharger = function () { planifications(hote); };

  async function retirer(p) {
    if (!await confirmer("Supprimer « " + p.libelle + " » ? L'agent reste, "
                         + "seule la planification disparaît.")) return;
    try {
      await supprimer("ia_planifications", { id: "eq." + p.id });
      notice("Planification supprimée.");
      recharger();
    } catch (e) { notice(messageErreur(e), true); }
  }

  async function basculer(p, entree) {
    const vise = entree.checked;
    entree.disabled = true;
    try {
      await modifier("ia_planifications", { id: "eq." + p.id }, { actif: vise });
      notice(vise ? "Active." : "En sommeil.");
    } catch (e) { entree.checked = !vise; notice(messageErreur(e), true); }
    entree.disabled = false;
  }

  remplir(hote,
    h("div.adm-tete",
      h("h1", {}, "Planification"),
      h("span.faint", {}, liste.filter(function (p) { return p.actif; }).length
        + " active(s) sur " + liste.length),
      h("span.grow"),
      h("button.btn.btn-primary.btn-sm", { type: "button",
        onclick: function () { editer(null, agents, recharger); } }, "Nouvelle planification")),

    /* Sans la ligne de crontab, tout ceci est décoratif. Le dire une fois,
       en haut, vaut mieux qu'un agent qui « ne part pas ». */
    h("div.stat", { style: { marginBottom: "16px" } },
      h("div.k", {}, "Rien ne part sans cette ligne"),
      h("p.faint", { style: { margin: "8px 0", fontSize: "13.5px" } },
        "Cet écran décrit ce qui doit partir ; c'est cron qui le déclenche. "
        + "À poser une fois, dans le terminal, avec « crontab -e » :"),
      h("pre.charge", {},
        "*/15 * * * *  cd ~/andalys && python3 bin/lanceur.py --tour >> lanceur.log 2>&1"),
      h("p.faint", { style: { marginBottom: 0, fontSize: "12.5px" } },
        "Les clés n'ont pas besoin d'être exportées : le lanceur lit ~/andalys/.env.")),

    liste.length
      ? table(["Planification", "Agent", "Cadence", "Prochain départ", "Dernière réussite", "Active", ""],
          liste, function (p) {
            const suivant = p.actif ? prochain(p.cadence) : null;
            const bascule = h("input", { type: "checkbox", checked: !!p.actif,
                                         "aria-label": "Activer " + p.libelle,
                                         style: { width: "18px", height: "18px",
                                                  accentColor: "var(--accent)" } });
            bascule.addEventListener("change", function () { basculer(p, bascule); });
            return h("tr",
              h("td", {},
                h("div", {}, h("strong", {}, p.libelle)),
                Object.keys(p.entree || {}).length
                  ? h("span.faint", { style: { fontSize: "12px" } },
                      JSON.stringify(p.entree).slice(0, 70))
                  : null),
              h("td", {}, mono(p.agent),
                eteints[p.agent]
                  ? h("div", {}, h("span.badge.badge-promo", {}, "agent éteint")) : null),
              h("td", {},
                h("div", {}, mono(p.cadence)),
                h("span.faint", { style: { fontSize: "12.5px" } }, enFrancais(p.cadence))),
              h("td", {}, p.actif
                ? (suivant ? h("span", {}, exact(suivant)) : h("span.faint", {}, "jamais"))
                : h("span.faint", {}, "—")),
              h("td", {}, p.derniere_reussite ? quand(p.derniere_reussite)
                                              : h("span.faint", {}, "jamais")),
              h("td", {}, bascule),
              h("td", {}, h("div.row", { style: { gap: "6px", justifyContent: "flex-end" } },
                h("button.btn.btn-quiet.btn-sm", { type: "button",
                  onclick: function () { editer(p, agents, recharger); } }, "Régler"),
                h("button.btn.btn-quiet.btn-sm", { type: "button",
                  onclick: function () { retirer(p); } }, "✕"))));
          })
      : vide("Aucune planification — l'atelier ne part que si on le lance à la main"));
}
