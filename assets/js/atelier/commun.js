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


/* ------------------------------------------------------------------ */
/* Les fournisseurs : où obtenir la clé                                */
/* ------------------------------------------------------------------ */
/* Une seule table pour les deux écrans qui s'en servent — « Clés » et le
   panneau « Régler » des agents. Deux copies auraient divergé au premier
   lien qui change. */
export const SERVICES = {
  anthropic: {
    nom: "Anthropic — Claude",
    variable: "ANTHROPIC_API_KEY",
    role: "Le texte : fiches produits, veille, analyses, brouillons d'e-mails.",
    lien: "https://console.anthropic.com/settings/keys",
    chemin: "Console Anthropic › Settings › API keys › Create Key",
    note: "Pensez à créditer le compte dans Billing : sans crédit, la clé est valide "
        + "mais chaque appel échoue."
  },
  google: {
    nom: "Google — Gemini (Nano Banana)",
    variable: "GEMINI_API_KEY",
    role: "Les images : retouche de vos photographies, visuels marketing.",
    lien: "https://aistudio.google.com/apikey",
    chemin: "Google AI Studio › Get API key › Create API key",
    note: "C'est la clé de l'API Gemini (AI Studio), pas un identifiant de Google Cloud."
  },
  openai: {
    nom: "OpenAI",
    variable: "OPENAI_API_KEY",
    role: "Aucun agent ne l'utilise aujourd'hui.",
    lien: "https://platform.openai.com/api-keys",
    chemin: "Platform OpenAI › API keys › Create new secret key",
    note: "L'adaptateur n'est pas écrit : déclarer un agent ici le ferait refuser de partir."
  },
  mistral: {
    nom: "Mistral",
    variable: "MISTRAL_API_KEY",
    role: "Aucun agent ne l'utilise aujourd'hui.",
    lien: "https://console.mistral.ai/api-keys",
    chemin: "Console Mistral › API Keys › Create new key",
    note: "L'adaptateur n'est pas écrit : déclarer un agent ici le ferait refuser de partir."
  }
};

/* ------------------------------------------------------------------ */
/* Le fournisseur conseillé, agent par agent                           */
/* ------------------------------------------------------------------ */
/* La règle qui gouverne ce tableau : on paie cher là où l'erreur coûte
   cher, et peu là où le travail est répétitif et vérifiable. Une fiche
   produit fausse se retrouve devant un client ; un e-mail mal classé se
   reclasse en trois secondes.

   Écrit ici plutôt que dans un document : un conseil qu'il faut aller
   chercher ailleurs n'est pas suivi. Le panneau « Régler » l'affiche, et
   propose de l'appliquer d'un clic. */
export const CONSEIL = {
  produits: { fournisseur: "anthropic", modele: "claude-opus-5",
    pourquoi: "Rédaction trilingue : l'arabe soigné est là où les modèles se "
            + "départagent le plus. Une fiche à refaire coûte plus cher que les "
            + "jetons économisés." },
  recherche: { fournisseur: "anthropic", modele: "claude-opus-5",
    pourquoi: "Recherche web officielle, sources et dates récupérées proprement. "
            + "Si la veille rend peu de sources marocaines, Google et son index "
            + "sont le premier essai à faire." },
  creatif: { fournisseur: "google", modele: "gemini-2.5-flash-image",
    pourquoi: "Aucun modèle de texte ne fabrique d'image. Nano Banana est surtout "
            + "fort en édition — harmoniser vos vraies photographies." },
  analytics: { fournisseur: "anthropic", modele: "claude-opus-5",
    pourquoi: "Il raisonne sur des chiffres et recommande des actions : une "
            + "analyse bancale se paie en décisions." },
  directeur: { fournisseur: "anthropic", modele: "claude-opus-5",
    pourquoi: "Il arbitre entre les autres agents. C'est du raisonnement, pas de "
            + "la rédaction." },
  email: { fournisseur: "anthropic", modele: "claude-haiku-4-5",
    pourquoi: "Classer et résumer en volume : cinq fois moins cher qu'Opus, et "
            + "c'est exactement son métier." },
  social: { fournisseur: "anthropic", modele: "claude-sonnet-5",
    pourquoi: "Légendes et hashtags : travail cadré, relu par une validation "
            + "orange de toute façon." },
  clients: { fournisseur: "anthropic", modele: "claude-sonnet-5",
    pourquoi: "Réponses selon des règles validées, jamais envoyées sans accord." },
  fournisseurs: { fournisseur: "anthropic", modele: "claude-sonnet-5",
    pourquoi: "Comparer des prix et des délais ne demande pas le modèle le plus cher." },
  site: { fournisseur: "anthropic", modele: "claude-sonnet-5",
    pourquoi: "Surveiller des pages et proposer des correctifs : travail répétitif "
            + "et vérifiable." }
};

/** Le conseil pour cet agent, ou celui d'Anthropic à défaut. */
export function conseilPour(code) {
  return CONSEIL[code] || { fournisseur: "anthropic", modele: "claude-sonnet-5",
                            pourquoi: "Agent non répertorié : Sonnet est le choix sûr." };
}


/* ------------------------------------------------------------------ */
/* La porte locale                                                     */
/* ------------------------------------------------------------------ */
/* Servie par `bin/servir.py`, sur cette machine et elle seule. Elle dit
   quelles clés sont posées dans `.env` — jamais leur valeur, seulement
   leur longueur. Publiée sur GitHub Pages, elle ne répond pas : les
   écrans s'en passent et affichent la commande du terminal.

   Cet appel ne passe pas par `core/supa.js`, et c'est voulu : ce n'est
   pas l'API de la boutique, c'est l'outil local. */
export const PORTE = "/-/cle";
export const ENTETE = { "X-Andalys": "atelier" };

export async function porteLocale() {
  try {
    const r = await fetch(PORTE, { headers: ENTETE });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.local ? d : null;
  } catch (e) {
    return null;
  }
}

export function cleParNom(local, nom) {
  if (!local) return null;
  return (local.cles || []).filter(function (c) { return c.nom === nom; })[0] || null;
}
