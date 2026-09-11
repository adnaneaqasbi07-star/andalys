/* =====================================================================
   ANDALYS — marque
   ---------------------------------------------------------------------
   Le symbole du logo, dessiné au trait : l'arche en accolade des portes
   de Fès, le khatem à huit pétales des zelliges, le A à empattements, et
   — c'est le cœur de la marque — le croissant et les étoiles.

   La géométrie n'est pas ici : elle est dans `logo-formes.js`, produit
   par `bin/logo.py`. Ce module ne fait que l'habiller, pour que la marque
   suive le thème clair ou sombre. Le favicon sort du même tracé : les
   deux ne peuvent plus diverger.
   ===================================================================== */

import { VUE, ARCHE, ROSETTE, ETOILE_CENTRE, LETTRE_A, CROISSANT, ETINCELLES }
  from "./logo-formes.js";

const NS = "http://www.w3.org/2000/svg";

function svgVide(largeur, hauteur, vue) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", vue);
  svg.setAttribute("width", largeur);
  svg.setAttribute("height", hauteur);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  return svg;
}

function plein(d, couleur, extra) {
  return '<path d="' + d + '" fill="' + couleur + '"' + (extra || "") + "/>";
}

/**
 * Le symbole complet.
 *
 * @param {number} taille   largeur en pixels ; la hauteur suit la proportion
 * @param {object} options  { or, vert } pour poser d'autres couleurs —
 *                          le hero, par exemple, pose un vert ivoire parce
 *                          que la marque y est sur fond sombre
 */
export function marque(taille, options) {
  options = options || {};
  const l = taille || 34;
  const h = Math.round(l * VUE.hauteur / VUE.largeur);
  const or = options.or || "var(--gold-2)";
  const vert = options.vert || "var(--accent)";

  const svg = svgVide(l, h, "0 0 " + VUE.largeur + " " + VUE.hauteur);
  const m = [];

  m.push('<path d="' + ARCHE + '" fill="none" stroke="' + or + '" ' +
         'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>');
  /* La rosette est en filets et non en aplat : c'est ainsi qu'elle est
     posée sur les murs, et c'est ce qui la distingue d'une étoile pleine. */
  ROSETTE.forEach(function (petale) {
    m.push('<path d="' + petale + '" fill="none" stroke="' + or + '" ' +
           'stroke-width="1.82" stroke-linejoin="round"/>');
  });
  m.push(plein(ETOILE_CENTRE, or));

  /* Le A est d'un seul tenant, et il n'a pas de barre : c'est le
     croissant qui passe là où on l'attendrait. */
  m.push(plein(LETTRE_A, vert));

  /* Le croissant et les deux étoiles passent APRÈS le A : ils se lisent
     en travers de la panse, comme sur le logo. */
  m.push(plein(CROISSANT.chemin, or, ' transform="' + CROISSANT.transforme + '"'));
  ETINCELLES.forEach(function (e) { m.push(plein(e, or)); });

  svg.innerHTML = m.join("");
  return svg;
}

/**
 * La marque en pastille pleine, pour les petites surfaces.
 * La rosette en est retirée : sous 40 px, ses huit pétales ne font plus
 * qu'une tache. Restent l'arche, le A et une étoile.
 */
export function pastille(taille) {
  const s = taille || 40;
  const svg = svgVide(s, s, "0 0 140 140");
  const m = ['<circle cx="70" cy="70" r="69" fill="var(--accent)"/>',
             '<g transform="translate(10 6) scale(1)">'];
  m.push('<path d="' + ARCHE + '" fill="none" stroke="var(--gold-2)" ' +
         'stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>');
  m.push(plein(LETTRE_A, "var(--gold-2)"));
  m.push("</g>");
  svg.innerHTML = m.join("");
  return svg;
}

/** L'arche seule, pour les décors qui l'encadrent ailleurs dans le site. */
export const CHEMIN_ARCHE = ARCHE;
