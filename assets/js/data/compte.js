/* =====================================================================
   Compte client : session, profil, adresses.
   ---------------------------------------------------------------------
   Aucun déclencheur n'est posé sur auth.users : celui de l'application
   de recettes y est déjà installé et ne doit pas être perturbé. La fiche
   client est donc créée à la volée, à la première visite connectée.
   ===================================================================== */

import { auth, chargerSession, contenuJeton, session, lire, lireUn, inserer, modifier, supprimer }
  from "../core/supa.js";
import { SUPA } from "../core/config.js";
import { etat, emettre } from "../core/etat.js";
import { langue } from "../i18n/index.js";

export { auth };

/** À appeler une fois au démarrage. Renvoie l'erreur OAuth éventuelle. */
export async function demarrerSession() {
  const retour = auth.capterRetour();
  chargerSession();

  const charge = contenuJeton(session.jeton && session.jeton.access_token);
  if (charge && charge.sub) {
    etat.utilisateur = {
      id: charge.sub,
      email: charge.email || "",
      nom: (charge.user_metadata &&
            (charge.user_metadata.full_name || charge.user_metadata.name)) || ""
    };
    etat.estAdmin = String(etat.utilisateur.email).toLowerCase() === SUPA.admin.toLowerCase();
    try { await assurerFiche(); } catch (e) { /* la boutique reste utilisable */ }
  } else {
    etat.utilisateur = null;
    etat.estAdmin = false;
  }

  etat.pretAuth = true;
  emettre("auth", etat.utilisateur);
  return retour;
}

/** Crée ou complète la ligne boutique.clients du visiteur connecté. */
async function assurerFiche() {
  const u = etat.utilisateur;
  if (!u) return null;
  let fiche = await lireUn("clients", { select: "*", where: { user_id: "eq." + u.id } });
  if (!fiche) {
    await inserer("clients", {
      user_id: u.id, email: u.email, nom: u.nom || null, langue: langue()
    });
    fiche = await lireUn("clients", { select: "*", where: { user_id: "eq." + u.id } });
  }
  if (fiche) {
    u.nom = fiche.nom || u.nom;
    u.telephone = fiche.telephone || "";
    u.langue = fiche.langue || langue();
  }
  return fiche;
}

export async function deconnexion() {
  await auth.deconnexion();
  etat.utilisateur = null;
  etat.estAdmin = false;
  etat.favoris = new Set();
  emettre("auth", null);
  emettre("favoris", etat.favoris);
}

export async function majProfil(valeurs) {
  if (!etat.utilisateur) throw new Error("non_connecte");
  await modifier("clients", { user_id: "eq." + etat.utilisateur.id }, valeurs);
  Object.assign(etat.utilisateur, valeurs);
  emettre("auth", etat.utilisateur);
}

/* ------------------------------------------------------------------ */
/* Adresses                                                            */
/* ------------------------------------------------------------------ */
export function mesAdresses() {
  if (!etat.utilisateur) return Promise.resolve([]);
  return lire("adresses", {
    select: "*", where: { user_id: "eq." + etat.utilisateur.id },
    order: "par_defaut.desc,cree_le.desc"
  });
}

export async function enregistrerAdresse(a) {
  if (!etat.utilisateur) throw new Error("non_connecte");
  const valeurs = {
    nom_complet: a.nom_complet, telephone: a.telephone, ville: a.ville,
    quartier: a.quartier || null, adresse: a.adresse,
    instructions: a.instructions || null, par_defaut: !!a.par_defaut
  };
  if (a.par_defaut) {
    await modifier("adresses", { user_id: "eq." + etat.utilisateur.id }, { par_defaut: false });
  }
  if (a.id) return modifier("adresses", { id: "eq." + a.id }, valeurs);
  return inserer("adresses", Object.assign({ user_id: etat.utilisateur.id }, valeurs));
}

export function supprimerAdresse(id) {
  return supprimer("adresses", { id: "eq." + id });
}
