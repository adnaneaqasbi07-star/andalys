/* =====================================================================
   Journal — rédaction et publication des articles.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { t, L, LANGUES } from "../i18n/index.js";
import { dateHeure, slug as fabriquerSlug } from "../core/format.js";
import { lire, inserer, modifier, supprimer } from "../core/supa.js";
import { etat } from "../core/etat.js";
import { trilingue, champ, interrupteur, panneau, fermerPanneau, table, vide, confirmer }
  from "./commun.js";

function editeur(a, surFin) {
  const creation = !a;
  a = a || { publie: false, ordre: 100, auteur: "Andalys" };

  const titre = trilingue(a.titre, { libelle: "Titre", requis: true });
  const chapo = trilingue(a.chapo, { libelle: "Chapô — deux phrases d'accroche", zone: true, rows: 3 });
  const corps = trilingue(a.corps, { libelle: "Corps de l'article", zone: true, rows: 14 });

  const cSlug   = champ("Identifiant d'URL", a.slug, { aide: "Déduit du titre si vide" });
  const cAuteur = champ("Signature", a.auteur);
  const cImage  = champ("Image de couverture (URL)", a.image_url,
    { aide: "Déposez l'image dans Storage, puis collez son chemin ici" });
  const cPorte  = champ("Porte associée", a.categorie_id, {
    aide: "L'article affichera les produits de cette porte, et la porte affichera l'article",
    choix: [["", "— aucune —"]].concat(
      etat.categories.filter(function (c) { return !c.parent_id; })
        .map(function (c) { return [c.id, L(c.nom)]; })) });
  const cMots  = champ("Mots-clés de recherche", a.mots_cles);
  const cOrdre = champ("Ordre d'affichage", a.ordre == null ? 100 : a.ordre, { type: "number" });
  const iPublie = interrupteur("Publié — visible de tous", !!a.publie);

  const bouton = h("button.btn.btn-primary", { type: "button" }, t("enregistrer"));
  bouton.addEventListener("click", async function () {
    if (!titre.valide()) { notice("Le titre en français est obligatoire", true); return; }
    bouton.disabled = true;
    const publie = iPublie.valeur();
    const valeurs = {
      slug: cSlug.valeur() || fabriquerSlug(titre.valeur().fr),
      titre: titre.valeur(), chapo: chapo.valeur(), corps: corps.valeur(),
      auteur: cAuteur.valeur(), image_url: cImage.valeur(),
      categorie_id: cPorte.entree.value || null,
      mots_cles: cMots.valeur() || "",
      ordre: cOrdre.valeur() || 100,
      publie: publie,
      /* la date de publication se fixe au premier passage en ligne */
      publie_le: publie ? (a.publie_le || new Date().toISOString()) : null
    };
    try {
      if (a.id) await modifier("articles", { id: "eq." + a.id }, valeurs);
      else await inserer("articles", valeurs);
      notice("Article enregistré ✓");
      fermerPanneau();
      surFin();
    } catch (e) { notice(e.message || t("erreur"), true); bouton.disabled = false; }
  });

  panneau(creation ? "Nouvel article" : L(a.titre),
    h("div",
      h("fieldset.fieldset", h("legend", {}, "Texte"),
        titre.element, chapo.element, corps.element),
      h("fieldset.fieldset", h("legend", {}, "Présentation"),
        h("div.grid-2", cSlug.element, cAuteur.element),
        cImage.element, cPorte.element),
      h("fieldset.fieldset", h("legend", {}, "Publication"),
        iPublie.element,
        h("div.grid-2", cMots.element, cOrdre.element),
        a.publie_le ? h("p.hint", {}, "Publié le " + dateHeure(a.publie_le)) : null)),
    [h("button.btn.btn-ghost", { type: "button", onclick: fermerPanneau }, t("annuler")), bouton]);

  titre.focus();
}

export default async function articles(hote) {
  const recherche = h("input.input.grow", { type: "search", placeholder: t("rechercher") });
  const filtre = h("select.select", {},
    h("option", { value: "" }, "Tous"),
    h("option", { value: "publie" }, "Publiés"),
    h("option", { value: "brouillon" }, "Brouillons"));
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));
  let liste = [];

  async function recharger() {
    try {
      liste = await lire("articles", {
        select: "id,slug,titre,chapo,corps,image_url,auteur,categorie_id,mots_cles," +
                "publie,publie_le,ordre",
        order: "ordre.asc,publie_le.desc", limit: 200
      });
      dessiner();
    } catch (e) {
      remplir(zone, h("div.vide-etat", h("div.em", {}, "⚠️"), h("h3", {}, e.message || t("erreur"))));
    }
  }

  function dessiner() {
    const q = recherche.value.trim().toLowerCase();
    const f = filtre.value;
    const lignes = liste.filter(function (a) {
      if (f === "publie" && !a.publie) return false;
      if (f === "brouillon" && a.publie) return false;
      if (!q) return true;
      return (LANGUES.map(function (l) { return (a.titre || {})[l] || ""; }).join(" ") +
        " " + (a.slug || "")).toLowerCase().indexOf(q) >= 0;
    });

    remplir(zone, lignes.length
      ? table(["Titre", "Porte", "Signature", "Publié le", "État", ""], lignes, function (a) {
          const porte = a.categorie_id
            ? etat.categories.find(function (c) { return c.id === a.categorie_id; }) : null;
          return h("tr",
            h("td", {}, h("strong", {}, L(a.titre)), h("div.faint", {}, a.slug)),
            h("td", {}, porte ? (porte.icone || "") + " " + L(porte.nom) : "—"),
            h("td", {}, a.auteur || "—"),
            h("td", {}, a.publie_le ? dateHeure(a.publie_le) : "—"),
            h("td", {}, a.publie ? h("span.badge.badge-ok", {}, "En ligne")
                                 : h("span.badge.badge-rupt", {}, "Brouillon")),
            h("td", {}, h("div.row", { style: { gap: "4px", justifyContent: "flex-end" } },
              h("a.btn.btn-quiet.btn-sm", {
                href: "index.html#/journal/" + a.slug, target: "_blank", rel: "noopener"
              }, t("voir")),
              h("button.btn.btn-quiet.btn-sm", { type: "button",
                onclick: function () { editeur(a, recharger); } }, t("modifier")),
              h("button.btn.btn-quiet.btn-sm", { type: "button", onclick: async function () {
                if (!await confirmer("Supprimer « " + L(a.titre) + " » ?")) return;
                try { await supprimer("articles", { id: "eq." + a.id }); recharger(); }
                catch (e) { notice(e.message || t("erreur"), true); }
              } }, t("supprimer")))));
        })
      : vide(t("aucun_resultat")));
  }

  [recherche, filtre].forEach(function (el) {
    el.addEventListener("input", dessiner);
    el.addEventListener("change", dessiner);
  });

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Journal"), h("span.grow"),
      h("button.btn.btn-primary", { type: "button",
        onclick: function () { editeur(null, recharger); } }, "+ Nouvel article")),
    h("div.outils", recherche, filtre),
    zone);

  recharger();
}
