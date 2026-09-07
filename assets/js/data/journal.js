/* =====================================================================
   Le journal — articles sur Fès.
   Un brouillon ne sort pas de la base : c'est la règle RLS qui le retient,
   pas un filtre côté page.
   ===================================================================== */

import { lire, lireUn, stockage } from "../core/supa.js";
import { tsquery } from "./catalogue.js";

const CHAMPS_LISTE = "id,slug,titre,chapo,image_url,auteur,publie_le,categorie_id," +
                     "porte:categories(slug,nom,icone)";

const CHAMPS_ARTICLE = "*,porte:categories(slug,nom,icone,sous_titre)";

function preparer(a) {
  if (!a) return null;
  a.image = a.image_url ? stockage.urlPublique(a.image_url) : null;
  if (Array.isArray(a.porte)) a.porte = a.porte[0] || null;
  return a;
}

export async function articles(options) {
  options = options || {};
  const where = { publie: "eq.true" };
  if (options.porte) where.categorie_id = "eq." + options.porte;

  const q = tsquery(options.q);
  if (q) where.recherche = "fts(simple)." + q;

  const l = await lire("articles", {
    select: CHAMPS_LISTE,
    where: where,
    order: "ordre.asc,publie_le.desc",
    limit: options.limite || 24
  });
  return l.map(preparer);
}

export async function article(slug) {
  return preparer(await lireUn("articles", {
    select: CHAMPS_ARTICLE, where: { slug: "eq." + slug }
  }));
}

/** Les autres articles, pour le bas de page d'un article. */
export async function autres(slugCourant, n) {
  const l = await lire("articles", {
    select: CHAMPS_LISTE,
    where: { publie: "eq.true", slug: "neq." + slugCourant },
    order: "publie_le.desc", limit: n || 3
  });
  return l.map(preparer);
}
