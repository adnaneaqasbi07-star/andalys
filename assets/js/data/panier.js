/* =====================================================================
   Panier — conservé dans le navigateur, envoyé au serveur seulement au
   moment de commander. Les prix mémorisés ici servent uniquement à
   l'affichage : c'est Postgres qui fixe le montant réel.
   ===================================================================== */

import { APP } from "../core/config.js";
import { etat, emettre } from "../core/etat.js";

function lire() {
  try {
    const v = JSON.parse(localStorage.getItem(APP.clePanier) || "[]");
    return Array.isArray(v) ? v.filter(function (l) { return l && l.produit_id && l.quantite > 0; }) : [];
  } catch (e) { return []; }
}

function ecrire() {
  try { localStorage.setItem(APP.clePanier, JSON.stringify(etat.panier)); }
  catch (e) { /* quota ou navigation privée : le panier vit alors le temps de la visite */ }
  emettre("panier", etat.panier);
}

export function charger() { etat.panier = lire(); emettre("panier", etat.panier); return etat.panier; }

function cle(produitId, varianteId) { return produitId + "|" + (varianteId || ""); }

export function ajouter(produit, variante, quantite) {
  const q = Math.max(1, Math.min(APP.qteMax, Number(quantite) || 1));
  const k = cle(produit.id, variante && variante.id);
  const existante = etat.panier.find(function (l) { return cle(l.produit_id, l.variante_id) === k; });
  const stock = variante ? variante.stock : produit.stock;

  if (existante) {
    existante.quantite = Math.min(APP.qteMax, stock, existante.quantite + q);
  } else {
    etat.panier.push({
      produit_id: produit.id,
      variante_id: variante ? variante.id : null,
      slug: produit.slug,
      nom: produit.nom,
      variante_nom: variante ? variante.nom : null,
      prix: Number(variante ? variante.prix : produit.prix),
      prix_barre: variante ? variante.prix_barre : produit.prix_barre,
      image: produit.image || null,
      stock: stock,
      type: produit.type,
      quantite: Math.min(APP.qteMax, stock || APP.qteMax, q)
    });
  }
  ecrire();
}

export function definirQuantite(produitId, varianteId, quantite) {
  const k = cle(produitId, varianteId);
  const l = etat.panier.find(function (x) { return cle(x.produit_id, x.variante_id) === k; });
  if (!l) return;
  const q = Number(quantite) || 0;
  if (q <= 0) return retirer(produitId, varianteId);
  l.quantite = Math.max(1, Math.min(APP.qteMax, l.stock || APP.qteMax, q));
  ecrire();
}

export function retirer(produitId, varianteId) {
  const k = cle(produitId, varianteId);
  etat.panier = etat.panier.filter(function (x) { return cle(x.produit_id, x.variante_id) !== k; });
  ecrire();
}

export function vider() { etat.panier = []; ecrire(); }

export function nombreArticles() {
  return etat.panier.reduce(function (n, l) { return n + l.quantite; }, 0);
}

export function sousTotal() {
  return etat.panier.reduce(function (s, l) { return s + l.prix * l.quantite; }, 0);
}

/** Charge utile envoyée à boutique.creer_commande(). */
export function pourCommande() {
  return etat.panier.map(function (l) {
    return { produit_id: l.produit_id, variante_id: l.variante_id, quantite: l.quantite };
  });
}
