/* =====================================================================
   Le registre des agents, et ce qu'ils ont fait.
   ---------------------------------------------------------------------
   Déclarer n'est pas lancer : un agent éteint n'a pas de planification et
   ne coûte rien. L'interrupteur de cette page ne fait donc que cela —
   allumer ou éteindre. Il ne lance rien : c'est le lanceur (phase 4) qui
   lira `ia_planifications`.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { lire, modifier, messageErreur } from "../core/supa.js";
import { table, vide, panneau, fermerPanneau } from "../admin/commun.js";
import { niveau, puce, mono, quand, duree, cout, ecranErreur, DECLENCHEURS } from "./commun.js";

/* ------------------------------------------------------------------ */
/* Qui répond, et avec quel modèle                                      */
/* ------------------------------------------------------------------ */
/* Suggestions, pas vérités : les identifiants de modèle changent plus
   vite que ce fichier. Le champ reste libre — la liste ne fait que
   rappeler l'ordre du plus capable au plus frugal, avec son prix au
   million de jetons. Le raisonnement complet est dans
   docs/ATELIER-IA.md § 12. */
const MODELES = {
  anthropic: [
    ["claude-opus-5",    "le plus capable · 5 $ / 25 $"],
    ["claude-sonnet-5",  "très proche, 2,5× moins cher · 2 $ / 10 $"],
    ["claude-haiku-4-5", "rapide et frugal, pour le volume · 1 $ / 5 $"]
  ],
  google:  [["gemini-2.5-flash-image", "Nano Banana · images, surtout en édition"],
            ["gemini-3-pro-image",     "Nano Banana Pro · meilleur sur le texte dans l'image"]],
  openai:  [["gpt-5", "à confirmer avant usage"]],
  mistral: [["mistral-large-latest", "à confirmer avant usage"]]
};

/* La variable d'environnement attendue quand l'agent n'en nomme pas une. */
const CLE_PAR_DEFAUT = {
  anthropic: "ANTHROPIC_API_KEY", google: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY", mistral: "MISTRAL_API_KEY"
};

function reglages(a, recharger) {
  const fournisseur = h("select.select", {},
    Object.keys(MODELES).map(function (f) {
      return h("option", { value: f, selected: (a.fournisseur || "anthropic") === f }, f);
    }));

  const liste = h("datalist#modeles-connus");
  const modele = h("input.input", { list: "modeles-connus", value: a.modele || "" });
  const aide = h("div.hint");

  const cleEnv = h("input.input", {
    value: a.cle_env || "", placeholder: CLE_PAR_DEFAUT[a.fournisseur || "anthropic"],
    pattern: "[A-Z][A-Z0-9_]{2,63}"
  });
  const rappel = h("div.hint");

  function majFournisseur() {
    const f = fournisseur.value;
    remplir(liste, (MODELES[f] || []).map(function (m) {
      return h("option", { value: m[0] }, m[1]);
    }));
    remplir(aide, "Du plus capable au plus frugal : ",
      (MODELES[f] || []).map(function (m, i) {
        return h("span", {}, i ? " · " : "", h("code", {}, m[0]));
      }));
    cleEnv.placeholder = CLE_PAR_DEFAUT[f] || "";
    remplir(rappel,
      "Le NOM de la variable, jamais la clé elle-même — la base refuse une clé ici. ",
      "Vide : « " + (CLE_PAR_DEFAUT[f] || "—") + " ». ",
      "La valeur se pose dans ", h("code", {}, "~/andalys/.env"), ".");
  }
  fournisseur.addEventListener("change", majFournisseur);
  majFournisseur();

  const enregistrer = h("button.btn.btn-primary", { type: "button" }, "Enregistrer");
  enregistrer.addEventListener("click", async function () {
    const nom = cleEnv.value.trim();
    if (nom && !/^[A-Z][A-Z0-9_]{2,63}$/.test(nom)) {
      notice("Un nom de variable s'écrit en MAJUSCULES_AVEC_DES_BLANCS_SOULIGNÉS.", true);
      return;
    }
    if (/[a-z]{2}-[a-z0-9]{6,}/.test(nom)) {
      notice("On dirait une clé, pas un nom de variable. La clé va dans .env.", true);
      return;
    }
    enregistrer.disabled = true;
    try {
      await modifier("ia_agents", { code: "eq." + a.code }, {
        fournisseur: fournisseur.value,
        modele: modele.value.trim() || null,
        cle_env: nom || null
      });
      notice(a.nom + " : réglages enregistrés.");
      fermerPanneau();
      recharger();
    } catch (e) {
      notice(messageErreur(e), true);
      enregistrer.disabled = false;
    }
  });

  panneau("Régler « " + a.nom + " »", h("div", {},
    h("p.faint", { style: { marginTop: 0 } }, a.mission),
    h("div.field", h("label", {}, "Fournisseur"), fournisseur),
    h("div.field", h("label", {}, "Modèle"), modele, liste, aide),
    h("div.field", h("label", {}, "Variable d'environnement de la clé"), cleEnv, rappel),
    h("div.fieldset", h("legend", {}, "Pour vérifier"),
      h("p", { style: { margin: 0, fontSize: "13.5px" } },
        "Le tableau de bord ne peut pas lire l'environnement du lanceur. Pour savoir "
        + "si la clé est bien posée :"),
      h("pre.charge", {}, "python3 bin/lanceur.py --cles"))),
    [enregistrer,
     h("button.btn.btn-quiet", { type: "button", onclick: fermerPanneau }, "Annuler")]);
}

export default async function agents(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Agents")), h("p.faint", {}, "Chargement…"));

  let liste, passages;
  try {
    liste = await lire("ia_agents", {
      select: "code,nom,mission,niveau_max,modele,fournisseur,cle_env,actif,cree_le",
      order: "code.asc"
    });
    passages = await lire("ia_executions", {
      select: "id,agent,declencheur,statut,erreur,debut,fin,cout_usd,jetons_entree,jetons_sortie",
      order: "debut.desc", limit: 60
    });
  } catch (e) { ecranErreur(hote, e); return; }

  const derniere = {};
  passages.forEach(function (p) {
    if (!derniere[p.agent]) derniere[p.agent] = p;
  });

  function basculer(a, entree) {
    const vise = entree.checked;
    entree.disabled = true;
    modifier("ia_agents", { code: "eq." + a.code }, { actif: vise })
      .then(function () {
        a.actif = vise;
        notice(a.nom + (vise ? " est allumé." : " est éteint."));
      })
      .catch(function (e) {
        entree.checked = !vise;          /* la base a refusé : l'interface suit */
        notice(messageErreur(e), true);
      })
      .then(function () { entree.disabled = false; });
  }

  remplir(hote,
    h("div.adm-tete",
      h("h1", {}, "Agents"),
      h("span.faint", {}, liste.filter(function (a) { return a.actif; }).length +
        " allumés sur " + liste.length)),

    liste.length
      ? table(["Agent", "Mission", "Plafond", "Modèle", "Dernière", "Allumé", ""], liste, function (a) {
          const interrupteur = h("input", {
            type: "checkbox", checked: !!a.actif,
            "aria-label": "Allumer " + a.nom,
            style: { width: "18px", height: "18px", accentColor: "var(--accent)" }
          });
          interrupteur.addEventListener("change", function () { basculer(a, interrupteur); });

          return h("tr",
            h("td", {}, h("div", {}, h("strong", {}, a.nom)), mono(a.code)),
            h("td", { style: { maxWidth: "420px" } },
              h("span.faint", { style: { fontSize: "13px" } }, a.mission)),
            h("td", {}, niveau(a.niveau_max)),
            h("td", {},
              h("div", {}, h("span.faint", { style: { fontSize: "12.5px", whiteSpace: "nowrap" } },
                a.modele || "—")),
              h("span.faint", { style: { fontSize: "11.5px" } },
                (a.fournisseur || "anthropic") + (a.cle_env ? " · " + a.cle_env : ""))),
            h("td", {}, derniere[a.code]
              ? h("span", {}, quand(derniere[a.code].debut), " ", puce(derniere[a.code].statut))
              : h("span.faint", {}, "jamais")),
            h("td", {}, interrupteur),
            h("td", {}, h("button.btn.btn-quiet.btn-sm", {
              type: "button", onclick: function () { reglages(a, function () { agents(hote); }); }
            }, "Régler")));
        })
      : vide("Aucun agent déclaré"),

    h("div.adm-tete", { style: { marginTop: "30px" } },
      h("h1", { style: { fontSize: "20px" } }, "Dernières exécutions")),

    passages.length
      ? table(["Agent", "Déclenchée", "Statut", "Début", { titre: "Durée", num: true },
               { titre: "Jetons", num: true }, { titre: "Coût", num: true }],
          passages, function (p) {
            return h("tr",
              h("td", {}, p.agent),
              h("td", {}, h("span.faint", { style: { fontSize: "13px" } },
                DECLENCHEURS[p.declencheur] || p.declencheur)),
              h("td", {}, p.statut === "echoue" && p.erreur
                ? h("span", { title: p.erreur }, puce(p.statut))
                : puce(p.statut)),
              h("td", {}, quand(p.debut)),
              h("td.num", {}, duree(p.debut, p.fin)),
              h("td.num", {}, (Number(p.jetons_entree) || 0) + (Number(p.jetons_sortie) || 0) || "—"),
              h("td.num", {}, cout(p.cout_usd)));
          })
      : h("p.faint", {}, "Aucun agent n'a encore tourné : le lanceur reste à écrire."));
}
