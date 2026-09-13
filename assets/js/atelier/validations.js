/* =====================================================================
   La barrière orange.
   ---------------------------------------------------------------------
   C'est l'écran qui justifie tout le reste : un agent n'a pas le droit
   d'écrire dans le catalogue, il dépose ici la charge utile exacte de ce
   qu'il ferait. Rien ne s'applique avant un clic humain.

   Cette page n'écrit jamais `statut = 'approuvee'` elle-même. Elle
   appelle `boutique.decider_validation()`, qui vérifie qui parle,
   verrouille la ligne, refuse de décider deux fois et journalise dans la
   même transaction. Une approbation sans trace est impossible.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { lire, rpc, messageErreur } from "../core/supa.js";
import { confirmer } from "../admin/commun.js";   /* briques d'interface partagées */
import { niveau, puce, mono, quand, charge, relatif, exact,
         ecranErreur, signalerAttente, NIVEAUX } from "./commun.js";

const ONGLETS = [
  ["en_attente", "En attente"],
  ["approuvee",  "Approuvées"],
  ["appliquee",  "Appliquées"],
  ["refusee",    "Refusées"],
  ["expiree",    "Expirées"],
  ["",           "Toutes"]
];


/* ------------------------------------------------------------------ */
/* Ce qu'on approuve, on le regarde                                    */
/* ------------------------------------------------------------------ */
/* Une charge utile qui porte une image met son adresse dans `apercu`.
   L'afficher n'est pas un ornement : approuver une image sur la foi
   d'une phrase — « photographie harmonisée » — reviendrait à ne pas
   l'approuver du tout. Quand l'agent donne aussi l'ancienne (`avant`),
   les deux sont montrées côte à côte : c'est la comparaison qui décide,
   pas l'image seule. */
function apercu(c) {
  if (!c || !c.apercu) return null;
  const vignette = function (url, etiquette) {
    return h("figure", { style: { margin: 0, flex: "1 1 200px", minWidth: 0 } },
      h("img", { src: url, alt: etiquette, loading: "lazy",
                 style: { width: "100%", borderRadius: "var(--r-s)",
                          border: "1px solid var(--line-soft)", background: "var(--surface-2)" } }),
      h("figcaption.faint", { style: { fontSize: "12px", marginTop: "4px" } }, etiquette));
  };
  return h("div.row", { style: { gap: "12px", alignItems: "flex-start", flexWrap: "wrap" } },
    c.avant ? vignette(c.avant, "avant") : null,
    vignette(c.apercu, c.avant ? "proposée" : "proposition"));
}

/* ------------------------------------------------------------------ */
/* Un dossier                                                          */
/* ------------------------------------------------------------------ */
function dossier(v, recharger) {
  const perimee = v.statut === "en_attente" && new Date(v.expire_le).getTime() < Date.now();
  const decidable = v.statut === "en_attente" && !perimee;
  const zoneMotif = h("div", { hidden: true });

  /* Une action rouge ne s'approuve pas depuis une page web : la fonction
     Postgres la refuse, et l'interface ne propose donc pas le bouton.
     Montrer un bouton qui échoue toujours serait une promesse en l'air. */
  const boutons = [];

  if (decidable && v.niveau === "orange") {
    boutons.push(h("button.btn.btn-primary.btn-sm", {
      type: "button",
      onclick: async function () {
        const ok = await confirmer("Approuver « " + v.action + " » ? " +
          "L'action sera appliquée telle qu'elle est écrite.");
        if (!ok) return;
        await decider(v, true, null, recharger);
      }
    }, "Approuver"));
  }

  if (decidable) {
    boutons.push(h("button.btn.btn-ghost.btn-sm", {
      type: "button",
      onclick: function () { zoneMotif.hidden = !zoneMotif.hidden; }
    }, "Refuser"));
  }

  if (decidable && v.niveau === "rouge") {
    boutons.push(h("span.faint", { style: { fontSize: "13px" } },
      "Niveau rouge : à faire soi-même, hors de cette page."));
  }

  if (perimee) {
    boutons.push(h("span.faint", { style: { fontSize: "13px" } },
      "Périmée " + relatif(v.expire_le) + " — elle n'autorise plus rien."));
  }

  const motif = h("input.input.grow", { type: "text", maxlength: 300,
                                        placeholder: "Motif du refus (facultatif)" });
  remplir(zoneMotif, h("div.row", { style: { gap: "8px", marginTop: "4px" } },
    motif,
    h("button.btn.btn-danger.btn-sm", {
      type: "button",
      onclick: function () { decider(v, false, motif.value.trim(), recharger); }
    }, "Confirmer le refus"),
    h("button.btn.btn-quiet.btn-sm", {
      type: "button", onclick: function () { zoneMotif.hidden = true; }
    }, "Annuler")));

  return h("div.dossier.n-" + v.niveau,
    h("div.haut",
      /* Ici le niveau ne décrit pas un agent mais ce dossier-ci : orange
         veut dire « à valider », rouge « pas depuis cette page ». */
      niveau(v.niveau, v.niveau === "orange" ? "À valider" : NIVEAUX[v.niveau]),
      h("strong", {}, v.agent),
      mono(v.action),
      h("span.grow"),
      v.statut === "en_attente" ? null : puce(v.statut),
      quand(v.cree_le)),

    h("p.resume", {}, v.resume),

    apercu(v.charge),
    charge(v.charge),

    v.motif ? h("p.faint", { style: { margin: 0, fontSize: "13px" } }, "Motif : " + v.motif) : null,

    v.decide_le
      ? h("p.faint", { style: { margin: 0, fontSize: "12.5px" } },
          "Décidée le " + exact(v.decide_le) +
          (v.applique_le ? " · appliquée le " + exact(v.applique_le) : ""))
      /* Pour une périmée, la phrase de la barre de boutons le dit déjà :
         on ne l'écrit pas deux fois. */
      : perimee ? null
      : h("p.faint", { style: { margin: 0, fontSize: "12.5px" } },
          "Expire " + relatif(v.expire_le)),

    boutons.length ? h("div.bas", {}, boutons) : null,
    zoneMotif);
}

/* ------------------------------------------------------------------ */
async function decider(v, approuve, motif, recharger) {
  try {
    await rpc("decider_validation", {
      p_id: v.id, p_approuve: approuve, p_motif: motif || null
    });
    notice(approuve ? "Approuvée. L'action reste à appliquer par le lanceur."
                    : "Refusée, et journalisée.");
    recharger();
  } catch (e) {
    /* Le message de Postgres est le bon : « déjà refusée », « a expiré
       le … », « niveau rouge ». On ne le remplace pas par un générique. */
    notice(messageErreur(e), true);
  }
}

/* ------------------------------------------------------------------ */
export default async function validations(hote, params) {
  const cible = params && params.id ? String(params.id) : null;
  let onglet = cible ? "" : "en_attente";

  const zone = h("div");
  const compte = h("span.faint");

  async function charger() {
    remplir(zone, h("p.faint", {}, "Chargement…"));

    /* Le `select` est écrit en toutes lettres, et le filtre passe par
       `filtres` : c'est ce que `verifier.py` sait relire pour confronter
       chaque colonne au schéma. Un objet construit à la volée passerait
       sous son radar. */
    const filtres = cible ? [["id", "eq." + cible]]
                          : (onglet ? [["statut", "eq." + onglet]] : []);

    let liste;
    try {
      liste = await lire("ia_validations", {
        select: "id,agent,action,niveau,resume,charge,statut,motif,decide_le,applique_le,expire_le,cree_le,execution_id",
        filtres: filtres, order: "cree_le.desc", limit: 200
      });
    } catch (e) { ecranErreur(zone, e); return; }

    compte.textContent = liste.length + (liste.length > 1 ? " dossiers" : " dossier");

    /* Le volet gauche porte le nombre en attente : on le recalcule ici
       plutôt que de refaire un aller-retour vers `ia_resume()`. */
    if (onglet === "en_attente" && !cible) {
      signalerAttente(liste.filter(function (v) {
        return new Date(v.expire_le).getTime() >= Date.now();
      }).length);
    }

    if (!liste.length) {
      remplir(zone, h("div.vide-etat",
        h("div.em", { "aria-hidden": "true" }, onglet === "en_attente" ? "✓" : "∅"),
        h("h3", {}, onglet === "en_attente"
          ? "Rien n'attend votre accord"
          : "Aucun dossier dans cet état"),
        onglet === "en_attente"
          ? h("p.faint", {}, "Les agents déposent ici tout ce qui touche aux prix, " +
              "au site ou aux réseaux sociaux.")
          : null));
      return;
    }

    remplir(zone, h("div.file", {}, liste.map(function (v) {
      return dossier(v, charger);
    })));
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
        charger();
      }
    }, o[1]);
  }));

  remplir(hote,
    h("div.adm-tete",
      h("h1", {}, "Validations"),
      compte,
      h("span.grow"),
      cible ? h("a.btn.btn-quiet.btn-sm", { href: "#/validations" }, "Voir tous les dossiers") : null),
    cible ? null : barre,
    zone);

  await charger();
}
