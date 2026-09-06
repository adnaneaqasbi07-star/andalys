/* =====================================================================
   Gestion des produits : liste, création, modification, images, formats,
   fiche parfum ou fiche alimentaire.
   ===================================================================== */

import { h, remplir, vider, notice, image } from "../core/dom.js";
import { t, L, LANGUES } from "../i18n/index.js";
import { prix, slug as fabriquerSlug, emojiType } from "../core/format.js";
import { lire, inserer, modifier, supprimer, stockage } from "../core/supa.js";
import { etat } from "../core/etat.js";
import * as catalogue from "../data/catalogue.js";
import { trilingue, champ, interrupteur, panneau, fermerPanneau, table, vide, confirmer }
  from "./commun.js";

const TYPES = [["parfum", "Parfum"], ["alimentaire", "Alimentaire"],
               ["artisanat", "Artisanat"], ["coffret", "Coffret"], ["general", "Autre"]];

const FORMES = ["extrait", "eau_de_parfum", "eau_de_toilette", "huile", "attar",
                "musc", "bakhoor", "encens", "brume", "autre"];

/* ------------------------------------------------------------------ */
/* Éditeur                                                             */
/* ------------------------------------------------------------------ */
async function editeur(produit, surFin) {
  const creation = !produit;
  produit = produit || { type: "parfum", actif: true, stock: 0, prix: 0, ordre: 100 };

  let familles = [], notesRef = [];
  try {
    familles = await catalogue.famillesOlfactives();
    notesRef = await lire("notes_olfactives", { select: "*", order: "ordre.asc" });
  } catch (e) { /* les blocs parfum resteront vides */ }

  /* --- champs généraux --- */
  const nom = trilingue(produit.nom, { libelle: "Nom du produit", requis: true });
  const courte = trilingue(produit.description_courte, { libelle: "Accroche", zone: true, rows: 2 });
  const longue = trilingue(produit.description, { libelle: "Description", zone: true, rows: 5 });

  const cSlug = champ("Identifiant d'URL", produit.slug, { aide: "Laisser vide pour le déduire du nom" });
  const cRef  = champ("Référence (SKU)", produit.reference, { requis: true });
  const cType = champ("Type", produit.type, { choix: TYPES });
  const cCat  = champ("Catégorie", produit.categorie_id, {
    choix: [["", "—"]].concat(etat.categories.map(function (c) {
      const parent = c.parent_id ? etat.categories.find(function (x) { return x.id === c.parent_id; }) : null;
      return [c.id, (parent ? L(parent.nom) + " › " : "") + L(c.nom)];
    })) });
  const cMarque = champ("Marque", produit.marque_id, {
    choix: [["", "—"]].concat(etat.marques.map(function (m) { return [m.id, m.nom]; })) });

  const cPrix  = champ("Prix (MAD)", produit.prix, { type: "number", step: "0.01", min: "0", requis: true });
  const cBarre = champ("Prix barré", produit.prix_barre, { type: "number", step: "0.01", min: "0",
    aide: "Renseigné, il affiche une promotion" });
  const cStock = champ("Stock", produit.stock, { type: "number", min: "0" });
  const cSeuil = champ("Seuil d'alerte", produit.seuil_alerte == null ? 3 : produit.seuil_alerte,
    { type: "number", min: "0" });
  const cMots  = champ("Mots-clés de recherche", produit.mots_cles, { aide: "Séparés par des espaces" });
  const cOrdre = champ("Ordre d'affichage", produit.ordre == null ? 100 : produit.ordre, { type: "number" });

  const iActif   = interrupteur("Visible dans la boutique", produit.actif !== false);
  const iVedette = interrupteur("Mettre en avant sur l'accueil", produit.en_vedette);
  const iNouveau = interrupteur("Marquer « nouveauté »", produit.nouveaute);

  /* --- images --- */
  let images = (produit.images || []).slice().sort(function (a, b) {
    return (b.principale ? 1 : 0) - (a.principale ? 1 : 0) || (a.ordre || 0) - (b.ordre || 0);
  });
  const zoneImages = h("div.images");
  const entreeFichier = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });

  function dessinerImages() {
    vider(zoneImages);
    images.forEach(function (im, i) {
      zoneImages.appendChild(h("div.vign",
        h("img", { src: im.src || stockage.urlPublique(im.url), alt: "" }),
        h("button", { type: "button", title: t("supprimer"), onclick: function () {
          images.splice(i, 1);
          if (images.length && !images.some(function (x) { return x.principale; })) {
            images[0].principale = true;
          }
          dessinerImages();
        } }, "✕"),
        im.principale
          ? h("div.prim", {}, "Principale")
          : h("div.prim", {
              style: { background: "var(--surface-3)", color: "var(--ink-soft)", cursor: "pointer" },
              onclick: function () {
                images.forEach(function (x) { x.principale = false; });
                im.principale = true; dessinerImages();
              } }, "Définir")));
    });
    zoneImages.appendChild(h("button.ajout", {
      type: "button", title: "Ajouter des images", onclick: function () { entreeFichier.click(); }
    }, "+"));
    zoneImages.appendChild(entreeFichier);
  }

  entreeFichier.addEventListener("change", async function () {
    const fichiers = Array.prototype.slice.call(entreeFichier.files || []);
    entreeFichier.value = "";
    for (const f of fichiers) {
      if (f.size > 5 * 1024 * 1024) { notice(f.name + " : plus de 5 Mo", true); continue; }
      const nomFichier = "produits/" + (produit.id || "brouillon") + "/" +
        Date.now() + "-" + fabriquerSlug(f.name.replace(/\.[^.]+$/, "")) +
        (f.name.match(/\.[^.]+$/) || [".jpg"])[0];
      try {
        notice("Envoi de " + f.name + "…");
        const url = await stockage.televerser(nomFichier, f);
        images.push({ url: nomFichier, src: url, principale: images.length === 0, ordre: images.length });
        dessinerImages();
      } catch (e) { notice(e.message || "Envoi refusé", true); }
    }
  });
  dessinerImages();

  /* --- formats --- */
  let variantes = (produit.variantes || []).slice();
  const zoneVariantes = h("div");
  function dessinerVariantes() {
    vider(zoneVariantes);
    variantes.forEach(function (v, i) {
      const nomV = trilingue(v.nom, {});
      const pxV = h("input.input", { type: "number", step: "0.01", min: "0", value: v.prix || "" });
      const stV = h("input.input", { type: "number", min: "0", value: v.stock || 0 });
      v._lire = function () {
        return { id: v.id, nom: nomV.valeur(), prix: Number(pxV.value) || 0,
                 stock: Number(stV.value) || 0, ordre: i * 10, actif: true };
      };
      zoneVariantes.appendChild(h("div.card.card-pad", { style: { marginBottom: "10px" } },
        h("div.row", { style: { justifyContent: "space-between" } },
          h("strong", {}, "Format " + (i + 1)),
          h("button.btn.btn-quiet.btn-sm", { type: "button", onclick: function () {
            variantes.splice(i, 1); dessinerVariantes();
          } }, t("supprimer"))),
        nomV.element,
        h("div.grid-2",
          h("div.field", h("label", {}, "Prix (MAD)"), pxV),
          h("div.field", h("label", {}, "Stock"), stV))));
    });
    zoneVariantes.appendChild(h("button.btn.btn-ghost.btn-sm", {
      type: "button", onclick: function () { variantes.push({ nom: {}, prix: 0, stock: 0 }); dessinerVariantes(); }
    }, "+ Ajouter un format"));
  }
  dessinerVariantes();

  /* --- fiche parfum --- */
  const pf = produit.parfum || {};
  const cFamille = champ("Famille olfactive", pf.famille_id, {
    choix: [["", "—"]].concat(familles.map(function (f) { return [f.id, L(f.nom)]; })) });
  const cGenre = champ("Pour", pf.genre || "unisexe", {
    choix: [["homme", t("homme")], ["femme", t("femme")], ["unisexe", t("unisexe")]] });
  const cForme = champ("Type de parfum", pf.forme || "eau_de_parfum", {
    choix: FORMES.map(function (f) { return [f, f.replace(/_/g, " ")]; }) });
  const cIntensite = champ("Intensité", pf.intensite || "", {
    choix: [["", "—"], ["legere", t("legere")], ["moderee", t("moderee")],
            ["forte", t("forte")], ["tres_forte", t("tres_forte")]] });
  const cDuree = champ("Tenue (heures)", pf.duree_heures, { type: "number", min: "0" });
  const cSillage = champ("Sillage", pf.sillage || "", {
    choix: [["", "—"], ["intime", "Intime"], ["modere", "Modéré"], ["genereux", "Généreux"]] });
  const tOrigine = trilingue(pf.origine, { libelle: "Origine" });

  const notesChoisies = { tete: [], coeur: [], fond: [] };
  (produit.notes || []).forEach(function (n) {
    if (n.note && notesChoisies[n.position]) notesChoisies[n.position].push(n.note.slug || n.note_id);
  });
  function selecteurNotes(position, titre) {
    const zone = h("div.row", { style: { flexWrap: "wrap", gap: "6px" } });
    notesRef.forEach(function (n) {
      const actif = notesChoisies[position].indexOf(n.slug) >= 0;
      const b = h("button.chip", {
        type: "button", "aria-pressed": actif ? "true" : "false",
        onclick: function () {
          const i = notesChoisies[position].indexOf(n.slug);
          if (i >= 0) notesChoisies[position].splice(i, 1);
          else notesChoisies[position].push(n.slug);
          b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
        }
      }, L(n.nom));
      zone.appendChild(b);
    });
    return h("div.field", h("label", {}, titre), zone);
  }

  /* --- fiche alimentaire --- */
  const al = produit.aliment || {};
  const cPoids = champ("Poids (g)", al.poids_g, { type: "number", step: "0.01", min: "0" });
  const tIngredients = trilingue(al.ingredients, { libelle: "Ingrédients", zone: true, rows: 3 });
  const tConservation = trilingue(al.conservation, { libelle: "Conditions de conservation", zone: true, rows: 2 });
  const cDLC = champ("À consommer avant", al.duree_conservation, { placeholder: "6 mois" });
  const tOrigineAl = trilingue(al.origine, { libelle: "Origine" });
  const iMaison = interrupteur("Fait main", al.fait_maison !== false);

  const allergenesRef = etat.parametres.allergenes || [];
  const allergenesChoisis = Array.isArray(al.allergenes) ? al.allergenes.slice() : [];
  const zoneAllergenes = h("div.row", { style: { flexWrap: "wrap", gap: "6px" } },
    allergenesRef.map(function (a) {
      const actif = allergenesChoisis.indexOf(a.cle) >= 0;
      const b = h("button.chip", { type: "button", "aria-pressed": actif ? "true" : "false",
        onclick: function () {
          const i = allergenesChoisis.indexOf(a.cle);
          if (i >= 0) allergenesChoisis.splice(i, 1); else allergenesChoisis.push(a.cle);
          b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
        } }, L(a.nom));
      return b;
    }));

  /* --- assemblage des blocs, selon le type --- */
  const blocParfum = h("fieldset.fieldset", h("legend", {}, "Fiche parfum"),
    h("div.grid-2", cFamille.element, cGenre.element),
    h("div.grid-2", cForme.element, cIntensite.element),
    h("div.grid-2", cDuree.element, cSillage.element),
    tOrigine.element,
    selecteurNotes("tete", t("notes_tete")),
    selecteurNotes("coeur", t("notes_coeur")),
    selecteurNotes("fond", t("notes_fond")));

  const blocAliment = h("fieldset.fieldset", h("legend", {}, "Fiche alimentaire"),
    h("div.grid-2", cPoids.element, cDLC.element),
    tIngredients.element,
    h("div.field", h("label", {}, t("allergenes")), zoneAllergenes),
    tConservation.element,
    tOrigineAl.element,
    iMaison.element);

  function majBlocs() {
    const ty = cType.entree.value;
    blocParfum.hidden = ty !== "parfum";
    blocAliment.hidden = ty !== "alimentaire";
  }
  cType.entree.addEventListener("change", majBlocs);
  majBlocs();

  /* --- enregistrement --- */
  const bouton = h("button.btn.btn-primary", { type: "button" }, t("enregistrer"));

  bouton.addEventListener("click", async function () {
    if (!nom.valide()) { notice("Le nom en français est obligatoire", true); return; }
    if (!cRef.valeur())  { notice("La référence est obligatoire", true); return; }

    bouton.disabled = true;
    const base = {
      reference: cRef.valeur(),
      slug: cSlug.valeur() || fabriquerSlug(nom.valeur().fr),
      nom: nom.valeur(),
      description_courte: courte.valeur(),
      description: longue.valeur(),
      type: cType.entree.value,
      categorie_id: cCat.entree.value || null,
      marque_id: cMarque.entree.value || null,
      prix: cPrix.valeur() || 0,
      prix_barre: cBarre.valeur(),
      stock: cStock.valeur() || 0,
      seuil_alerte: cSeuil.valeur() || 0,
      mots_cles: cMots.valeur() || "",
      ordre: cOrdre.valeur() || 100,
      actif: iActif.valeur(),
      en_vedette: iVedette.valeur(),
      nouveaute: iNouveau.valeur()
    };

    try {
      let id = produit.id;
      if (creation) {
        const cree = await inserer("produits", base, { select: "id" });
        id = (Array.isArray(cree) ? cree[0] : cree).id;
      } else {
        await modifier("produits", { id: "eq." + id }, base);
      }

      /* images : on remplace la galerie, l'ordre vient de l'affichage */
      await supprimer("produit_images", { produit_id: "eq." + id });
      if (images.length) {
        await inserer("produit_images", images.map(function (im, i) {
          return { produit_id: id, url: im.url, ordre: i * 10, principale: !!im.principale };
        }));
      }

      /* formats */
      await supprimer("produit_variantes", { produit_id: "eq." + id });
      const listeV = variantes.map(function (v) { return v._lire(); })
        .filter(function (v) { return v.nom && v.nom.fr; });
      if (listeV.length) {
        await inserer("produit_variantes", listeV.map(function (v) {
          return { produit_id: id, nom: v.nom, prix: v.prix, stock: v.stock,
                   ordre: v.ordre, actif: true };
        }));
      }

      /* fiches spécialisées */
      if (base.type === "parfum") {
        await inserer("parfum_details", {
          produit_id: id,
          famille_id: cFamille.entree.value || null,
          genre: cGenre.entree.value,
          forme: cForme.entree.value,
          intensite: cIntensite.entree.value || null,
          duree_heures: cDuree.valeur(),
          sillage: cSillage.entree.value || null,
          origine: tOrigine.valeur()
        }, { surConflit: "produit_id" });

        await supprimer("produit_notes", { produit_id: "eq." + id });
        const lignesNotes = [];
        Object.keys(notesChoisies).forEach(function (pos) {
          notesChoisies[pos].forEach(function (slugNote, i) {
            const n = notesRef.find(function (x) { return x.slug === slugNote; });
            if (n) lignesNotes.push({ produit_id: id, note_id: n.id, position: pos, ordre: i * 10 });
          });
        });
        if (lignesNotes.length) await inserer("produit_notes", lignesNotes);
      } else if (base.type === "alimentaire") {
        await inserer("aliment_details", {
          produit_id: id,
          poids_g: cPoids.valeur(),
          ingredients: tIngredients.valeur(),
          allergenes: allergenesChoisis,
          conservation: tConservation.valeur(),
          duree_conservation: cDLC.valeur(),
          origine: tOrigineAl.valeur(),
          fait_maison: iMaison.valeur()
        }, { surConflit: "produit_id" });
      }

      notice("Produit enregistré ✓");
      fermerPanneau();
      surFin();
    } catch (e) {
      notice(e.message || t("erreur"), true);
      bouton.disabled = false;
    }
  });

  panneau(creation ? "Nouveau produit" : L(produit.nom),
    h("div",
      h("fieldset.fieldset", h("legend", {}, "Identité"),
        nom.element, courte.element, longue.element,
        h("div.grid-2", cRef.element, cSlug.element),
        h("div.grid-2", cType.element, cCat.element),
        cMarque.element),

      h("fieldset.fieldset", h("legend", {}, "Images"), zoneImages),

      h("fieldset.fieldset", h("legend", {}, "Prix et stock"),
        h("div.grid-2", cPrix.element, cBarre.element),
        h("div.grid-2", cStock.element, cSeuil.element),
        h("p.hint", {}, "Si le produit a plusieurs formats, ce sont eux qui portent le prix et le stock.")),

      h("fieldset.fieldset", h("legend", {}, "Formats"), zoneVariantes),

      blocParfum, blocAliment,

      h("fieldset.fieldset", h("legend", {}, "Publication"),
        iActif.element, iVedette.element, iNouveau.element,
        h("div.grid-2", cMots.element, cOrdre.element))),
    [h("button.btn.btn-ghost", { type: "button", onclick: fermerPanneau }, t("annuler")), bouton]);

  nom.focus();
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */
export default async function produits(hote) {
  const recherche = h("input.input.grow", { type: "search", placeholder: t("rechercher") });
  const filtreType = h("select.select", {},
    [["", "Tous les types"]].concat(TYPES).map(function (x) {
      return h("option", { value: x[0] }, x[1]);
    }));
  const filtreEtat = h("select.select", {},
    h("option", { value: "" }, "Tous"),
    h("option", { value: "actif" }, "Visibles"),
    h("option", { value: "inactif" }, "Masqués"),
    h("option", { value: "rupture" }, "En rupture"));
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));

  let liste = [];

  async function recharger() {
    remplir(zone, h("p.faint", {}, t("chargement")));
    try {
      liste = await lire("produits", {
        select: "id,reference,slug,nom,type,prix,prix_barre,stock,seuil_alerte,actif," +
                "en_vedette,nb_ventes,categorie_id,marque_id," +
                "images:produit_images(url,principale,ordre)," +
                "variantes:produit_variantes(id,nom,prix,stock,ordre,actif)," +
                "parfum:parfum_details(*)," +
                "aliment:aliment_details(*)," +
                "notes:produit_notes(position,ordre,note_id,note:notes_olfactives(slug))",
        order: "modifie_le.desc", limit: 500
      });
      liste = liste.map(catalogue.preparer);
      dessiner();
    } catch (e) {
      remplir(zone, h("div.vide-etat", h("div.em", {}, "⚠️"), h("h3", {}, e.message || t("erreur"))));
    }
  }

  function dessiner() {
    const q = recherche.value.trim().toLowerCase();
    const ty = filtreType.value, et = filtreEtat.value;

    const filtres = liste.filter(function (p) {
      if (ty && p.type !== ty) return false;
      if (et === "actif" && !p.actif) return false;
      if (et === "inactif" && p.actif) return false;
      if (et === "rupture" && Number(p.stock) > Number(p.seuil_alerte || 0)) return false;
      if (!q) return true;
      const texte = LANGUES.map(function (l) { return (p.nom || {})[l] || ""; }).join(" ") +
        " " + (p.reference || "");
      return texte.toLowerCase().indexOf(q) >= 0;
    });

    remplir(zone, filtres.length
      ? table(["", "Produit", "Référence", "Type", { titre: "Prix", num: true },
               { titre: "Stock", num: true }, "État", ""], filtres, function (p) {
          return h("tr",
            h("td", {}, p.image
              ? h("img.mini", { src: p.image, alt: "", loading: "lazy" })
              : h("div.mini", { style: { display: "grid", placeItems: "center",
                  background: "var(--surface-2)", borderRadius: "6px", width: "40px", height: "40px" } },
                  emojiType(p.type))),
            h("td", {}, h("strong", {}, L(p.nom)),
              p.en_vedette ? h("span.badge.badge-new", { style: { marginInlineStart: "6px" } }, "★") : null),
            h("td", {}, h("code", { style: { fontSize: "12px" } }, p.reference)),
            h("td", {}, p.type),
            h("td.num", {}, prix(p.prix)),
            h("td.num", {}, (function () {
              /* le stock qui compte est celui des formats, quand il y en a */
              const actifs = (p.variantes || []).filter(function (v) { return v.actif !== false; });
              const dispo = actifs.length
                ? actifs.reduce(function (n, v) { return n + Number(v.stock || 0); }, 0)
                : Number(p.stock);
              const libelle = actifs.length ? dispo + " (" + actifs.length + " formats)" : String(dispo);
              return dispo <= Number(p.seuil_alerte || 0)
                ? h("span.badge.badge-promo", {}, libelle) : libelle;
            })()),
            h("td", {}, p.actif ? h("span.badge.badge-ok", {}, "Visible")
                                : h("span.badge.badge-rupt", {}, "Masqué")),
            h("td", {}, h("div.row", { style: { gap: "4px", justifyContent: "flex-end" } },
              h("button.btn.btn-quiet.btn-sm", { type: "button",
                onclick: function () { editeur(p, recharger); } }, t("modifier")),
              h("button.btn.btn-quiet.btn-sm", { type: "button", onclick: async function () {
                if (!await confirmer("Supprimer « " + L(p.nom) + " » ?")) return;
                try { await supprimer("produits", { id: "eq." + p.id }); recharger(); }
                catch (e) { notice(e.message || t("erreur"), true); }
              } }, t("supprimer")))));
        })
      : vide(t("aucun_resultat")));
  }

  [recherche, filtreType, filtreEtat].forEach(function (el) {
    el.addEventListener("input", dessiner);
    el.addEventListener("change", dessiner);
  });

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Produits"),
      h("span.grow"),
      h("button.btn.btn-primary", { type: "button",
        onclick: function () { editeur(null, recharger); } }, "+ Nouveau produit")),
    h("div.outils", recherche, filtreType, filtreEtat),
    zone);

  recharger();
}
