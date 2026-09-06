/* =====================================================================
   Routeur par fragment (#/…)
   ---------------------------------------------------------------------
   Le fragment plutôt que l'History API : GitHub Pages sert des fichiers
   statiques, une URL profonde rechargée renverrait sinon une 404. Ce
   choix rend aussi l'installation dans un sous-dossier indifférente au
   chemin du site.
   ===================================================================== */

const routes = [];
let rendu = null;      /* fonction appelée à chaque changement */
let courante = null;

/** definir("/p/:slug", vue) — :param capture un segment. */
export function definir(motif, vue) {
  const noms = [];
  const regex = new RegExp("^" + motif
    .replace(/\/:([\w]+)/g, function (_, n) { noms.push(n); return "/([^/]+)"; })
    .replace(/\*$/, ".*") + "$");
  routes.push({ regex: regex, noms: noms, vue: vue, motif: motif });
}

export function analyser() {
  const brut = (location.hash || "#/").replace(/^#/, "");
  const coupe = brut.indexOf("?");
  const chemin = decodeURI(coupe < 0 ? brut : brut.slice(0, coupe)) || "/";
  const requete = new URLSearchParams(coupe < 0 ? "" : brut.slice(coupe + 1));
  return { chemin: chemin, requete: requete };
}

export function resoudre() {
  const { chemin, requete } = analyser();
  for (const r of routes) {
    const m = r.regex.exec(chemin);
    if (!m) continue;
    const params = {};
    r.noms.forEach(function (n, i) { params[n] = decodeURIComponent(m[i + 1]); });
    return { vue: r.vue, params: params, requete: requete, chemin: chemin, motif: r.motif };
  }
  return null;
}

export function aller(chemin, remplacer) {
  const cible = "#" + (chemin.startsWith("/") ? chemin : "/" + chemin);
  if (location.hash === cible) { declencher(); return; }
  if (remplacer) history.replaceState(null, "", cible);
  else location.hash = cible;
}

export function lien(chemin) { return "#" + (chemin.startsWith("/") ? chemin : "/" + chemin); }

function declencher() {
  const r = resoudre();
  courante = r;
  if (rendu) rendu(r);
}

export function routeCourante() { return courante; }

export function demarrer(surChangement) {
  rendu = surChangement;
  window.addEventListener("hashchange", declencher);
  window.addEventListener("langue", declencher);
  if (!location.hash) history.replaceState(null, "", "#/");
  declencher();
}
