/* =====================================================================
   Briques partagées de l'atelier.
   ---------------------------------------------------------------------
   L'atelier est un outil interne : il parle français, au singulier, sans
   passer par le dictionnaire trilingue. Les libellés ci-dessous traduisent
   les valeurs que Postgres autorise dans ses contraintes `check` — si une
   valeur manque ici, c'est qu'une migration en a ajouté une.
   ===================================================================== */

import { h, remplir } from "../core/dom.js";
import { messageErreur } from "../core/supa.js";

/* Les trois niveaux du manuel. Le mot est toujours écrit à côté de la
   couleur : une pastille seule ne dit rien à qui ne distingue pas le
   rouge du vert. */
export const NIVEAUX = {
  vert:   "Autonome",
  orange: "Validation",
  rouge:  "Interdit"
};

export const STATUTS = {
  /* exécutions */
  en_cours: "en cours", reussi: "réussie", echoue: "échouée", annule: "annulée",
  /* tâches */
  a_faire: "à faire", faite: "faite", abandonnee: "abandonnée",
  /* validations */
  en_attente: "en attente", approuvee: "approuvée", refusee: "refusée",
  expiree: "expirée", appliquee: "appliquée",
  /* journal */
  succes: "succès", echec: "échec", refuse: "refusée"
};

/* Le statut de validation recopié dans le journal au moment de l'action. */
export const VALIDATIONS = {
  non_requise: "non requise", approuvee: "approuvée",
  refusee: "refusée", auto: "automatique"
};

export const DECLENCHEURS = {
  manuel: "à la main", planifie: "planifiée", evenement: "sur événement", agent: "par un agent"
};

export function niveau(code, texte) {
  const c = NIVEAUX[code] ? code : "vert";
  return h("span.niveau.niveau-" + c, { title: "Niveau " + c },
    h("i", { "aria-hidden": "true" }), texte || NIVEAUX[c]);
}

export function puce(statut) {
  return h("span.puce.p-" + statut, h("i", { "aria-hidden": "true" }),
    STATUTS[statut] || statut);
}

/* Un identifiant technique — `produit.prix`, `validation.approuvee` —
   montré tel quel, en chasse fixe. Nommé `mono` et non `code` pour ne pas
   masquer le paramètre `code` des fonctions voisines. */
export function mono(texte) {
  return h("span.code", {}, texte || "—");
}

/* ------------------------------------------------------------------ */
/* Le temps, dit comme on le dit à l'oral                              */
/* ------------------------------------------------------------------ */
const PALIERS = [
  [60, "second"], [3600, "minute"], [86400, "hour"],
  [604800, "day"], [2629800, "week"], [31557600, "month"], [Infinity, "year"]
];
const DIVISEURS = { second: 1, minute: 60, hour: 3600, day: 86400,
                    week: 604800, month: 2629800, year: 31557600 };

/** « il y a 3 heures », « dans 6 jours ». Rendu vide si la date est nulle. */
export function relatif(valeur) {
  if (!valeur) return "—";
  const t = new Date(valeur).getTime();
  if (isNaN(t)) return "—";
  const ecart = (t - Date.now()) / 1000;
  const abs = Math.abs(ecart);
  let unite = "year";
  for (let i = 0; i < PALIERS.length; i++) {
    if (abs < PALIERS[i][0]) { unite = PALIERS[i][1]; break; }
  }
  const n = Math.round(ecart / DIVISEURS[unite]);
  try {
    return new Intl.RelativeTimeFormat("fr", { numeric: "auto" }).format(n, unite);
  } catch (e) {
    return new Date(valeur).toLocaleString("fr-FR");
  }
}

/** L'heure exacte, pour l'infobulle : le relatif est commode, pas précis. */
export function exact(valeur) {
  if (!valeur) return "";
  const d = new Date(valeur);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR");
}

export function quand(valeur) {
  return h("span.quand", { title: exact(valeur) }, relatif(valeur));
}

/** Une durée d'exécution, en ms puis en s : c'est l'ordre de grandeur qui compte. */
export function duree(debut, fin) {
  if (!debut || !fin) return "—";
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  if (isNaN(ms) || ms < 0) return "—";
  return ms < 1000 ? ms + " ms" : (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + " s";
}

/** Les coûts d'API sont en dollars, pas en dirhams : on l'écrit. */
export function cout(v) {
  const n = Number(v) || 0;
  if (n === 0) return "0 $";
  return (n < 0.01 ? n.toFixed(4) : n.toFixed(2)) + " $";
}

/* ------------------------------------------------------------------ */
/* La charge utile, montrée telle qu'elle sera rejouée                  */
/* ------------------------------------------------------------------ */
export function charge(valeur, titre) {
  let texte;
  try { texte = JSON.stringify(valeur, null, 2); }
  catch (e) { texte = String(valeur); }
  return h("details.repli",
    h("summary", {}, titre || "Voir ce qui sera exécuté"),
    h("pre.charge", {}, texte));
}

/* ------------------------------------------------------------------ */
/* Le compteur du volet gauche                                         */
/* ------------------------------------------------------------------ */
/* Les écrans qui apprennent le nombre de validations en attente le
   crient ; le volet l'écoute. Sans cela il faudrait que chaque section
   importe l'amorçage, et l'amorçage les sections : un cycle pour un
   chiffre. */
export function signalerAttente(n) {
  document.dispatchEvent(new CustomEvent("atelier:attente", { detail: Number(n) || 0 }));
}

/* ------------------------------------------------------------------ */
/* L'écran d'échec, le même partout                                     */
/* ------------------------------------------------------------------ */
/* Le message de Postgres est montré tel quel : dans un outil interne,
   « Cette validation est déjà « refusee » » vaut mieux que « Une erreur
   est survenue ». */
export function ecranErreur(hote, e) {
  remplir(hote, h("div.vide-etat",
    h("div.em", { "aria-hidden": "true" }, "⚠️"),
    h("h3", {}, "Rien n'a pu être lu"),
    h("p", {}, messageErreur(e)),
    e && e.indice ? h("p.faint", {}, e.indice) : null));
}
