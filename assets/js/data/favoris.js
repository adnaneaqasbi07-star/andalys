/* =====================================================================
   Favoris — dans le navigateur pour un visiteur, en base dès qu'il se
   connecte. À la connexion, les deux listes fusionnent : ce qu'on a mis
   de côté avant de créer son compte n'est jamais perdu.
   ===================================================================== */

import { APP } from "../core/config.js";
import { lire, inserer, supprimer } from "../core/supa.js";
import { etat, emettre } from "../core/etat.js";

function lireLocaux() {
  try {
    const v = JSON.parse(localStorage.getItem(APP.cleFavoris) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

function ecrireLocaux() {
  try { localStorage.setItem(APP.cleFavoris, JSON.stringify(Array.from(etat.favoris))); }
  catch (e) { /* privé */ }
}

export async function charger() {
  const locaux = lireLocaux();
  etat.favoris = new Set(locaux);

  if (etat.utilisateur) {
    try {
      const lignes = await lire("favoris", {
        select: "produit_id", where: { user_id: "eq." + etat.utilisateur.id }
      });
      lignes.forEach(function (l) { etat.favoris.add(l.produit_id); });

      /* fusion : ce qui n'existait qu'en local rejoint la base */
      const distants = new Set(lignes.map(function (l) { return l.produit_id; }));
      const aPousser = locaux.filter(function (id) { return !distants.has(id); });
      if (aPousser.length) {
        await inserer("favoris", aPousser.map(function (id) {
          return { user_id: etat.utilisateur.id, produit_id: id };
        }), { surConflit: "user_id,produit_id" });
      }
      ecrireLocaux();
    } catch (e) { /* on garde les favoris locaux */ }
  }
  emettre("favoris", etat.favoris);
  return etat.favoris;
}

export function estFavori(produitId) { return etat.favoris.has(produitId); }

export async function basculer(produitId) {
  const avait = etat.favoris.has(produitId);
  if (avait) etat.favoris.delete(produitId); else etat.favoris.add(produitId);
  ecrireLocaux();
  emettre("favoris", etat.favoris);

  if (etat.utilisateur) {
    try {
      if (avait) {
        await supprimer("favoris", {
          user_id: "eq." + etat.utilisateur.id, produit_id: "eq." + produitId
        });
      } else {
        await inserer("favoris",
          { user_id: etat.utilisateur.id, produit_id: produitId },
          { surConflit: "user_id,produit_id" });
      }
    } catch (e) {
      /* la base a refusé : on revient à l'état d'avant pour ne pas mentir */
      if (avait) etat.favoris.add(produitId); else etat.favoris.delete(produitId);
      ecrireLocaux();
      emettre("favoris", etat.favoris);
      throw e;
    }
  }
  return !avait;
}
