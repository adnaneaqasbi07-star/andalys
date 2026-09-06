/* =====================================================================
   Catégories, marques, codes promo, zones de livraison.
   Quatre tables, un même moule : liste + panneau d'édition décrit par
   une petite configuration.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { prix, slug as fabriquerSlug, date } from "../core/format.js";
import { lire, inserer, modifier, supprimer } from "../core/supa.js";
import { etat } from "../core/etat.js";
import * as catalogue from "../data/catalogue.js";
import { trilingue, champ, interrupteur, panneau, fermerPanneau, table, vide, confirmer }
  from "./commun.js";

/* ------------------------------------------------------------------ */
const CONFIGS = {
  "/categories": {
    titre: "Catégories",
    tableSQL: "categories",
    select: "*", ordre: "ordre.asc",
    colonnes: ["", "Nom", "Parent", "Famille", "Ordre", "État", ""],
    ligne: function (c, actions) {
      const parent = c.parent_id
        ? etat.categories.find(function (x) { return x.id === c.parent_id; }) : null;
      return h("tr",
        h("td", { style: { fontSize: "20px" } }, c.icone || ""),
        h("td", {}, h("strong", {}, L(c.nom)), h("div.faint", {}, c.slug)),
        h("td", {}, parent ? L(parent.nom) : "—"),
        h("td", {}, c.famille),
        h("td", {}, c.ordre),
        h("td", {}, c.actif ? h("span.badge.badge-ok", {}, "Visible")
                            : h("span.badge.badge-rupt", {}, "Masquée")),
        h("td", {}, actions));
    },
    formulaire: function (c) {
      c = c || { famille: "general", actif: true, ordre: 100 };
      const nom = trilingue(c.nom, { libelle: "Nom", requis: true });
      const desc = trilingue(c.description, { libelle: "Description", zone: true, rows: 2 });
      const cSlug = champ("Identifiant d'URL", c.slug, { aide: "Déduit du nom si vide" });
      const cIcone = champ("Icône (emoji)", c.icone);
      const cImage = champ("Image de couverture (URL)", c.image_url);
      const cParent = champ("Catégorie parente", c.parent_id, {
        choix: [["", "— aucune —"]].concat(etat.categories
          .filter(function (x) { return !x.parent_id && x.id !== c.id; })
          .map(function (x) { return [x.id, L(x.nom)]; })) });
      const cFamille = champ("Famille", c.famille, {
        choix: [["parfum", "Parfum"], ["alimentaire", "Alimentaire"], ["artisanat", "Artisanat"],
                ["coffret", "Coffret"], ["general", "Général"]] });
      const cOrdre = champ("Ordre", c.ordre, { type: "number" });
      const iActif = interrupteur("Visible", c.actif !== false);

      return {
        vue: h("div", nom.element, desc.element,
          h("div.grid-2", cSlug.element, cIcone.element),
          h("div.grid-2", cParent.element, cFamille.element),
          cImage.element,
          h("div.grid-2", cOrdre.element, h("div", iActif.element))),
        valide: function () { return nom.valide(); },
        valeurs: function () {
          return {
            nom: nom.valeur(), description: desc.valeur(),
            slug: cSlug.valeur() || fabriquerSlug(nom.valeur().fr),
            icone: cIcone.valeur(), image_url: cImage.valeur(),
            parent_id: cParent.entree.value || null,
            famille: cFamille.entree.value,
            ordre: cOrdre.valeur() || 100, actif: iActif.valeur()
          };
        }
      };
    }
  },

  "/marques": {
    titre: "Marques",
    tableSQL: "marques",
    select: "*", ordre: "ordre.asc",
    colonnes: ["", "Marque", "Pays", "Ordre", "État", ""],
    ligne: function (m, actions) {
      return h("tr",
        h("td", {}, m.logo_url ? h("img.mini", { src: m.logo_url, alt: "" }) : ""),
        h("td", {}, h("strong", {}, m.nom), h("div.faint", {}, m.slug)),
        h("td", {}, m.pays || "—"),
        h("td", {}, m.ordre),
        h("td", {}, m.actif ? h("span.badge.badge-ok", {}, "Visible")
                            : h("span.badge.badge-rupt", {}, "Masquée")),
        h("td", {}, actions));
    },
    formulaire: function (m) {
      m = m || { actif: true, ordre: 100 };
      const cNom = champ("Nom", m.nom, { requis: true });
      const cSlug = champ("Identifiant d'URL", m.slug);
      const cPays = champ("Pays d'origine", m.pays);
      const cLogo = champ("Logo (URL)", m.logo_url);
      const cCouv = champ("Image de couverture (URL)", m.couverture_url);
      const desc = trilingue(m.description, { libelle: "Description", zone: true, rows: 3 });
      const cOrdre = champ("Ordre", m.ordre, { type: "number" });
      const iActif = interrupteur("Visible", m.actif !== false);

      return {
        vue: h("div",
          h("div.grid-2", cNom.element, cPays.element),
          cSlug.element, desc.element,
          h("div.grid-2", cLogo.element, cCouv.element),
          h("div.grid-2", cOrdre.element, h("div", iActif.element))),
        valide: function () { return !!cNom.valeur(); },
        valeurs: function () {
          return {
            nom: cNom.valeur(), slug: cSlug.valeur() || fabriquerSlug(cNom.valeur()),
            pays: cPays.valeur(), logo_url: cLogo.valeur(), couverture_url: cCouv.valeur(),
            description: desc.valeur(), ordre: cOrdre.valeur() || 100, actif: iActif.valeur()
          };
        }
      };
    }
  },

  "/promos": {
    titre: "Codes promo",
    tableSQL: "codes_promo",
    select: "*", ordre: "cree_le.desc",
    colonnes: ["Code", "Type", "Valeur", "Minimum", "Utilisations", "Période", "État", ""],
    ligne: function (p, actions) {
      const periode = [p.debut ? date(p.debut) : "—", p.fin ? date(p.fin) : "—"].join(" → ");
      return h("tr",
        h("td", {}, h("code", { style: { fontWeight: "600" } }, p.code)),
        h("td", {}, p.type),
        h("td", {}, p.type === "pourcentage" ? p.valeur + " %"
                  : p.type === "montant" ? prix(p.valeur) : "livraison offerte"),
        h("td", {}, p.minimum ? prix(p.minimum) : "—"),
        h("td", {}, p.utilisations + (p.max_utilisations ? " / " + p.max_utilisations : "")),
        h("td", {}, periode),
        h("td", {}, p.actif ? h("span.badge.badge-ok", {}, "Actif")
                            : h("span.badge.badge-rupt", {}, "Inactif")),
        h("td", {}, actions));
    },
    formulaire: function (p) {
      p = p || { type: "pourcentage", actif: true, minimum: 0 };
      const cCode = champ("Code", p.code, { requis: true, placeholder: "FES10" });
      const cType = champ("Type", p.type, {
        choix: [["pourcentage", "Pourcentage"], ["montant", "Montant fixe"],
                ["livraison", "Livraison offerte"]] });
      const cValeur = champ("Valeur", p.valeur, { type: "number", step: "0.01", min: "0" });
      const cMin = champ("Montant minimum de commande", p.minimum, { type: "number", step: "0.01", min: "0" });
      const cMax = champ("Nombre maximum d'utilisations", p.max_utilisations, { type: "number", min: "1" });
      const cDebut = champ("Début", p.debut ? String(p.debut).slice(0, 10) : "", { type: "date" });
      const cFin = champ("Fin", p.fin ? String(p.fin).slice(0, 10) : "", { type: "date" });
      const iActif = interrupteur("Actif", p.actif !== false);

      return {
        vue: h("div",
          h("div.grid-2", cCode.element, cType.element),
          h("div.grid-2", cValeur.element, cMin.element),
          h("div.grid-2", cDebut.element, cFin.element),
          cMax.element, iActif.element),
        valide: function () { return !!cCode.valeur(); },
        valeurs: function () {
          return {
            code: String(cCode.valeur()).toUpperCase(),
            type: cType.entree.value,
            valeur: cValeur.valeur() || 0,
            minimum: cMin.valeur() || 0,
            max_utilisations: cMax.valeur(),
            debut: cDebut.valeur() || null,
            fin: cFin.valeur() || null,
            actif: iActif.valeur()
          };
        }
      };
    }
  },

  "/livraison": {
    titre: "Zones de livraison",
    tableSQL: "zones_livraison",
    select: "*", ordre: "ordre.asc",
    colonnes: ["Ville", "Tarif", "Délai", "Gratuite dès", "Ordre", "État", ""],
    ligne: function (z, actions) {
      return h("tr",
        h("td", {}, h("strong", {}, z.ville === "*" ? "Autres villes" : z.ville),
          h("div.faint", {}, L(z.nom))),
        h("td", {}, prix(z.tarif)),
        h("td", {}, z.delai_min + "–" + z.delai_max + " " + t("jours")),
        h("td", {}, z.gratuit_des ? prix(z.gratuit_des) : "—"),
        h("td", {}, z.ordre),
        h("td", {}, z.actif ? h("span.badge.badge-ok", {}, "Desservie")
                            : h("span.badge.badge-rupt", {}, "Suspendue")),
        h("td", {}, actions));
    },
    formulaire: function (z) {
      z = z || { actif: true, tarif: 0, delai_min: 1, delai_max: 3, ordre: 100 };
      const cVille = champ("Ville", z.ville, { requis: true, aide: "« * » pour le tarif de repli" });
      const nom = trilingue(z.nom, { libelle: "Libellé affiché", requis: true });
      const cTarif = champ("Tarif (MAD)", z.tarif, { type: "number", step: "0.01", min: "0" });
      const cMin = champ("Délai minimum (jours)", z.delai_min, { type: "number", min: "0" });
      const cMax = champ("Délai maximum (jours)", z.delai_max, { type: "number", min: "0" });
      const cGratuit = champ("Livraison offerte à partir de", z.gratuit_des,
        { type: "number", step: "0.01", min: "0" });
      const cOrdre = champ("Ordre", z.ordre, { type: "number" });
      const iActif = interrupteur("Ville desservie", z.actif !== false);

      return {
        vue: h("div", cVille.element, nom.element,
          h("div.grid-2", cTarif.element, cGratuit.element),
          h("div.grid-2", cMin.element, cMax.element),
          h("div.grid-2", cOrdre.element, h("div", iActif.element))),
        valide: function () { return !!cVille.valeur() && nom.valide(); },
        valeurs: function () {
          return {
            ville: cVille.valeur(), nom: nom.valeur(),
            tarif: cTarif.valeur() || 0,
            delai_min: cMin.valeur() || 1, delai_max: cMax.valeur() || 3,
            gratuit_des: cGratuit.valeur(),
            ordre: cOrdre.valeur() || 100, actif: iActif.valeur()
          };
        }
      };
    }
  }
};

/* ------------------------------------------------------------------ */
export default async function referentiels(hote, params, chemin) {
  const cfg = CONFIGS[chemin];
  if (!cfg) { remplir(hote, vide(t("aucun_resultat"))); return; }

  const zone = h("div", {}, h("p.faint", {}, t("chargement")));
  let lignes = [];

  async function recharger() {
    try {
      lignes = await lire(cfg.tableSQL, { select: cfg.select, order: cfg.ordre, limit: 500 });
      /* le référentiel partagé alimente aussi les listes déroulantes */
      await catalogue.chargerReferentiels().catch(function () {});
      dessiner();
    } catch (e) {
      remplir(zone, h("div.vide-etat", h("div.em", {}, "⚠️"), h("h3", {}, e.message || t("erreur"))));
    }
  }

  function ouvrir(ligne) {
    const f = cfg.formulaire(ligne);
    const bouton = h("button.btn.btn-primary", { type: "button" }, t("enregistrer"));
    bouton.addEventListener("click", async function () {
      if (!f.valide()) { notice(t("champ_requis"), true); return; }
      bouton.disabled = true;
      try {
        if (ligne && ligne.id) await modifier(cfg.tableSQL, { id: "eq." + ligne.id }, f.valeurs());
        else await inserer(cfg.tableSQL, f.valeurs());
        notice(t("enregistrer") + " ✓");
        fermerPanneau();
        recharger();
      } catch (e) { notice(e.message || t("erreur"), true); bouton.disabled = false; }
    });
    panneau(ligne ? t("modifier") : t("ajouter"), f.vue,
      [h("button.btn.btn-ghost", { type: "button", onclick: fermerPanneau }, t("annuler")), bouton]);
  }

  function dessiner() {
    remplir(zone, lignes.length
      ? table(cfg.colonnes, lignes, function (l) {
          const actions = h("div.row", { style: { gap: "4px", justifyContent: "flex-end" } },
            h("button.btn.btn-quiet.btn-sm", { type: "button",
              onclick: function () { ouvrir(l); } }, t("modifier")),
            h("button.btn.btn-quiet.btn-sm", { type: "button", onclick: async function () {
              if (!await confirmer(t("supprimer") + " ?")) return;
              try { await supprimer(cfg.tableSQL, { id: "eq." + l.id }); recharger(); }
              catch (e) { notice(e.message || t("erreur"), true); }
            } }, t("supprimer")));
          return cfg.ligne(l, actions);
        })
      : vide(t("aucun_resultat")));
  }

  remplir(hote,
    h("div.adm-tete", h("h1", {}, cfg.titre), h("span.grow"),
      h("button.btn.btn-primary", { type: "button",
        onclick: function () { ouvrir(null); } }, "+ " + t("ajouter"))),
    zone);

  recharger();
}
