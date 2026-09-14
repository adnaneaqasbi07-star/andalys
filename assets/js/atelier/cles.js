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
import { mono, ecranErreur, SERVICES, PORTE, ENTETE, porteLocale } from "./commun.js";

async function deposer(nom, valeur) {
  const r = await fetch(PORTE, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, ENTETE),
    body: JSON.stringify({ nom: nom, valeur: valeur })
  });
  const d = await r.json().catch(function () { return {}; });
  if (!r.ok || !d.ok) throw new Error(d.erreur || "écriture refusée");
  return d;
}

/* La référence du projet Supabase, tirée de son adresse : elle sert à
   composer le lien direct vers la page des clés, sans la recopier. */
function refProjet() {
  const m = /^https?:\/\/([a-z0-9]+)\.supabase\./i.exec(SUPA.url || "");
  return m ? m[1] : null;
}

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
/* Coller une clé, en local                                            */
/* ------------------------------------------------------------------ */
/* Le champ est de type `password` : la valeur ne s'affiche pas, ne part
   pas dans un journal, et le champ se vide dès qu'elle est écrite. Elle ne
   traverse que la boucle locale — du navigateur au serveur, sur la même
   machine. */
function saisir(variable, recharger) {
  const champ = h("input.input.grow", {
    type: "password", autocomplete: "off", spellcheck: "false",
    placeholder: "coller la clé ici — elle ne s'affichera pas"
  });
  const bouton = h("button.btn.btn-primary.btn-sm", { type: "button" }, "Écrire dans .env");

  async function envoyer() {
    const valeur = champ.value.trim();
    if (!valeur) { notice("Rien à écrire.", true); return; }
    bouton.disabled = true;
    try {
      const d = await deposer(variable, valeur);
      champ.value = "";                /* on ne la garde pas à l'écran */
      notice(variable + " écrite (" + d.longueur + " caractères).");
      recharger();
    } catch (e) {
      notice(e.message || "écriture refusée", true);
      bouton.disabled = false;
    }
  }

  champ.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); envoyer(); }
  });
  bouton.addEventListener("click", envoyer);

  return h("div.row", { style: { gap: "8px", marginTop: "2px" } }, champ, bouton);
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

/* Une fiche par service. Deux visages selon d'où la page est servie :
   sur cette machine, un champ où coller la clé ; publiée, la commande du
   terminal — le serveur local n'y répond pas. */
function fiche(s, agents, local, recharger) {
  const ligne = s.variable + "=";
  const commande = "python3 bin/cle.py " + s.variable;
  const etat = local && (local.cles || []).filter(function (c) {
    return c.nom === s.variable;
  })[0];

  return h("div.dossier", { style: { borderInlineStartColor: "var(--accent)" } },
    h("div.haut",
      h("strong.grow", {}, s.nom),
      etat
        ? h("span.badge" + (etat.posee ? ".badge-ok" : ""), {},
            etat.posee ? "posée · " + etat.longueur + " car." : "absente")
        : (s.requise ? h("span.badge.badge-promo", {}, "indispensable") : null),
      mono(s.variable)),

    h("p", { style: { margin: 0, fontSize: "14px" } }, s.role),

    agents && agents.length
      ? h("p.faint", { style: { margin: 0, fontSize: "13px" } },
          "S'arrêtent sans elle : " + agents.join(", "))
      : null,

    h("div.bas",
      s.lien
        ? h("a.btn.btn-primary.btn-sm", { href: s.lien, target: "_blank",
                                          rel: "noopener noreferrer" }, "Obtenir la clé ↗")
        : null,
      local ? null : h("button.btn.btn-quiet.btn-sm", {
        type: "button", onclick: function () { copier(commande, "La commande"); }
      }, "Copier la commande pour la coller"),
      h("button.btn.btn-quiet.btn-sm", {
        type: "button", onclick: function () { copier(ligne, "« " + s.variable + " »"); }
      }, "Copier la ligne .env")),

    /* Le geste qui manquait. En local, on colle ici et le serveur de
       cette machine l'écrit dans `.env` : la clé ne sort pas de
       l'ordinateur. Publiée, la page n'a pas ce serveur en face d'elle et
       montre la commande du terminal. */
    local ? saisir(s.variable, recharger)
          : h("pre.charge", { style: { marginTop: "2px" } }, commande),

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

  const local = await porteLocale();
  const recharger = function () { cles(hote); };

  const fiches = [];
  horsAgents().forEach(function (s) { fiches.push(fiche(s, null, local, recharger)); });

  Object.keys(parVariable).sort().forEach(function (variable) {
    const e = parVariable[variable];
    const modele = SERVICES[e.fournisseur] || SERVICES.anthropic;
    fiches.push(fiche(Object.assign({}, modele, {
      variable: variable,
      nom: modele.nom + (variable === modele.variable ? "" : " — clé dédiée"),
      note: variable === modele.variable ? modele.note
        : "Clé propre à ces agents : leur facture et leur limite de débit sont à part. "
          + modele.note
    }), e.agents, local, recharger));
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

    local
      ? h("div.stat", { style: { marginBottom: "16px" } },
          h("div.k", {}, "Vous êtes sur votre machine"),
          h("p", { style: { marginTop: "8px", marginBottom: "8px", fontSize: "14px",
                            lineHeight: "1.6" } },
            "Chaque service ci-dessous a son champ : collez la clé, elle part vers ",
            h("code", {}, "bin/servir.py"),
            " — qui tourne sur cet ordinateur — et s'écrit dans ",
            h("code", {}, local.fichier || "~/andalys/.env"),
            " en droits 600. ",
            h("strong", {}, "Elle ne quitte pas la machine"),
            " : ni le réseau, ni la base, ni le dépôt."),
          h("p.faint", { style: { marginBottom: 0, fontSize: "12.5px" } },
            "Le champ ne montre pas ce qu'on y colle et se vide une fois la clé écrite. "
            + "Sur la version publiée, ces champs n'existent pas : la page n'y trouve "
            + "pas le serveur local et affiche la commande du terminal."))
      : h("div.stat", { style: { marginBottom: "16px" } },
          h("div.k", {}, "Où les poser"),
      h("p", { style: { marginTop: "8px", marginBottom: "8px", fontSize: "14px", lineHeight: "1.6" } },
        "Cette page n'a pas de champ de saisie, et la raison n'est pas la prudence : "
        + "c'est que ", h("strong", {}, "le lanceur tourne sur votre Mac"),
        " et lit son environnement. Un navigateur ne peut pas y écrire — même depuis "
        + "cette machine, et encore moins depuis un téléphone. Les valeurs vivent dans ",
        h("code", {}, "~/andalys/.env"), ", ignoré par git, en droits 600."),
      h("p", { style: { margin: "0 0 8px", fontSize: "14px", lineHeight: "1.6" } },
        "Le chemin, c'est le terminal de la machine qui fait tourner l'atelier. "
        + "Une commande par clé : elle la demande sans l'afficher, ne la laisse ni "
        + "à l'écran ni dans l'historique du shell, et l'écrit dans le fichier."),
      h("pre.charge", {}, "python3 bin/cle.py ANTHROPIC_API_KEY\npython3 bin/cle.py            # l'état de toutes les variables"),
      h("div.row", { style: { gap: "8px", flexWrap: "wrap" } },
        h("button.btn.btn-primary.btn-sm", {
          type: "button", onclick: function () { copier(gabarit, "Le gabarit .env"); }
        }, "Copier le gabarit .env complet")),
      h("p.faint", { style: { marginBottom: 0, fontSize: "12.5px" } },
        "Et cette page ne peut pas non plus savoir si une clé est posée : elle ne lit "
        + "pas l'environnement du lanceur. C'est le terminal qui répond :"),
      h("pre.charge", {}, "python3 bin/lanceur.py --cles"),
      /* Le jour où saisir une clé depuis le navigateur deviendra
         nécessaire — depuis un téléphone, par exemple — la réponse
         n'est pas un champ dans cette page : c'est le coffre de
         Supabase, chiffré au repos, avec une fonction `security
         definer` réservée à l'administration. C'est un autre chantier,
         et il se décide, il ne se subit pas. */
      h("p.faint", { style: { marginBottom: 0, fontSize: "12.5px" } },
        "Ouvrez le même écran depuis ", h("code", {}, "http://127.0.0.1:4321/atelier.html#/cles"),
        " et chaque service y gagne un champ : la clé s'écrit alors dans .env sans "
        + "quitter votre machine.")),

    h("div.file", {}, fiches));
}
