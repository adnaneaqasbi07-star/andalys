/* =====================================================================
   ANDALYS — les formes de la marque
   ---------------------------------------------------------------------
   ⚠️ Fichier produit par `bin/logo.py`. Ne pas modifier à la main : la
   commande le réécrit. La géométrie est là-bas, avec ses explications.

   Ce module ne porte que des chemins, sans couleur : c'est `logo.js` qui
   les habille, pour que la marque suive le thème clair ou sombre. Le
   fichier statique `assets/img/logo-symbole.svg` sort du même tracé —
   c'est ce qui garantit que le favicon et le logo du site sont le même
   dessin.
   ===================================================================== */

export const VUE = { largeur: 120, hauteur: 150 };

export const ARCHE = "M28 122 L28 54 C28 36 36 26 48 18 C55 14 58.5 12 60 5 C61.5 12 65 14 72 18 C84 26 92 36 92 54 L92 122";

export const ROSETTE = [
  "M60 26.4 Q55.33 20.07 60 12.5 Q64.67 20.07 60 26.4Z",
  "M62.55 27.45 Q63.71 19.68 72.37 17.63 Q70.32 26.29 62.55 27.45Z",
  "M63.6 30 Q69.93 25.33 77.5 30 Q69.93 34.67 63.6 30Z",
  "M62.55 32.55 Q70.32 33.71 72.37 42.37 Q63.71 40.32 62.55 32.55Z",
  "M60 33.6 Q64.67 39.93 60 47.5 Q55.33 39.93 60 33.6Z",
  "M57.45 32.55 Q56.29 40.32 47.63 42.37 Q49.68 33.71 57.45 32.55Z",
  "M56.4 30 Q50.07 34.67 42.5 30 Q50.07 25.33 56.4 30Z",
  "M57.45 27.45 Q49.68 26.29 47.63 17.63 Q56.29 19.68 57.45 27.45Z"
];

export const ETOILE_CENTRE = "M60 24.4 L60.86 27.93 L63.96 26.04 L62.07 29.14 L65.6 30 L62.07 30.86 L63.96 33.96 L60.86 32.07 L60 35.6 L59.14 32.07 L56.04 33.96 L57.93 30.86 L54.4 30 L57.93 29.14 L56.04 26.04 L59.14 27.93 Z";

export const A = {
  panse:   "M57.6 54 L61.4 54 L44 122 L35.8 122 Z",
  fut:     "M58.6 54 L63.4 54 L86.5 122 L73 122 Z",
  drapeau: "M57.8 54 L51.6 55.2 L56.6 61 Z",
  barre:   "M46.6 98.5 L77.6 98.5 L79.2 103.6 L44.8 103.6 Z",
  piedG:   "M32 117.6 L48.6 117.6 L48.6 122 L32 122 Z",
  piedD:   "M69 117.6 L89.5 117.6 L89.5 122 L69 122 Z"
};

export const CROISSANT = { chemin: "M49 66 A 12 12 0 1 0 49 90 A 15.12 15.12 0 0 1 49 66Z", transforme: "rotate(-40 49 78)" };

export const ETINCELLES = [
  "M68.5 62.4 Q68.5 71 73.5 71 Q68.5 71 68.5 79.6 Q68.5 71 63.5 71 Q68.5 71 68.5 62.4Z",
  "M66.5 84.8 Q66.5 92 70.7 92 Q66.5 92 66.5 99.2 Q66.5 92 62.3 92 Q66.5 92 66.5 84.8Z"
];
