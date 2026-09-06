/* Tableau de bord : chiffres agrégés par Postgres, pas par le navigateur. */

import { h, remplir } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { prix, nombre, date } from "../core/format.js";
import { rpc } from "../core/supa.js";

function stat(cle, valeur, detail) {
  return h("div.stat", h("div.k", {}, cle), h("div.v", {}, valeur),
    detail ? h("div.d", {}, detail) : null);
}

function courbe(serie) {
  if (!serie.length) return null;
  const max = Math.max.apply(null, serie.map(function (p) { return Number(p.total) || 0; })) || 1;
  return h("div.spark", {}, serie.map(function (p) {
    const v = Number(p.total) || 0;
    return h("div", {
      style: { height: Math.max(2, Math.round(v / max * 84)) + "px" },
      title: date(p.jour) + " · " + prix(v)
    });
  }));
}

export default async function tableau(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Tableau de bord")),
    h("p.faint", {}, t("chargement")));

  let s;
  try { s = await rpc("statistiques", { p_jours: 30 }); }
  catch (e) {
    remplir(hote, h("div.vide-etat", h("div.em", {}, "⚠️"),
      h("h3", {}, t("erreur_reseau")), h("p", {}, e.message || "")));
    return;
  }

  if (!s || !s.ok) {
    remplir(hote, h("div.vide-etat", h("div.em", {}, "🔒"),
      h("h3", {}, "Accès refusé")));
    return;
  }

  const ruptures = s.ruptures || [];
  const ventes = s.meilleures_ventes || [];

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Tableau de bord"),
      h("span.faint.grow", {}, "30 derniers jours")),

    h("div.stats",
      stat("Chiffre d'affaires", prix(s.chiffre_affaires)),
      stat("Commandes", nombre(s.commandes), s.commandes_a_traiter + " à traiter"),
      stat("Panier moyen", prix(s.panier_moyen)),
      stat("Clients", nombre(s.clients))),

    (s.ventes_par_jour || []).length
      ? h("div.stat", { style: { marginTop: "16px" } },
          h("div.k", {}, "Évolution des ventes"),
          courbe(s.ventes_par_jour))
      : null,

    h("div", { style: { display: "grid", gap: "16px", marginTop: "22px",
                        gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" } },

      h("div.stat",
        h("div.k", {}, "Produits les plus vendus"),
        ventes.length
          ? h("div", { style: { marginTop: "10px", display: "grid", gap: "7px" } },
              ventes.map(function (p) {
                return h("div.row", { style: { fontSize: "14px", gap: "10px" } },
                  h("a.grow", { href: "index.html#/p/" + (p.slug || ""),
                                style: { color: "inherit" } }, L(p.nom)),
                  h("strong", {}, p.nb_ventes));
              }))
          : h("p.faint", { style: { marginTop: "8px" } }, "Aucune vente pour l'instant")),

      h("div.stat",
        h("div.k", {}, "Stock à surveiller"),
        ruptures.length
          ? h("div", { style: { marginTop: "10px", display: "grid", gap: "7px" } },
              ruptures.map(function (p) {
                return h("div.row", { style: { fontSize: "14px", gap: "10px" } },
                  h("span.grow", {}, L(p.nom)),
                  h("span.badge" + (p.stock <= 0 ? ".badge-promo" : ".badge-new"), {},
                    p.stock <= 0 ? t("rupture") : p.stock));
              }))
          : h("p.faint", { style: { marginTop: "8px" } }, "Tous les stocks sont au-dessus du seuil"))));
}
