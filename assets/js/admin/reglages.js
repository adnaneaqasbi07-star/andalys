/* =====================================================================
   Réglages : identité de la boutique, livraison, textes des pages
   légales. Tout vit dans boutique.parametres, modifiable sans
   redéploiement.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { lire, inserer } from "../core/supa.js";
import { etat } from "../core/etat.js";
import { trilingue, champ } from "./commun.js";

async function enregistrer(cle, valeur) {
  await inserer("parametres", { cle: cle, valeur: valeur }, { surConflit: "cle" });
  etat.parametres[cle] = valeur;
}

function bloc(titre, contenu, surEnregistrer) {
  const bouton = h("button.btn.btn-primary", { type: "button" }, t("enregistrer"));
  bouton.addEventListener("click", async function () {
    bouton.disabled = true;
    try { await surEnregistrer(); notice(t("enregistrer") + " ✓"); }
    catch (e) { notice(e.message || t("erreur"), true); }
    bouton.disabled = false;
  });
  return h("fieldset.fieldset", h("legend", {}, titre), contenu,
    h("div", { style: { marginTop: "10px" } }, bouton));
}

export default async function reglages(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Réglages")), h("p.faint", {}, t("chargement")));

  let params = {};
  try {
    const lignes = await lire("parametres", { select: "cle,valeur" });
    lignes.forEach(function (p) { params[p.cle] = p.valeur; });
  } catch (e) {
    remplir(hote, h("div.vide-etat", h("div.em", {}, "⚠️"), h("h3", {}, e.message || t("erreur"))));
    return;
  }

  /* --- identité --- */
  const b = params.boutique || {};
  const nom = trilingue(b.nom, { libelle: "Nom de la boutique", requis: true });
  const baseline = trilingue(b.baseline, { libelle: "Accroche d'accueil", zone: true, rows: 2 });
  const adresse = trilingue(b.adresse, { libelle: "Adresse", zone: true, rows: 2 });
  const cTel = champ("Téléphone", b.telephone);
  const cWA = champ("WhatsApp", b.whatsapp, { aide: "Format international, ex. 212612345678" });
  const cEmail = champ("E-mail", b.email, { type: "email" });
  const cInsta = champ("Instagram", b.instagram);
  const cFB = champ("Facebook", b.facebook);

  /* --- livraison --- */
  const l = params.livraison || {};
  const cGratuite = champ("Livraison offerte à partir de (MAD)", l.gratuite_des,
    { type: "number", step: "1", min: "0",
      aide: "Ce seuil s'applique aux zones qui n'ont pas leur propre valeur." });
  const messageLivraison = trilingue(l.message, { libelle: "Message affiché en haut du site" });

  /* --- pages --- */
  const pages = [
    ["page_conditions", "Conditions de vente"],
    ["page_confidentialite", "Politique de confidentialité"],
    ["page_mentions", "Mentions légales"],
    ["page_contact", "Page contact"]
  ].map(function (p) {
    const tr = trilingue(params[p[0]], { libelle: p[1], zone: true, rows: 8 });
    return { cle: p[0], titre: p[1], tr: tr };
  });

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Réglages")),

    bloc("Identité",
      h("div", nom.element, baseline.element,
        h("div.grid-2", cTel.element, cWA.element),
        h("div.grid-2", cEmail.element, cInsta.element),
        cFB.element, adresse.element),
      function () {
        return enregistrer("boutique", Object.assign({}, b, {
          nom: nom.valeur(), baseline: baseline.valeur(), adresse: adresse.valeur(),
          telephone: cTel.valeur(), whatsapp: cWA.valeur(), email: cEmail.valeur(),
          instagram: cInsta.valeur(), facebook: cFB.valeur(), devise: "MAD"
        }));
      }),

    bloc("Livraison",
      h("div", cGratuite.element, messageLivraison.element),
      function () {
        return enregistrer("livraison", Object.assign({}, l, {
          gratuite_des: cGratuite.valeur() || 0,
          message: messageLivraison.valeur()
        }));
      }),

    h("h2", { style: { marginTop: "28px" } }, "Pages légales"),
    pages.map(function (p) {
      return bloc(p.titre, p.tr.element, function () {
        return enregistrer(p.cle, p.tr.valeur());
      });
    }));
}
