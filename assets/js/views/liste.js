/* =====================================================================
   Liste de produits : catégorie, marque, recherche, tout le catalogue.
   Les filtres vivent dans l'URL — un lien de résultats se partage.
   ===================================================================== */

import { h, remplir } from "../core/dom.js";
import { t, L, langue } from "../i18n/index.js";
import { lien, aller, analyser } from "../core/routeur.js";
import { etat } from "../core/etat.js";
import * as catalogue from "../data/catalogue.js";
import { grille, squelettes } from "../ui/carte.js";

const TRIS = ["pertinence", "nouveautes", "prix_croissant", "prix_decroissant", "populaires", "note"];

function depuisURL(requete) {
  return {
    q:        requete.get("q") || "",
    tri:      requete.get("tri") || "pertinence",
    marque:   requete.get("marque") || "",
    genre:    requete.get("genre") || "",
    famille:  requete.get("famille") || "",
    prixMin:  requete.get("min") || "",
    prixMax:  requete.get("max") || "",
    enStock:  requete.get("stock") === "1",
    enPromo:  requete.get("promo") === "1",
    page:     Math.max(1, Number(requete.get("page")) || 1)
  };
}

function versURL(base, f) {
  const p = new URLSearchParams();
  if (f.q)       p.set("q", f.q);
  if (f.tri && f.tri !== "pertinence") p.set("tri", f.tri);
  if (f.marque)  p.set("marque", f.marque);
  if (f.genre)   p.set("genre", f.genre);
  if (f.famille) p.set("famille", f.famille);
  if (f.prixMin) p.set("min", f.prixMin);
  if (f.prixMax) p.set("max", f.prixMax);
  if (f.enStock) p.set("stock", "1");
  if (f.enPromo) p.set("promo", "1");
  if (f.page > 1) p.set("page", f.page);
  const s = p.toString();
  return base + (s ? "?" + s : "");
}

function filActuel(categorie, marque, recherche) {
  const morceaux = [h("a", { href: lien("/") }, t("accueil"))];
  if (categorie) {
    const parent = categorie.parent_id
      ? etat.categories.find(function (c) { return c.id === categorie.parent_id; })
      : null;
    if (parent) morceaux.push("›", h("a", { href: lien("/c/" + parent.slug) }, L(parent.nom)));
    morceaux.push("›", h("span", { style: { color: "var(--ink)" } }, L(categorie.nom)));
  } else if (marque) {
    morceaux.push("›", h("span", { style: { color: "var(--ink)" } }, marque.nom));
  } else if (recherche) {
    morceaux.push("›", h("span", { style: { color: "var(--ink)" } }, t("rechercher") + " : " + recherche));
  } else {
    morceaux.push("›", h("span", { style: { color: "var(--ink)" } }, t("nos_produits")));
  }
  return h("nav.fil", { "aria-label": "fil" }, morceaux);
}

function flanc(base, f, contexte, familles) {
  const changer = function (modif) {
    aller(versURL(base, Object.assign({}, f, modif, { page: 1 })));
  };

  const bloc = function (titre, contenu) {
    return h("div", h("h3", {}, titre), contenu);
  };

  const sousCats = contexte.categorie
    ? catalogue.enfants(contexte.categorie.id)
    : (contexte.marque || contexte.recherche ? [] : catalogue.racines());

  const parfums = !contexte.categorie || contexte.categorie.famille === "parfum";

  return h("aside.flanc",
    sousCats.length ? bloc(t("categories"), h("div", {}, sousCats.map(function (c) {
      return h("div", h("a", { href: lien("/c/" + c.slug), style: { fontSize: "14px", display: "block", padding: "5px 0" } },
        (c.icone ? c.icone + " " : "") + L(c.nom)));
    }))) : null,

    bloc(t("prix"), h("div.row", { style: { gap: "8px" } },
      h("input.input", {
        type: "number", min: "0", placeholder: t("prix_min"), value: f.prixMin,
        "aria-label": t("prix_min"),
        onchange: function (e) { changer({ prixMin: e.target.value }); }
      }),
      h("input.input", {
        type: "number", min: "0", placeholder: t("prix_max"), value: f.prixMax,
        "aria-label": t("prix_max"),
        onchange: function (e) { changer({ prixMax: e.target.value }); }
      }))),

    !contexte.marque && etat.marques.length ? bloc(t("marques"),
      h("select.select", {
        "aria-label": t("marques"),
        onchange: function (e) { changer({ marque: e.target.value }); }
      },
        h("option", { value: "" }, t("toutes_marques")),
        etat.marques.map(function (m) {
          return h("option", { value: m.id, selected: f.marque === m.id }, m.nom);
        }))) : null,

    parfums ? bloc(t("genre"), h("div", {}, [
      ["", t("toutes_categories")], ["homme", t("homme")], ["femme", t("femme")], ["unisexe", t("unisexe")]
    ].map(function (o) {
      return h("label", {},
        h("input", { type: "radio", name: "genre", checked: f.genre === o[0],
                     onchange: function () { changer({ genre: o[0] }); } }),
        o[1]);
    }))) : null,

    parfums && familles.length ? bloc(t("famille_olfactive"), h("div", {}, familles.map(function (fa) {
      return h("label", {},
        h("input", { type: "radio", name: "famille", checked: f.famille === fa.id,
                     onchange: function () { changer({ famille: f.famille === fa.id ? "" : fa.id }); } }),
        L(fa.nom));
    }))) : null,

    bloc(t("filtres"), h("div",
      h("label", {}, h("input", { type: "checkbox", checked: f.enStock,
        onchange: function (e) { changer({ enStock: e.target.checked }); } }), t("disponible")),
      h("label", {}, h("input", { type: "checkbox", checked: f.enPromo,
        onchange: function (e) { changer({ enPromo: e.target.checked }); } }), t("en_promo")))),

    h("button.btn.btn-ghost.btn-sm.btn-block", {
      type: "button", style: { marginTop: "18px" },
      onclick: function () { aller(base + (f.q ? "?q=" + encodeURIComponent(f.q) : "")); }
    }, t("effacer_filtres")));
}

function pagination(base, f, pages) {
  if (pages <= 1) return null;
  const boutons = [];
  const ajouter = function (n, libelle) {
    boutons.push(h("a.btn.btn-sm" + (n === f.page ? ".btn-primary" : ".btn-ghost"),
      { href: versURL(base, Object.assign({}, f, { page: n })) }, libelle || String(n)));
  };
  if (f.page > 1) ajouter(f.page - 1, "‹");
  for (let n = Math.max(1, f.page - 2); n <= Math.min(pages, f.page + 2); n++) ajouter(n);
  if (f.page < pages) ajouter(f.page + 1, "›");
  return h("div.row", { style: { justifyContent: "center", gap: "6px", marginTop: "34px", flexWrap: "wrap" } },
    boutons);
}

export default async function liste(hote, contexte) {
  const { requete } = analyser();
  const f = depuisURL(requete);
  const base = contexte.base;

  const zoneResultats = h("div", {}, squelettes(8));
  const titre = contexte.categorie ? L(contexte.categorie.nom)
              : contexte.marque    ? contexte.marque.nom
              : contexte.recherche ? t("rechercher") + " : " + contexte.recherche
              : t("nos_produits");

  const compteur = h("span.faint");
  const selecteurTri = h("select.select", {
    style: { width: "auto", minWidth: "180px" }, "aria-label": t("trier"),
    onchange: function (e) { aller(versURL(base, Object.assign({}, f, { tri: e.target.value, page: 1 }))); }
  }, TRIS.map(function (x) {
    return h("option", { value: x, selected: f.tri === x }, t("tri_" + x));
  }));

  let familles = [];
  try { familles = await catalogue.famillesOlfactives(); } catch (e) { familles = []; }

  /* Une porte de la médina a droit à son bandeau : plaque arabe, nom
     français, et la phrase qui dit ce qu'on trouve derrière. */
  const estPorte = contexte.categorie && !contexte.categorie.parent_id;
  const zoneArticles = h("div");
  const bandeau = estPorte
    ? h("div.porte-tete",
        h("div", { style: { fontSize: "30px" } }, contexte.categorie.icone || "✦"),
        h("div.ar", { lang: "ar", dir: "rtl" }, L(contexte.categorie.nom, "ar")),
        h("h1", {}, L(contexte.categorie.nom, langue() === "ar" ? "fr" : langue())),
        L(contexte.categorie.sous_titre)
          ? h("div.eyebrow", { style: { color: "var(--gold-2)" } },
              L(contexte.categorie.sous_titre)) : null,
        L(contexte.categorie.description)
          ? h("p", { style: { marginTop: "12px" } }, L(contexte.categorie.description)) : null)
    : null;

  remplir(hote, h("div.wrap",
    filActuel(contexte.categorie, contexte.marque, contexte.recherche),
    bandeau,
    h("div.section-head",
      h("div",
        estPorte ? null : h("h1", { style: { marginBottom: "2px" } }, titre),
        !estPorte && contexte.categorie && L(contexte.categorie.description)
          ? h("p", {}, L(contexte.categorie.description)) : null,
        compteur),
      selecteurTri),
    h("div.avec-flanc",
      flanc(base, f, contexte, familles),
      zoneResultats),
    zoneArticles,
    h("div", { style: { height: "40px" } })));

  /* Ce qui se lit derrière la porte, sous ce qui s'y achète. */
  if (estPorte) {
    import("../data/journal.js").then(function (journal) {
      return journal.articles({ porte: contexte.categorie.id, limite: 3 });
    }).then(function (lus) {
      if (!lus || !lus.length) return;
      return import("./journal.js").then(function (vue) {
        remplir(zoneArticles, h("section.section",
          h("div.section-head",
            h("div", h("div.eyebrow", {}, t("journal")),
              h("h2", {}, t("journal_titre"))),
            h("a.btn.btn-ghost.btn-sm", { href: lien("/journal") }, t("voir_tout"))),
          vue.grilleArticles(lus)));
      });
    }).catch(function () { /* section simplement absente */ });
  }

  try {
    const filtres = Object.assign({}, f, {
      categorie: contexte.categorie ? contexte.categorie.id : null,
      marque: f.marque || (contexte.marque ? contexte.marque.id : null),
      q: contexte.recherche || f.q,
      parPage: 24
    });
    const liste = await catalogue.produits(filtres);
    compteur.textContent = liste.total + " " + t("resultats");

    if (!liste.length) {
      remplir(zoneResultats, h("div.vide-etat",
        h("div.em", {}, "🔎"),
        h("h3", {}, t("aucun_resultat")),
        h("p", {}, t("aucun_resultat_d"))));
      return;
    }
    remplir(zoneResultats, grille(liste), pagination(base, f, liste.pages));
  } catch (e) {
    remplir(zoneResultats, h("div.vide-etat",
      h("div.em", {}, "⚠️"),
      h("h3", {}, e.schemaNonExpose ? t("schema_absent") : t("erreur_reseau")),
      h("p", {}, e.message || "")));
  }
}
