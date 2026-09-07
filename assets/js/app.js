/* =====================================================================
   ESSENCE DE FÈS — amorçage de la boutique
   ---------------------------------------------------------------------
   Modules ES natifs, aucun empaqueteur : le dossier déployé est
   exactement le dossier du dépôt. Les vues sont chargées à la demande,
   la page d'accueil ne télécharge donc pas le tunnel de commande.
   ===================================================================== */

import { h, $, remplir, notice } from "./core/dom.js";
import { t, L } from "./i18n/index.js";
import { detecterLangue, definirLangue } from "./i18n/index.js";
import * as routeur from "./core/routeur.js";
import { etat } from "./core/etat.js";
import * as coque from "./ui/coque.js";
import * as catalogue from "./data/catalogue.js";
import * as panier from "./data/panier.js";
import * as favoris from "./data/favoris.js";
import { demarrerSession } from "./data/compte.js";

let principal = null;

/* ------------------------------------------------------------------ */
/* Chargement paresseux des vues                                       */
/* ------------------------------------------------------------------ */
const cache = {};
function vue(chemin) {
  return function () {
    const args = Array.prototype.slice.call(arguments);
    const p = cache[chemin] || (cache[chemin] = import("./views/" + chemin + ".js"));
    return p.then(function (m) { return (m.default || m[Object.keys(m)[0]]).apply(null, args); })
            .catch(function (e) {
              console.error(chemin, e);
              remplir(args[0], h("div.wrap.section", h("div.vide-etat",
                h("div.em", {}, "⚠️"), h("h3", {}, t("erreur")), h("p", {}, e.message || ""))));
            });
  };
}

function vueNommee(chemin, nom) {
  return function () {
    const args = Array.prototype.slice.call(arguments);
    const p = cache[chemin] || (cache[chemin] = import("./views/" + chemin + ".js"));
    return p.then(function (m) { return m[nom].apply(null, args); });
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */
function attendreCatalogue(f) {
  return async function (hote, params, chemin) {
    if (!etat.chargeCatalogue) {
      try { await catalogue.chargerReferentiels(); } catch (e) { /* signalé plus bas */ }
    }
    return f(hote, params, chemin);
  };
}

/* L'accueil montre les portes de la médina : il lui faut le référentiel.
   Sans cette attente, la grille des portes n'apparaît que si la requête
   revient avant le chargement du module — une course qu'on gagne en local
   et qu'on perd sur un réseau lent. */
routeur.definir("/",          attendreCatalogue(vue("accueil")));
routeur.definir("/produits",  attendreCatalogue(function (hote) {
  return vue("liste")(hote, { base: "/produits" });
}));
routeur.definir("/c/:slug",   attendreCatalogue(function (hote, p) {
  const c = catalogue.categorieParSlug(p.slug);
  if (!c) return vue("liste")(hote, { base: "/produits" });
  return vue("liste")(hote, { base: "/c/" + p.slug, categorie: c });
}));
routeur.definir("/m/:slug",   attendreCatalogue(function (hote, p) {
  const m = catalogue.marqueParSlug(p.slug);
  if (!m) return vue("liste")(hote, { base: "/produits" });
  return vue("liste")(hote, { base: "/m/" + p.slug, marque: m });
}));
routeur.definir("/recherche", attendreCatalogue(function (hote) {
  const q = routeur.analyser().requete.get("q") || "";
  return vue("liste")(hote, { base: "/recherche", recherche: q });
}));
routeur.definir("/p/:slug",       attendreCatalogue(vue("fiche")));
routeur.definir("/panier",        vue("panier"));
routeur.definir("/commande",      attendreCatalogue(vue("commande")));
routeur.definir("/merci/:numero", vue("merci"));
routeur.definir("/suivi",         vue("suivi"));
routeur.definir("/favoris",       vue("favoris"));
routeur.definir("/connexion",     vueNommee("compte", "connexion"));
routeur.definir("/compte",           vue("compte"));
routeur.definir("/compte/commandes", vue("compte"));
routeur.definir("/compte/adresses",  vue("compte"));
routeur.definir("/journal",          vue("journal"));
routeur.definir("/journal/:slug",    attendreCatalogue(vue("article")));
routeur.definir("/page/:slug",       vue("page"));

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */
function rendre(route) {
  if (!principal) return;
  coque.majNavigation();
  coque.majBarreMobile();
  const b = etat.parametres.boutique || {};
  document.title = ((L(b.nom) || "Andalys") + " — " + (L(b.signature) || "Trésor de Fès"));

  if (!route) {
    remplir(principal, h("div.wrap.section", h("div.vide-etat",
      h("div.em", {}, "🕳"),
      h("h3", {}, t("aucun_resultat")),
      h("a.btn.btn-primary", { href: "#/" }, t("accueil")))));
    return;
  }
  try { route.vue(principal, route.params, route.chemin); }
  catch (e) {
    console.error(e);
    remplir(principal, h("div.wrap.section", h("div.vide-etat",
      h("div.em", {}, "⚠️"), h("h3", {}, t("erreur")), h("p", {}, e.message || ""))));
  }
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */
async function demarrer() {
  coque.appliquerTheme(coque.themeMemorise());
  definirLangue(detecterLangue(), true);

  principal = coque.construire();

  /* La langue change : on reconstruit la coque avant que le routeur
     ne redessine la vue (nos écouteurs sont posés en premier). */
  window.addEventListener("langue", function () { principal = coque.construire(); });

  panier.charger();

  const retour = await demarrerSession();
  if (retour && retour.erreur) notice(retour.erreur, true);

  favoris.charger();

  catalogue.chargerReferentiels().catch(function (e) {
    console.error(e);
    const message = e.schemaNonExpose
      ? t("schema_absent") + " — Supabase › Settings › API › Exposed schemas : « boutique »"
      : (e.message || t("erreur_reseau"));
    notice(message, true);
  });

  routeur.demarrer(rendre);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () { /* hors ligne */ });
    });
  }
}

demarrer();
