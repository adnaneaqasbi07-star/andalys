/* =====================================================================
   ANDALYS — marque
   ---------------------------------------------------------------------
   L'arche outrepassée des portes de Fès, la rosette à huit branches des
   zelliges, et le « A » de la maison. Dessiné en SVG plutôt qu'en image :
   il suit les couleurs du thème et reste net à toute taille.
   ===================================================================== */

const NS = "http://www.w3.org/2000/svg";

/** Rosette à huit branches — le motif des zelliges fassis. */
function rosette(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const rayon = i % 2 === 0 ? r : r * 0.42;
    const a = (i * Math.PI) / 8;
    pts.push((cx + rayon * Math.sin(a)).toFixed(2) + "," + (cy - rayon * Math.cos(a)).toFixed(2));
  }
  return pts.join(" ");
}

/**
 * @param {number} taille   côté en pixels
 * @param {object} options  { monochrome: true } pour un tracé d'une seule couleur
 */
export function marque(taille, options) {
  options = options || {};
  const s = taille || 34;
  const or   = options.or   || "var(--gold-2)";
  const vert = options.vert || "var(--accent)";

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 78");
  svg.setAttribute("width", s);
  svg.setAttribute("height", Math.round(s * 78 / 64));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");

  /* L'arche : montants droits, épaulement outrepassé, pointe brisée. */
  const arche = "M6 74 L6 30 C6 13 17 3 32 3 C47 3 58 13 58 30 L58 74";

  svg.innerHTML =
    '<path d="' + arche + '" stroke="' + or + '" stroke-width="3" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polygon points="' + rosette(32, 20, 8.5) + '" fill="' + or + '"/>' +
    '<text x="32" y="63" text-anchor="middle" fill="' + vert + '" ' +
      'font-family="Cormorant Garamond, Marcellus, Georgia, serif" ' +
      'font-size="36" font-weight="600" letter-spacing="0">A</text>' +
    '<path d="M45 44 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6Z" ' +
      'fill="' + or + '"/>';
  return svg;
}

/** Version en pastille pleine, pour les favicons et les petites surfaces. */
export function pastille(taille) {
  const s = taille || 40;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", s); svg.setAttribute("height", s);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<circle cx="32" cy="32" r="31" fill="var(--accent)"/>' +
    '<path d="M18 52 L18 28 C18 18 24 12 32 12 C40 12 46 18 46 28 L46 52" ' +
      'stroke="var(--gold-2)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<polygon points="' + rosette(32, 24, 5.5) + '" fill="var(--gold-2)"/>' +
    '<text x="32" y="50" text-anchor="middle" fill="var(--gold-2)" ' +
      'font-family="Cormorant Garamond, Georgia, serif" font-size="22" font-weight="600">A</text>';
  return svg;
}

/**
 * L'arche décorative qui encadre une porte de la médina sur l'accueil.
 * Renvoie une chaîne de chemin SVG, à poser dans un viewBox 0 0 100 120.
 */
export const CHEMIN_ARCHE =
  "M8 118 L8 46 C8 20 18 4 50 4 C82 4 92 20 92 46 L92 118";
