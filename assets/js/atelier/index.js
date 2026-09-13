/* =====================================================================
   L'atelier — amorçage, contrôle d'accès, navigation.
   ---------------------------------------------------------------------
   Même serrure que le back-office : celle qui compte est dans Postgres.
   Les tables `ia_*` ne rendent pas une ligne à qui n'est pas
   administrateur, et `decider_validation()` refuse tout le reste.

   Cette page est séparée du back-office à dessein. On n'y vient pas pour
   la même chose : là-bas on gère une boutique, ici on pilote des agents.
   Les deux se tiennent par un lien dans leur volet gauche.
   ===================================================================== */

import { h, $, remplir } from "../core/dom.js";
import { t, detecterLangue, definirLangue } from "../i18n/index.js";
import * as routeur from "../core/routeur.js";
import { etat } from "../core/etat.js";
import { demarrerSession, deconnexion } from "../data/compte.js";
import { rpc, messageErreur } from "../core/supa.js";
import { marque } from "../ui/logo.js";
import { portail } from "../ui/portail.js";
import { appliquerTheme, themeMemorise } from "../ui/coque.js";

const SECTIONS = [
  ["/",            "◧", "Accueil"],
  ["/validations", "⚖", "Validations"],
  ["/taches",      "✓", "Tâches"],
  ["/agents",      "✺", "Agents"],
  ["/veille",      "🔎", "Veille"],
  ["/cadence",     "⏱", "Planification"],
  ["/journal",     "📜", "Journal"],
  ["/cles",        "🔑", "Clés"]
];

let corps = null;
let pastille = null;

/* ------------------------------------------------------------------ */
function flanc() {
  const nav = h("nav.adm-flanc",
    h("div.titre", marque(30),
      h("span", {}, h("div.nm", {}, "ANDALYS"), h("div.sub", {}, "Atelier IA"))));

  SECTIONS.forEach(function (s) {
    const lien = h("a", { href: "#" + s[0], "data-chemin": s[0] },
      h("span", { "aria-hidden": "true" }, s[1]), h("span.grow", {}, s[2]));
    /* Le nombre de validations en attente est la seule information que
       l'on veut voir sans ouvrir l'écran : c'est ce qui bloque le reste. */
    if (s[0] === "/validations") {
      pastille = h("span.badge.badge-new", { hidden: true });
      lien.appendChild(pastille);
    }
    nav.appendChild(lien);
  });

  nav.appendChild(h("div.sep",
    h("a", { href: "admin.html" }, "◧", "Back-office"),
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

document.addEventListener("atelier:attente", function (e) {
  if (!pastille) return;
  const n = Number(e.detail) || 0;
  pastille.textContent = String(n);
  pastille.hidden = n === 0;
});

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

routeur.definir("/",                 section("accueil"));
routeur.definir("/validations",      section("validations"));
routeur.definir("/validations/:id",  section("validations"));
routeur.definir("/taches",           section("taches"));
routeur.definir("/agents",           section("agents"));
routeur.definir("/agents/:code",     section("agents"));
routeur.definir("/veille",           section("rapports"));
routeur.definir("/cadence",          section("planifications"));
routeur.definir("/journal",          section("journal"));
routeur.definir("/cles",             section("cles"));

function rendre(route) {
  majFlanc();
  if (!route) { remplir(corps, h("div.vide-etat", h("h3", {}, t("aucun_resultat")))); return; }
  route.vue(corps, route.params, route.chemin);
}


/* ------------------------------------------------------------------ */
/* Ne jamais rester sur un écran vide                                  */
/* ------------------------------------------------------------------ */
/* Le gabarit de `atelier.html` affiche « ANDALYS » en attendant que le
   JavaScript prenne la main. Si quoi que ce soit échoue avant — un
   module absent, une réponse illisible, un réseau coupé — ce gabarit
   reste à l'écran pour toujours, et seule la console le dit. Pour qui
   n'ouvre pas la console, c'est une page noire sans explication.

   On rattrape donc tout : l'échec du démarrage, les erreurs de scripts
   et les promesses non tenues. Mieux vaut un message laid qu'un écran
   muet. */
function panne(raison) {
  const cible = $("#atl");
  if (!cible || cible.dataset.enPanne) return;
  cible.dataset.enPanne = "1";
  remplir(cible, h("div", {
    style: { minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }
  },
    h("div.card.card-pad", { style: { maxWidth: "560px" } },
      h("h1", { style: { fontSize: "20px", marginTop: 0 } }, "L'atelier n'a pas pu démarrer"),
      h("p", {}, String((raison && (raison.message || raison)) || "raison inconnue")),
      h("p.faint", { style: { fontSize: "13px" } },
        "Le plus souvent : un fichier servi depuis le cache du navigateur. "),
      h("p.faint", { style: { fontSize: "13px" } },
        "Rechargez en forçant — ⌘⇧R — ou vérifiez que le serveur local tourne "
        + "depuis ~/andalys."),
      h("pre.charge", { style: { whiteSpace: "pre-wrap" } },
        String((raison && raison.stack) || "")))));
}

window.addEventListener("error", function (e) { panne(e.error || e.message); });
window.addEventListener("unhandledrejection", function (e) { panne(e.reason); });

/* ------------------------------------------------------------------ */
async function demarrer() {
  appliquerTheme(themeMemorise());
  definirLangue(detecterLangue(), true);

  /* Le retour d'une connexion Google porte parfois une erreur plutôt
     qu'un jeton — une URL de retour non autorisée, par exemple. La taire
     laisse le visiteur devant un formulaire vide, sans savoir pourquoi. */
  const retour = await demarrerSession();

  if (!etat.utilisateur) {
    portail($("#atl"), "Atelier", retour && retour.erreur ? retour.erreur : null);
    return;
  }

  /* `ia_resume()` répond { ok:false } à qui n'est pas administrateur :
     un aller-retour suffit à trancher, et il sert aussi à savoir si la
     migration de l'atelier est bien poussée. */
  let resume = null;
  try {
    resume = await rpc("ia_resume", { p_jours: 1 });
  } catch (e) {
    /* Tant que `supabase db push` n'est pas passé, la fonction n'existe
       pas : le dire, plutôt que d'afficher un écran vide. */
    remplir($("#atl"), h("div.wrap.section", h("div.vide-etat",
      h("div.em", { "aria-hidden": "true" }, "⚙"),
      h("h3", {}, e.schemaNonExpose ? t("schema_absent") : "L'atelier n'est pas encore en base"),
      h("p", {}, messageErreur(e)),
      e.indice ? h("p.faint", {}, e.indice) : null,
      h("p.faint", {}, "Pousser les migrations :  supabase db push"))));
    return;
  }

  if (!resume || !resume.ok) {
    portail($("#atl"), "Atelier", "Ce compte n'est pas administrateur de la boutique.");
    return;
  }

  corps = h("div.adm-corps");
  remplir($("#atl"), h("div.adm", flanc(), corps));

  const n = Number(resume.validations_en_attente) || 0;
  if (pastille) { pastille.textContent = String(n); pastille.hidden = n === 0; }

  routeur.demarrer(rendre);
}

demarrer().catch(panne);
