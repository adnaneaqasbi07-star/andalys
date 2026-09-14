/* =====================================================================
   Le courrier — la boîte, vue par l'atelier.
   ---------------------------------------------------------------------
   Ce n'est pas un client de messagerie, et cela ne doit pas le devenir :
   le corps des messages n'est pas en base, volontairement. On voit ici
   qui a écrit, à quel sujet, ce que l'agent en a compris, et le brouillon
   qu'il propose. Pour lire le message entier, on ouvre sa boîte — il y
   est, l'agent n'y a pas touché.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { lire, modifier, messageErreur } from "../core/supa.js";
import { table, vide, panneau, fermerPanneau } from "../admin/commun.js";
import { puce, mono, quand, exact, ecranErreur } from "./commun.js";

const ONGLETS = [
  ["recu",     "À traiter"],
  ["traite",   "Traités"],
  ["repondu",  "Répondus"],
  ["ignore",   "Ignorés"],
  ["",         "Tous"]
];

const CLASSEMENTS = {
  client: "client", fournisseur: "fournisseur", facture: "facture",
  urgence: "urgence", indesirable: "indésirable", autre: "autre"
};

function urgence(u) {
  return h("span.badge" + (u === "haute" ? ".badge-promo" : u === "basse" ? "" : ".badge-new"),
    {}, u || "normale");
}

/* ------------------------------------------------------------------ */
function detail(e, recharger) {
  async function marquer(statut) {
    try {
      await modifier("emails", { id: "eq." + e.id }, { statut: statut });
      notice(statut === "traite" ? "Marqué traité." : "Marqué ignoré.");
      fermerPanneau();
      recharger();
    } catch (err) { notice(messageErreur(err), true); }
  }

  const actions = e.actions || [];
  const boutons = [];
  if (e.statut === "recu") {
    boutons.push(h("button.btn.btn-primary", { type: "button",
      onclick: function () { marquer("traite"); } }, "C'est traité"));
    boutons.push(h("button.btn.btn-ghost", { type: "button",
      onclick: function () { marquer("ignore"); } }, "Ignorer"));
  }

  panneau(e.sujet || "(sans sujet)", h("div", {},
    h("div.row", { style: { gap: "8px", flexWrap: "wrap", marginBottom: "12px" } },
      puce(e.statut), urgence(e.urgence),
      e.classement ? h("span.badge", {}, CLASSEMENTS[e.classement] || e.classement) : null),

    h("p", { style: { margin: "0 0 4px" } },
      h("strong", {}, e.expediteur_nom || e.expediteur)),
    h("p.faint", { style: { margin: 0, fontSize: "13px" } },
      e.expediteur + " · reçu le " + exact(e.recu_le)),

    h("div.fieldset", h("legend", {}, "Ce que l'agent en a compris"),
      h("p", { style: { margin: 0, lineHeight: "1.6" } }, e.resume || "—")),

    e.extrait
      ? h("div.fieldset", h("legend", {}, "Début du message"),
          h("p.faint", { style: { margin: 0, fontSize: "13.5px", lineHeight: "1.55" } },
            e.extrait),
          h("div.hint", {}, "Les premiers caractères seulement. Le message entier est "
            + "resté dans votre boîte — l'agent ne l'a ni marqué lu, ni déplacé."))
      : h("div.fieldset", h("legend", {}, "Début du message"),
          h("p.faint", { style: { margin: 0 } },
            "Rien n'a été conservé : ce courrier contenait des données bancaires.")),

    actions.length
      ? h("div.fieldset", h("legend", {}, "Actions relevées (" + actions.length + ")"),
          h("div", { style: { display: "grid", gap: "8px" } }, actions.map(function (a) {
            return h("div", {}, h("strong", {}, a.titre),
              a.detail ? h("p.faint", { style: { margin: "2px 0 0", fontSize: "13px" } },
                           a.detail) : null);
          })))
      : null,

    e.brouillon
      ? h("div.fieldset", h("legend", {}, "Brouillon de réponse"),
          h("pre.charge", { style: { whiteSpace: "pre-wrap" } }, e.brouillon),
          e.validation_id
            ? h("p", { style: { margin: "8px 0 0" } },
                h("a", { href: "#/validations/" + e.validation_id },
                  "→ le dossier à approuver"))
            : h("div.hint", {}, "Aucune validation déposée : ce brouillon n'a pas été "
                + "jugé prêt à partir."))
      : null,

    h("p.faint", { style: { fontSize: "12.5px" } },
      "Identifiant du message : ", mono(e.message_id))),
    boutons.concat([h("button.btn.btn-quiet", { type: "button", onclick: fermerPanneau },
                      "Fermer")]));
}

/* ------------------------------------------------------------------ */
export default async function courrier(hote) {
  let onglet = "recu";
  const zone = h("div");
  const compte = h("span.faint");
  const recherche = h("input.input.grow", { type: "search", placeholder: "Chercher…" });
  const parClasse = h("select.select", {},
    h("option", { value: "" }, "Tous les classements"),
    Object.keys(CLASSEMENTS).map(function (c) {
      return h("option", { value: c }, CLASSEMENTS[c]);
    }));

  let tout = [];
  const recharger = function () { courrier(hote); };

  try {
    tout = await lire("emails", {
      select: "id,message_id,boite,expediteur,expediteur_nom,sujet,recu_le,extrait,classement,urgence,resume,actions,brouillon,statut,execution_id,tache_id,validation_id,cree_le",
      order: "recu_le.desc", limit: 300
    });
  } catch (e) { ecranErreur(hote, e); return; }

  function dessiner() {
    const q = recherche.value.trim().toLowerCase();
    const c = parClasse.value;
    let vues = tout.filter(function (e) {
      if (onglet && e.statut !== onglet) return false;
      if (c && e.classement !== c) return false;
      if (q && ((e.sujet || "") + " " + e.expediteur + " " + (e.resume || ""))
                 .toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    /* Les urgents d'abord : c'est la seule chose qu'on veut voir en
       ouvrant cet écran un matin. */
    vues.sort(function (x, y) {
      const rang = { haute: 0, normale: 1, basse: 2 };
      const dx = rang[x.urgence] === undefined ? 1 : rang[x.urgence];
      const dy = rang[y.urgence] === undefined ? 1 : rang[y.urgence];
      if (dx !== dy) return dx - dy;
      return String(y.recu_le || "").localeCompare(String(x.recu_le || ""));
    });

    compte.textContent = vues.length + (vues.length > 1 ? " messages" : " message");

    remplir(zone, vues.length
      ? table(["Reçu", "De", "Sujet", "Classement", "Urgence", "Réponse", ""],
          vues, function (e) {
            return h("tr",
              h("td", {}, quand(e.recu_le)),
              h("td", {},
                h("div", {}, e.expediteur_nom || e.expediteur),
                e.expediteur_nom
                  ? h("span.faint", { style: { fontSize: "12px" } }, e.expediteur) : null),
              h("td", { style: { maxWidth: "360px" } },
                h("div", {}, h("strong", {}, e.sujet || "(sans sujet)")),
                e.resume ? h("span.faint", { style: { fontSize: "12.5px" } },
                             e.resume.slice(0, 100) + (e.resume.length > 100 ? "…" : "")) : null),
              h("td", {}, e.classement
                ? h("span.badge", {}, CLASSEMENTS[e.classement] || e.classement)
                : h("span.faint", {}, "—")),
              h("td", {}, urgence(e.urgence)),
              h("td", {}, e.validation_id
                ? h("a", { href: "#/validations/" + e.validation_id }, "à approuver")
                : e.brouillon ? h("span.faint", {}, "brouillon")
                              : h("span.faint", {}, "—")),
              h("td", {}, h("button.btn.btn-quiet.btn-sm", {
                type: "button", onclick: function () { detail(e, recharger); } }, "Voir")));
          })
      : vide(onglet === "recu" ? "Rien à traiter" : "Aucun message dans cet état"));
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
  parClasse.addEventListener("change", dessiner);

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Courrier"), compte,
      h("span.grow"),
      h("span.faint", { style: { fontSize: "12.5px" },
                        title: "Lecture en readonly et BODY.PEEK : rien n'est marqué lu" },
        "✉ la boîte n'est pas touchée")),
    barre,
    h("div.outils", recherche, parClasse),
    zone);

  dessiner();
}
