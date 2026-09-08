/* =====================================================================
   Catalogue — lectures du côté boutique.
   Les référentiels (catégories, marques, zones, réglages) sont chargés
   une fois au démarrage ; les produits sont interrogés à la demande.
   ===================================================================== */

import { lire, lireUn, stockage } from "../core/supa.js";
import { etat, emettre } from "../core/etat.js";

/* Colonnes ramenées pour une vignette : le strict nécessaire. */
const CHAMPS_LISTE =
  "id,slug,reference,type,nom,description_courte,prix,prix_barre,stock,en_vedette," +
  "nouveaute,note_moyenne,nb_avis,nb_ventes,cree_le,categorie_id,marque_id," +
  "images:produit_images(url,ordre,principale)," +
  "variantes:produit_variantes(id,actif)," +   /* pour savoir si un format est requis */
  "marque:marques(slug,nom)";

/* Fiche complète. */
const CHAMPS_FICHE = "*," +
  "images:produit_images(id,url,alt,ordre,principale)," +
  "variantes:produit_variantes(id,nom,prix,prix_barre,stock,reference,ordre,actif)," +
  "marque:marques(id,slug,nom,logo_url,pays,description)," +
  "categorie:categories(id,slug,nom,famille)," +
  "parfum:parfum_details(*,famille:familles_olfactives(slug,nom))," +
  "aliment:aliment_details(*)," +
  "notes:produit_notes(position,ordre,note:notes_olfactives(slug,nom))";

/* ------------------------------------------------------------------ */
/* Référentiels                                                        */
/* ------------------------------------------------------------------ */
export async function chargerReferentiels() {
  const [cats, marques, zones, params] = await Promise.all([
    lire("categories", { select: "*", where: { actif: "eq.true" }, order: "ordre.asc" }),
    lire("marques",    { select: "*", where: { actif: "eq.true" }, order: "ordre.asc" }),
    lire("zones_livraison", { select: "*", where: { actif: "eq.true" }, order: "ordre.asc" }),
    lire("parametres", { select: "cle,valeur" })
  ]);

  etat.categories = cats;
  etat.marques = marques;
  etat.zones = zones;
  etat.parametres = {};
  params.forEach(function (p) { etat.parametres[p.cle] = p.valeur; });
  etat.chargeCatalogue = true;
  emettre("catalogue", etat);
  return etat;
}

export function categorieParSlug(slug) {
  return etat.categories.find(function (c) { return c.slug === slug; }) || null;
}

export function racines() {
  return etat.categories.filter(function (c) { return !c.parent_id; });
}

export function enfants(idParent) {
  return etat.categories.filter(function (c) { return c.parent_id === idParent; });
}

/** La catégorie et toute sa descendance : filtrer sur « Parfums de Fès »
    doit ramener aussi les Bakhoor et les Musc. */
export function brancheIds(id) {
  const ids = [id];
  let front = [id];
  while (front.length) {
    const suivant = etat.categories
      .filter(function (c) { return front.indexOf(c.parent_id) >= 0; })
      .map(function (c) { return c.id; });
    suivant.forEach(function (i) { if (ids.indexOf(i) < 0) ids.push(i); });
    front = suivant;
  }
  return ids;
}

export function marqueParSlug(slug) {
  return etat.marques.find(function (m) { return m.slug === slug; }) || null;
}

export function zoneParVille(ville) {
  const v = String(ville || "").trim().toLowerCase();
  return etat.zones.find(function (z) { return z.ville.toLowerCase() === v; })
      || etat.zones.find(function (z) { return z.ville === "*"; })
      || null;
}

/* ------------------------------------------------------------------ */
/* Produits                                                            */
/* ------------------------------------------------------------------ */

/** Image principale d'un produit, en URL publique du stockage. */
export function imagePrincipale(p) {
  const imgs = (p && p.images) || [];
  if (!imgs.length) return null;
  const tri = imgs.slice().sort(function (a, b) {
    return (b.principale ? 1 : 0) - (a.principale ? 1 : 0) || (a.ordre || 0) - (b.ordre || 0);
  });
  return stockage.urlPublique(tri[0].url);
}

/** Normalise un produit venu de la base pour l'affichage. */
export function preparer(p) {
  if (!p) return null;
  p.image = imagePrincipale(p);
  if (p.images) {
    p.images = p.images.slice()
      .sort(function (a, b) {
        return (b.principale ? 1 : 0) - (a.principale ? 1 : 0) || (a.ordre || 0) - (b.ordre || 0);
      })
      .map(function (i) { return Object.assign({}, i, { src: stockage.urlPublique(i.url) }); });
  }
  if (p.variantes) {
    p.variantes = p.variantes.filter(function (v) { return v.actif; })
      .sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
  }
  if (p.parfum && Array.isArray(p.parfum)) p.parfum = p.parfum[0] || null;
  if (p.aliment && Array.isArray(p.aliment)) p.aliment = p.aliment[0] || null;
  return p;
}

const TRIS = {
  pertinence:       "en_vedette.desc,ordre.asc,nb_ventes.desc",
  prix_croissant:   "prix.asc",
  prix_decroissant: "prix.desc",
  nouveautes:       "cree_le.desc",
  populaires:       "nb_ventes.desc",
  note:             "note_moyenne.desc,nb_avis.desc"
};

/* Les signes de vocalisation arabes — fatha, damma, kasra, shadda,
   sukun — et le tatweel. On les retire de la saisie parce que l'index les
   retire aussi (voir boutique.sans_diacritiques, migration 20260908000002) :
   les deux côtés doivent s'accorder, sinon « أندلِس » ne trouve pas
   « أندلس » et réciproquement.

   Cela répare aussi un défaut plus ancien : le nettoyage ci-dessous ne
   garde que les catégories Unicode L et N, et une kasra n'est ni l'une ni
   l'autre — c'est une marque non espaçante. Elle était donc remplacée par
   une espace, ce qui COUPAIT le mot en deux : « أندلِس » cherchait
   « أندل » et « س » séparément. Retirer les signes avant le nettoyage,
   plutôt qu'après, est ce qui fait la différence. */
const DIACRITIQUES = /[\u064B-\u0652\u0670\u0640]/g;

/** Transforme une saisie libre en tsquery sûre : « oud rose » → « oud:* & rose:* ». */
export function tsquery(q) {
  const mots = String(q || "")
    .replace(DIACRITIQUES, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/).filter(Boolean).slice(0, 6);
  if (!mots.length) return null;
  return mots.map(function (m) { return m + ":*"; }).join(" & ");
}

/**
 * @param {object} f  { categorie, marque, type, q, prixMin, prixMax, enStock,
 *                      enPromo, genre, famille, vedette, nouveaute,
 *                      tri, page, parPage }
 */
export async function produits(f) {
  f = f || {};
  const parPage = f.parPage || 24;
  const page = Math.max(1, f.page || 1);
  const where = { actif: "eq.true" };
  let select = CHAMPS_LISTE;

  if (f.categorie) {
    const ids = brancheIds(f.categorie);
    where.categorie_id = "in.(" + ids.join(",") + ")";
  }
  if (f.marque)     where.marque_id  = "eq." + f.marque;
  if (f.type)       where.type       = "eq." + f.type;
  if (f.vedette)    where.en_vedette = "eq.true";
  if (f.nouveaute)  where.nouveaute  = "eq.true";
  if (f.enStock)    where.stock      = "gt.0";
  if (f.enPromo)    where.prix_barre = "not.is.null";
  const filtres = [];
  if (f.prixMin != null && f.prixMin !== "") filtres.push(["prix", "gte." + Number(f.prixMin)]);
  if (f.prixMax != null && f.prixMax !== "") filtres.push(["prix", "lte." + Number(f.prixMax)]);

  const q = tsquery(f.q);
  if (q) where.recherche = "fts(simple)." + q;

  /* Filtres qui vivent dans la table des parfums : jointure interne. */
  const filtresParfum = [];
  if (f.genre)   filtresParfum.push(["parfum.genre", "eq." + f.genre]);
  if (f.famille) filtresParfum.push(["parfum.famille_id", "eq." + f.famille]);
  if (filtresParfum.length) {
    select += ",parfum:parfum_details!inner(genre,famille_id)";
    filtresParfum.forEach(function (e) { where[e[0]] = e[1]; });
  }

  const brut = await lire("produits", {
    select: select,
    where: where,
    filtres: filtres,
    order: TRIS[f.tri] || TRIS.pertinence,
    limit: parPage,
    offset: (page - 1) * parPage,
    compte: true
  });

  const total = brut.total;
  const lignes = brut.map(preparer);
  lignes.total = total;
  lignes.pages = Math.max(1, Math.ceil(total / parPage));
  return lignes;
}

export async function produitParSlug(slug) {
  const p = await lireUn("produits", {
    select: CHAMPS_FICHE, where: { slug: "eq." + slug, actif: "eq.true" }
  });
  return preparer(p);
}

export async function similaires(produit, n) {
  if (!produit || !produit.categorie_id) return [];
  const l = await lire("produits", {
    select: CHAMPS_LISTE,
    where: {
      actif: "eq.true",
      categorie_id: "eq." + produit.categorie_id,
      id: "neq." + produit.id
    },
    order: "nb_ventes.desc", limit: n || 8
  });
  return l.map(preparer);
}

export async function suggestions(q, n) {
  const req = tsquery(q);
  if (!req) return [];
  const l = await lire("produits", {
    select: "id,slug,nom,type,prix,images:produit_images(url,principale,ordre)",
    where: { actif: "eq.true", recherche: "fts(simple)." + req },
    order: "nb_ventes.desc", limit: n || 6
  });
  return l.map(preparer);
}

export async function parIds(ids) {
  if (!ids || !ids.length) return [];
  const l = await lire("produits", {
    select: CHAMPS_LISTE,
    where: { actif: "eq.true", id: "in.(" + ids.join(",") + ")" }
  });
  return l.map(preparer);
}

export function famillesOlfactives() {
  return lire("familles_olfactives", { select: "*", order: "ordre.asc" });
}

export function avisPublies(produitId) {
  return lire("avis", {
    select: "id,nom,note,commentaire,cree_le",
    where: { produit_id: "eq." + produitId, statut: "eq.publie" },
    order: "cree_le.desc", limit: 50
  });
}
