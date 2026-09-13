/* =====================================================================
   Les clés d'API : où les obtenir, où les poser.
   ---------------------------------------------------------------------
   Cet écran ne reçoit AUCUNE clé, et c'est volontaire. Une clé saisie
   dans une page part par le réseau, s'écrit en base, se recopie dans
   chaque sauvegarde et s'affiche dans le journal de la moindre requête.
   La base la refuserait d'ailleurs : `ia_agents.cle_env` n'accepte qu'un
   NOM de variable, et `config` rejette tout champ qui ressemble à un
   secret.

   Ce qu'il fait, et qui est le vrai travail pénible : dire pour chaque
   service à quoi il sert, quels agents s'arrêtent sans lui, où aller le
   chercher — d'un clic — et quelle ligne exacte coller dans `.env`.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { lire } from "../core/supa.js";
import { SUPA } from "../core/config.js";
import { mono, ecranErreur } from "./commun.js";

/* La référence du projet Supabase, tirée de son adresse : elle sert à
   composer le lien direct vers la page des clés, sans la recopier. */
function refProjet() {
  const m = /^https?:\/\/([a-z0-9]+)\.supabase\./i.exec(SUPA.url || "");
  return m ? m[1] : null;
}

const SERVICES = {
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

/* Ce qui ne dépend d'aucun agent, mais sans quoi rien ne tourne. */
function horsAgents() {
  const ref = refProjet();
  return [
    {
      nom: "Supabase — clé de service",
      variable: "ANDALYS_CLE_SERVICE",
      role: "La base. Sans elle, le lanceur ne lit ni n'écrit rien.",
      lien: ref ? "https://supabase.com/dashboard/project/" + ref + "/settings/api" : null,
      chemin: "Supabase › Settings › API › Project API keys › service_role",
      note: "⚠️ Elle contourne toute la sécurité par ligne. Elle ne se publie pas, "
          + "ne se colle pas dans un message, ne part jamais dans le dépôt.",
      requise: true
    },
    {
      nom: "Pexels — photographies libres",
      variable: "PEXELS_API_KEY",
      role: "bin/images_produits.py : cherche des candidates pour le catalogue.",
      lien: "https://www.pexels.com/api/new/",
      chemin: "Pexels › API › Your API Key (gratuit)",
      note: "Licence Pexels : usage commercial, sans attribution obligatoire — "
          + "de loin la meilleure source pour une boutique."
    },
    {
      nom: "Pixabay — photographies libres",
      variable: "PIXABAY_API_KEY",
      role: "bin/images_produits.py : deuxième fonds interrogé.",
      lien: "https://pixabay.com/api/docs/",
      chemin: "Pixabay › API Documentation › votre clé apparaît une fois connecté",
      note: "Facultatif : sans clé, le script se rabat sur Commons et Openverse."
    }
  ];
}

/* ------------------------------------------------------------------ */
function copier(texte, quoi) {
  const dire = function (ok) {
    notice(ok ? quoi + " copié." : "Copie impossible — sélectionnez le texte à la main.", !ok);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texte).then(function () { dire(true); },
                                              function () { dire(false); });
    return;
  }
  dire(false);
}

function fiche(s, agents) {
  const ligne = s.variable + "=";
  return h("div.dossier", { style: { borderInlineStartColor: "var(--accent)" } },
    h("div.haut",
      h("strong.grow", {}, s.nom),
      s.requise ? h("span.badge.badge-promo", {}, "indispensable") : null,
      mono(s.variable)),

    h("p", { style: { margin: 0, fontSize: "14px" } }, s.role),

    agents && agents.length
      ? h("p.faint", { style: { margin: 0, fontSize: "13px" } },
          "S'arrêtent sans elle : " + agents.join(", "))
      : null,

    h("div.bas",
      s.lien
        ? h("a.btn.btn-primary.btn-sm", { href: s.lien, target: "_blank", rel: "noopener noreferrer" },
            "Obtenir la clé ↗")
        : null,
      h("button.btn.btn-quiet.btn-sm", {
        type: "button", onclick: function () { copier(ligne, "« " + s.variable + " »"); }
      }, "Copier la ligne .env")),

    h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Chemin : " + s.chemin),
    s.note ? h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, s.note) : null);
}

/* ------------------------------------------------------------------ */
export default async function cles(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Clés")), h("p.faint", {}, "Chargement…"));

  let agents;
  try {
    agents = await lire("ia_agents", {
      select: "code,nom,fournisseur,cle_env,actif", order: "code.asc"
    });
  } catch (e) { ecranErreur(hote, e); return; }

  /* Quels agents dépendent de quelle variable. Un agent qui nomme sa
     propre clé forme sa propre entrée : c'est tout l'intérêt d'en avoir
     une à lui. */
  const parVariable = {};
  agents.forEach(function (a) {
    const f = a.fournisseur || "anthropic";
    const variable = a.cle_env || (SERVICES[f] && SERVICES[f].variable) || "ANTHROPIC_API_KEY";
    (parVariable[variable] = parVariable[variable] || { fournisseur: f, agents: [] })
      .agents.push(a.nom + (a.actif ? "" : " (éteint)"));
  });

  const fiches = [];
  horsAgents().forEach(function (s) { fiches.push(fiche(s, null)); });

  Object.keys(parVariable).sort().forEach(function (variable) {
    const e = parVariable[variable];
    const modele = SERVICES[e.fournisseur] || SERVICES.anthropic;
    fiches.push(fiche(Object.assign({}, modele, {
      variable: variable,
      nom: modele.nom + (variable === modele.variable ? "" : " — clé dédiée"),
      note: variable === modele.variable ? modele.note
        : "Clé propre à ces agents : leur facture et leur limite de débit sont à part. "
          + modele.note
    }), e.agents));
  });

  /* Le fichier entier, prêt à coller. C'est ce qui remplace la saisie
     d'une clé dans cette page : on compose le gabarit ici, on y met les
     valeurs là où elles doivent vivre. */
  const gabarit = ["# ~/andalys/.env — ignoré par git", ""]
    .concat(horsAgents().map(function (s) { return s.variable + "="; }))
    .concat([""])
    .concat(Object.keys(parVariable).sort().map(function (v) { return v + "="; }))
    .join("\n") + "\n";

  remplir(hote,
    h("div.adm-tete",
      h("h1", {}, "Clés"),
      h("span.faint.grow", {}, agents.length + " agents · " +
        Object.keys(parVariable).length + " variable(s) de modèle")),

    h("div.stat", { style: { marginBottom: "16px" } },
      h("div.k", {}, "Où les poser"),
      h("p", { style: { marginTop: "8px", marginBottom: "8px", fontSize: "14px", lineHeight: "1.6" } },
        "Aucune clé ne se saisit ici : une clé tapée dans une page part par le réseau "
        + "et s'écrit en base. La base la refuserait de toute façon. Les valeurs vivent "
        + "dans ", h("code", {}, "~/andalys/.env"), ", ignoré par git."),
      h("div.row", { style: { gap: "8px", flexWrap: "wrap" } },
        h("button.btn.btn-primary.btn-sm", {
          type: "button", onclick: function () { copier(gabarit, "Le gabarit .env"); }
        }, "Copier le gabarit .env complet")),
      h("p.faint", { style: { marginBottom: 0, fontSize: "12.5px" } },
        "Cette page ne peut pas savoir si une clé est posée — le navigateur ne lit pas "
        + "l'environnement du lanceur. Pour le savoir :"),
      h("pre.charge", {}, "python3 bin/lanceur.py --cles")),

    h("div.file", {}, fiches));
}
