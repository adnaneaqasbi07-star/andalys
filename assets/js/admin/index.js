/* =====================================================================
   Back-office — amorçage, contrôle d'accès, navigation.
   ---------------------------------------------------------------------
   Le contrôle d'accès affiché ici n'est qu'une politesse : la vraie
   serrure est dans Postgres. Un visiteur qui ouvrirait cette page sans
   être administrateur verrait une interface vide, la base refusant
   toutes ses écritures (boutique.est_admin()).
   ===================================================================== */

import { h, $, remplir, vider, notice } from "../core/dom.js";
import { t, detecterLangue, definirLangue, LANGUES, ETIQUETTES, langue } from "../i18n/index.js";
import * as routeur from "../core/routeur.js";
import { etat } from "../core/etat.js";
import { demarrerSession, deconnexion, auth } from "../data/compte.js";
import * as catalogue from "../data/catalogue.js";
import { rpc } from "../core/supa.js";
import { marque } from "../ui/logo.js";
import { appliquerTheme, themeMemorise } from "../ui/coque.js";

const SECTIONS = [
  ["/",            "◧", "Tableau de bord"],
  ["/produits",    "✦", "Produits"],
  ["/commandes",   "📦", "Commandes"],
  ["/clients",     "👥", "Clients"],
  ["/categories",  "🗂", "Catégories"],
  ["/marques",     "🏷", "Marques"],
  ["/promos",      "％", "Promotions"],
  ["/livraison",   "🚚", "Livraison"],
  ["/reglages",    "⚙", "Réglages"]
];

let corps = null;

/* ------------------------------------------------------------------ */
function flanc() {
  const nav = h("nav.adm-flanc",
    h("div.titre", marque(30),
      h("span", {}, h("div.nm", {}, "Essence de Fès"), h("div.sub", {}, "Back-office"))));

  SECTIONS.forEach(function (s) {
    nav.appendChild(h("a", { href: "#" + s[0], "data-chemin": s[0] },
      h("span", { "aria-hidden": "true" }, s[1]), s[2]));
  });

  nav.appendChild(h("div.sep",
    h("a", { href: "index.html", target: "_blank", rel: "noopener" }, "🛍", "Voir la boutique"),
    h("a", { href: "#", onclick: function (e) {
      e.preventDefault();
      deconnexion().then(function () { location.reload(); });
    } }, "⎋", t("deconnexion"))));

  return nav;
}

function majFlanc() {
  const chemin = routeur.analyser().chemin;
  Array.prototype.forEach.call(document.querySelectorAll(".adm-flanc a[data-chemin]"), function (a) {
    const c = a.getAttribute("data-chemin");
    const actif = c === "/" ? chemin === "/" : chemin.indexOf(c) === 0;
    if (actif) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

/* ------------------------------------------------------------------ */
function ecranConnexion(message) {
  const email = h("input.input", { type: "email", autocomplete: "email" });
  const mdp = h("input.input", { type: "password", autocomplete: "current-password" });
  const bouton = h("button.btn.btn-primary.btn-block.btn-lg", { type: "submit" }, t("connexion"));

  remplir($("#adm"), h("div", {
    style: { minHeight: "100vh", display: "grid", placeItems: "center", padding: "20px" }
  },
    h("form.card.card-pad", {
      style: { width: "min(400px,100%)" }, novalidate: true,
      onsubmit: async function (e) {
        e.preventDefault();
        bouton.disabled = true;
        try {
          await auth.connexion(email.value.trim(), mdp.value);
          location.reload();
        } catch (err) { notice(err.message || t("erreur"), true); bouton.disabled = false; }
      }
    },
      h("div", { style: { display: "grid", placeItems: "center", marginBottom: "14px" } }, marque(48)),
      h("h1", { style: { textAlign: "center", fontSize: "23px" } }, "Back-office"),
      message ? h("p", { style: { textAlign: "center", color: "var(--danger)" } }, message) : null,
      h("button.btn.btn-ghost.btn-block", {
        type: "button", style: { marginBottom: "14px" },
        onclick: function () { auth.connexionGoogle(location.origin + location.pathname); }
      }, "🇬 " + t("avec_google")),
      h("div.field", h("label", {}, t("email")), email),
      h("div.field", h("label", {}, t("mot_de_passe")), mdp),
      bouton)));
}

/* ------------------------------------------------------------------ */
const cache = {};
function section(fichier) {
  return function () {
    const args = Array.prototype.slice.call(arguments);
    const p = cache[fichier] || (cache[fichier] = import("./" + fichier + ".js"));
    return p.then(function (m) { return m.default.apply(null, args); })
            .catch(function (e) {
              console.error(fichier, e);
              remplir(args[0], h("div.vide-etat", h("div.em", {}, "⚠️"),
                h("h3", {}, t("erreur")), h("p", {}, e.message || "")));
            });
  };
}

routeur.definir("/",              section("tableau"));
routeur.definir("/produits",      section("produits"));
routeur.definir("/commandes",     section("commandes"));
routeur.definir("/commandes/:id", section("commandes"));
routeur.definir("/clients",       section("clients"));
routeur.definir("/categories",    section("referentiels"));
routeur.definir("/marques",       section("referentiels"));
routeur.definir("/promos",        section("referentiels"));
routeur.definir("/livraison",     section("referentiels"));
routeur.definir("/reglages",      section("reglages"));

function rendre(route) {
  majFlanc();
  if (!route) { remplir(corps, h("div.vide-etat", h("h3", {}, t("aucun_resultat")))); return; }
  route.vue(corps, route.params, route.chemin);
}

/* ------------------------------------------------------------------ */
async function demarrer() {
  appliquerTheme(themeMemorise());
  definirLangue(detecterLangue(), true);

  await demarrerSession();

  if (!etat.utilisateur) { ecranConnexion(); return; }

  /* boutique.statistiques() répond { ok:false } à qui n'est pas
     administrateur : un aller-retour suffit à trancher. */
  let autorise = false;
  try {
    const s = await rpc("statistiques", { p_jours: 1 });
    autorise = !!(s && s.ok);
  } catch (e) {
    if (e.schemaNonExpose) {
      remplir($("#adm"), h("div.wrap.section", h("div.vide-etat",
        h("div.em", {}, "⚙"),
        h("h3", {}, t("schema_absent")),
        h("p", {}, "Supabase › Settings › API › Exposed schemas : ajouter « boutique », " +
                   "puis pousser les migrations."))));
      return;
    }
    autorise = false;
  }

  if (!autorise) {
    ecranConnexion("Ce compte n'est pas administrateur de la boutique.");
    return;
  }

  corps = h("div.adm-corps");
  remplir($("#adm"), h("div.adm", flanc(), corps));

  try { await catalogue.chargerReferentiels(); }
  catch (e) { notice(e.message || t("erreur_reseau"), true); }

  routeur.demarrer(rendre);
}

demarrer();
