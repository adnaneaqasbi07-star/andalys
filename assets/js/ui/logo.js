/* Le khatim fassi : l'étoile à huit branches des zelliges de la médina. */
export function marque(taille) {
  const s = taille || 34;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", s); svg.setAttribute("height", s);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<circle cx="32" cy="32" r="31" fill="var(--accent)"/>' +
    '<path d="M32 9 38.6 25.4 55 32 38.6 38.6 32 55 25.4 38.6 9 32 25.4 25.4Z" ' +
      'fill="none" stroke="var(--gold-2)" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<rect x="20" y="20" width="24" height="24" transform="rotate(45 32 32)" ' +
      'fill="none" stroke="var(--gold-2)" stroke-width="1.4" opacity=".7"/>' +
    '<circle cx="32" cy="32" r="5" fill="var(--gold-2)"/>';
  return svg;
}
