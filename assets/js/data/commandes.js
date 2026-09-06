/* =====================================================================
   Commandes — la création passe par une fonction Postgres qui relit les
   prix, le stock, la zone et le code promo. Le navigateur n'envoie que
   des identifiants, des quantités et une adresse.
   ===================================================================== */

import { rpc, lire, lireUn } from "../core/supa.js";
import { etat } from "../core/etat.js";
import { pourCommande, vider } from "./panier.js";
import { langue } from "../i18n/index.js";

export const STATUTS = ["recue", "confirmee", "preparation", "expediee",
                        "en_livraison", "livree", "annulee"];

/** Suite normale d'une commande, sans l'annulation. */
export const PARCOURS = STATUTS.slice(0, 6);

export function verifierCode(code, sousTotal) {
  return rpc("verifier_code_promo", { p_code: code, p_sous_total: sousTotal });
}

/** @returns {Promise<{numero,total,…}>} */
export async function creer(coordonnees) {
  const charge = {
    articles: pourCommande(),
    nom_complet: coordonnees.nom_complet,
    telephone: coordonnees.telephone,
    email: coordonnees.email || null,
    ville: coordonnees.ville,
    quartier: coordonnees.quartier || null,
    adresse: coordonnees.adresse,
    instructions: coordonnees.instructions || null,
    code_promo: coordonnees.code_promo || null,
    mode_paiement: coordonnees.mode_paiement || "cod",
    langue: langue()
  };
  const res = await rpc("creer_commande", { p: charge });
  vider();
  return res;
}

export function mesCommandes() {
  if (!etat.utilisateur) return Promise.resolve([]);
  return lire("commandes", {
    select: "id,numero,statut,total,cree_le,ville,delai_estime," +
            "lignes:commande_lignes(id,nom,variante_nom,image_url,prix_unitaire,quantite,total)",
    where: { user_id: "eq." + etat.utilisateur.id },
    order: "cree_le.desc"
  });
}

export function maCommande(numero) {
  return lireUn("commandes", {
    select: "*,lignes:commande_lignes(*),suivi:commande_suivi(statut,commentaire,cree_le)",
    where: { numero: "eq." + numero }
  });
}

/** Suivi sans compte : le numéro seul ne suffit pas, il faut le téléphone. */
export function suivrePublic(numero, telephone) {
  return rpc("suivi_commande", { p_numero: numero, p_telephone: telephone });
}
