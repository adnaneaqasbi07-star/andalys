/* =====================================================================
   État partagé de l'application.
   Un objet, des événements. Pas de bibliothèque : les vues s'abonnent à
   ce qui les concerne et se redessinent elles-mêmes.
   ===================================================================== */

export const etat = {
  utilisateur: null,     /* { id, email, nom } ou null */
  estAdmin: false,
  pretAuth: false,
  panier: [],            /* voir data/panier.js */
  favoris: new Set(),    /* identifiants de produits */
  parametres: {},        /* boutique.parametres, indexé par clé */
  categories: [],
  marques: [],
  zones: [],
  chargeCatalogue: false
};

const abonnes = {};

export function surEtat(evenement, f) {
  (abonnes[evenement] = abonnes[evenement] || []).push(f);
  return function () {
    abonnes[evenement] = (abonnes[evenement] || []).filter(function (g) { return g !== f; });
  };
}

export function emettre(evenement, donnees) {
  (abonnes[evenement] || []).forEach(function (f) {
    try { f(donnees); } catch (e) { console.error(evenement, e); }
  });
}
