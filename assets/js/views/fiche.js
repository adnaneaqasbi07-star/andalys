/* =====================================================================
   Fiche produit — galerie, formats, pyramide olfactive ou fiche
   alimentaire, avis, produits similaires.
   ===================================================================== */

import { messageErreur } from "../core/supa.js";
import { h, remplir, image, etoiles, notice, $, vider } from "../core/dom.js";
import { t, L, langue } from "../i18n/index.js";
import { prix, pourcentageRemise, delai, dateHeure } from "../core/format.js";
import { lien, aller } from "../core/routeur.js";
import { etat } from "../core/etat.js";
import { APP } from "../core/config.js";
import * as catalogue from "../data/catalogue.js";
import * as panier from "../data/panier.js";
import { estFavori, basculer } from "../data/favoris.js";
import { inserer } from "../core/supa.js";
import { grille, squelettes, visuelVide } from "../ui/carte.js";
import { ouvrirTiroir } from "../ui/coque.js";

/* ------------------------------------------------------------------ */
function galerie(p) {
  const images = p.images && p.images.length ? p.images : [];
  const grande = h("div.principale");
  const vignettes = h("div.vignettes");

  const montrer = function (i) {
    vider(grande);
    grande.classList.remove("zoom");
    grande.appendChild(images.length
      ? image(images[i].src, L(images[i].alt) || L(p.nom))
      : visuelVide(p.type, true));
    Array.prototype.forEach.call(vignettes.children, function (b, j) {
      b.setAttribute("aria-pressed", j === i ? "true" : "false");
    });
  };

  images.forEach(function (im, i) {
    vignettes.appendChild(h("button", {
      type: "button", "aria-label": (i + 1) + "/" + images.length,
      onclick: function () { montrer(i); }
    }, image(im.src, "")));
  });

  grande.addEventListener("click", function () {
    if (images.length) grande.classList.toggle("zoom");
  });

  montrer(0);
  return h("div.galerie", grande, images.length > 1 ? vignettes : null);
}

/* ------------------------------------------------------------------ */
function faits(p) {
  const lignes = [];
  const pf = p.parfum, al = p.aliment;

  if (pf) {
    if (pf.famille) lignes.push([t("famille_olfactive"), L(pf.famille.nom)]);
    if (pf.genre)   lignes.push([t("genre"), t(pf.genre)]);
    if (pf.forme)   lignes.push([t("type_parfum"), pf.forme.replace(/_/g, " ")]);
    if (pf.intensite) lignes.push([t("intensite"), t(pf.intensite)]);
    if (pf.duree_heures) lignes.push([t("duree"), pf.duree_heures + " " + t("heures")]);
    if (L(pf.origine))   lignes.push([t("origine"), L(pf.origine)]);
  }
  if (al) {
    if (al.poids_g)  lignes.push([t("poids"), al.poids_g >= 1000
                                    ? (al.poids_g / 1000) + " kg" : al.poids_g + " g"]);
    if (al.duree_conservation) lignes.push([t("duree_conservation"), al.duree_conservation]);
    if (L(al.origine)) lignes.push([t("origine"), L(al.origine)]);
    if (al.fait_maison) lignes.push([t("fait_maison"), "✓"]);
  }
  if (p.reference) lignes.push([t("reference"), p.reference]);

  if (!lignes.length) return null;
  return h("div.faits", {}, lignes.map(function (l) {
    return h("div.fait", h("div.k", {}, l[0]), h("div.v", {}, l[1]));
  }));
}

function pyramide(p) {
  if (!p.notes || !p.notes.length) return null;
  const par = { tete: [], coeur: [], fond: [] };
  p.notes.slice()
    .sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); })
    .forEach(function (n) { if (par[n.position] && n.note) par[n.position].push(n.note); });

  const ligne = function (cle, titre) {
    if (!par[cle].length) return null;
    return h("div.pyr-ligne",
      h("div.k", {}, titre),
      h("div.v", {}, par[cle].map(function (n) {
        return h("span.badge", {}, L(n.nom));
      })));
  };

  const contenu = [ligne("tete", t("notes_tete")), ligne("coeur", t("notes_coeur")), ligne("fond", t("notes_fond"))]
    .filter(Boolean);
  if (!contenu.length) return null;

  return h("details.bloc", { open: true },
    h("summary", {}, t("pyramide")),
    h("div.corps", h("div.pyramide", {}, contenu)));
}

function ficheAlimentaire(p) {
  const al = p.aliment;
  if (!al) return null;
  const ref = etat.parametres.allergenes || [];
  const nomAllergene = function (cle) {
    const a = ref.find(function (x) { return x.cle === cle; });
    return a ? L(a.nom) : cle;
  };
  const liste = Array.isArray(al.allergenes) ? al.allergenes : [];

  const morceaux = [];
  if (L(al.ingredients)) morceaux.push(h("p", {}, h("strong", {}, t("ingredients") + " : "), L(al.ingredients)));
  morceaux.push(h("p", {}, h("strong", {}, t("allergenes") + " : "),
    liste.length ? liste.map(nomAllergene).join(", ") : t("sans_allergene")));
  if (L(al.conservation)) morceaux.push(h("p", {}, h("strong", {}, t("conservation") + " : "), L(al.conservation)));

  return h("details.bloc", h("summary", {}, t("details")), h("div.corps", {}, morceaux));
}

/* ------------------------------------------------------------------ */
function blocAchat(p) {
  const variantes = p.variantes || [];
  let variante = variantes.length ? variantes.find(function (v) { return v.stock > 0; }) || variantes[0] : null;
  let quantite = 1;

  const zonePrix = h("div.prix-bloc");
  const zoneStock = h("div", { style: { marginBottom: "16px" } });
  const champQte = h("input", { type: "text", inputmode: "numeric", value: "1", "aria-label": t("quantite") });
  const boutonAjout = h("button.btn.btn-primary.btn-lg.grow", { type: "button" });
  const boutonAchat = h("button.btn.btn-gold.btn-lg.grow", { type: "button" });

  function stockActuel() { return Number(variante ? variante.stock : p.stock) || 0; }

  function rafraichir() {
    const px  = Number(variante ? variante.prix : p.prix);
    const bar = variante ? variante.prix_barre : p.prix_barre;
    const remise = pourcentageRemise(px, bar);

    remplir(zonePrix,
      h("span.px", {}, prix(px)),
      bar ? h("span.px-old", {}, prix(bar)) : null,
      remise ? h("span.badge.badge-promo", {}, "−" + remise + "%") : null);

    const s = stockActuel();
    remplir(zoneStock, s <= 0
      ? h("span.badge.badge-rupt", {}, t("rupture"))
      : s <= 5
        ? h("span.badge.badge-new", {}, t("stock_faible") + " · " + s)
        : h("span.badge.badge-ok", {}, "✓ " + t("en_stock")));

    quantite = Math.max(1, Math.min(quantite, s || 1));
    champQte.value = String(quantite);
    const rupture = s <= 0;
    boutonAjout.disabled = rupture;
    boutonAchat.disabled = rupture;
    boutonAjout.textContent = rupture ? t("rupture") : t("ajouter_panier");
    boutonAchat.textContent = t("acheter");
  }

  const selecteurFormats = variantes.length
    ? h("div.field",
        h("label", {}, t("format")),
        h("div.row", { style: { flexWrap: "wrap", gap: "8px" } },
          variantes.map(function (v) {
            const b = h("button.chip", {
              type: "button",
              "aria-pressed": variante && v.id === variante.id ? "true" : "false",
              disabled: v.stock <= 0,
              onclick: function () {
                variante = v;
                Array.prototype.forEach.call(b.parentNode.children, function (x) {
                  x.setAttribute("aria-pressed", "false");
                });
                b.setAttribute("aria-pressed", "true");
                rafraichir();
              }
            }, L(v.nom) + " · " + prix(v.prix));
            return b;
          })))
    : null;

  const changerQte = function (d) {
    quantite = Math.max(1, Math.min(APP.qteMax, stockActuel() || 1, quantite + d));
    champQte.value = String(quantite);
  };
  champQte.addEventListener("change", function () {
    quantite = Math.max(1, Math.min(APP.qteMax, stockActuel() || 1, Number(champQte.value) || 1));
    champQte.value = String(quantite);
  });

  boutonAjout.addEventListener("click", function () {
    panier.ajouter(p, variante, quantite);
    notice(t("ajoute"));
    ouvrirTiroir();
  });
  boutonAchat.addEventListener("click", function () {
    panier.ajouter(p, variante, quantite);
    aller("/commande");
  });

  const coeur = h("button.icon-btn" + (estFavori(p.id) ? ".on" : ""), {
    type: "button", "aria-label": t("favoris"),
    style: { border: "1px solid var(--line)", borderRadius: "var(--r-s)", width: "54px", height: "54px" },
    onclick: async function () {
      try {
        const ok = await basculer(p.id);
        coeur.classList.toggle("on", ok);
        coeur.textContent = ok ? "♥" : "♡";
        notice(t(ok ? "ajoute_favoris" : "retire_favoris"));
      } catch (e) { notice(t("erreur"), true); }
    }
  }, estFavori(p.id) ? "♥" : "♡");

  rafraichir();

  const zone = catalogue.zoneParVille("Fès");
  return h("div",
    zonePrix,
    zoneStock,
    selecteurFormats,
    h("div.row", { style: { gap: "10px", marginBottom: "10px", flexWrap: "wrap" } },
      h("div.qte",
        h("button", { type: "button", "aria-label": "−", onclick: function () { changerQte(-1); } }, "−"),
        champQte,
        h("button", { type: "button", "aria-label": "+", onclick: function () { changerQte(1); } }, "+")),
      boutonAjout, coeur),
    boutonAchat,
    h("div.card.card-pad", { style: { marginTop: "18px", background: "var(--surface-2)", border: 0 } },
      h("div.row", { style: { gap: "10px", alignItems: "flex-start" } },
        h("span", { style: { fontSize: "20px" } }, "🚚"),
        h("div",
          h("div", { style: { fontWeight: "500", fontSize: "14px" } }, t("assur_livraison")),
          h("div.faint", {}, t("assur_livraison_d") +
            (zone ? " · " + delai(zone.delai_min, zone.delai_max) : "") +
            (zone && zone.gratuit_des ? " · " + t("offerte_des") + " " + prix(zone.gratuit_des) : ""))))));
}

/* ------------------------------------------------------------------ */
function blocAvis(p) {
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));

  const formulaire = function () {
    if (!etat.utilisateur) {
      return h("p.faint", {}, t("avis_connexion") + " · ",
        h("a", { href: lien("/connexion"), style: { color: "var(--accent)" } }, t("connexion")));
    }
    let note = 5;
    const etoilesChoix = h("div.row", { style: { gap: "4px" } });
    const dessiner = function () {
      vider(etoilesChoix);
      for (let i = 1; i <= 5; i++) {
        (function (n) {
          etoilesChoix.appendChild(h("button", {
            type: "button", "aria-label": n + "/5",
            style: { border: 0, background: "none", cursor: "pointer", fontSize: "24px",
                     color: n <= note ? "var(--gold)" : "var(--line)", padding: "0 2px" },
            onclick: function () { note = n; dessiner(); }
          }, "★"));
        })(i);
      }
    };
    dessiner();

    const texte = h("textarea.textarea", { placeholder: t("votre_avis"), maxLength: 900 });
    const envoyer = h("button.btn.btn-primary", { type: "button" }, t("laisser_avis"));
    envoyer.addEventListener("click", async function () {
      envoyer.disabled = true;
      try {
        await inserer("avis", {
          produit_id: p.id, user_id: etat.utilisateur.id,
          nom: etat.utilisateur.nom || etat.utilisateur.email.split("@")[0],
          note: note, commentaire: texte.value.trim() || null, statut: "en_attente"
        });
        notice(t("avis_envoye"));
        texte.value = "";
      } catch (e) { notice(e.message || t("erreur"), true); }
      envoyer.disabled = false;
    });

    return h("div.card.card-pad", { style: { marginTop: "18px" } },
      h("div.field", h("label", {}, t("votre_note")), etoilesChoix),
      h("div.field", h("label", {}, t("votre_avis")), texte),
      envoyer);
  };

  catalogue.avisPublies(p.id).then(function (liste) {
    if (!liste.length) {
      remplir(zone, h("p.faint", {}, t("aucun_avis")), formulaire());
      return;
    }
    remplir(zone,
      h("div", { style: { display: "grid", gap: "14px" } }, liste.map(function (a) {
        return h("div", { style: { borderBottom: "1px solid var(--line-soft)", paddingBottom: "14px" } },
          h("div.row", { style: { gap: "10px" } },
            etoiles(a.note),
            h("strong", { style: { fontSize: "14px" } }, a.nom),
            h("span.faint.grow", { style: { textAlign: "end" } }, dateHeure(a.cree_le))),
          a.commentaire ? h("p", { style: { margin: "6px 0 0" } }, a.commentaire) : null);
      })),
      formulaire());
  }).catch(function () { remplir(zone, h("p.faint", {}, t("aucun_avis")), formulaire()); });

  return h("details.bloc", { open: true },
    h("summary", {}, t("avis") + (p.nb_avis ? " (" + p.nb_avis + ")" : "")),
    h("div.corps", zone));
}

/* ------------------------------------------------------------------ */
export default async function fiche(hote, params) {
  remplir(hote, h("div.wrap.section", squelettes(1)));

  let p;
  try { p = await catalogue.produitParSlug(params.slug); }
  catch (e) {
    remplir(hote, h("div.wrap", h("div.vide-etat",
      h("div.em", {}, "⚠️"),
      h("h3", {}, t("erreur")),
      h("p", {}, messageErreur(e)),
      e.indice ? h("p.faint", {}, e.indice) : null)));
    return;
  }

  if (!p) {
    remplir(hote, h("div.wrap", h("div.vide-etat",
      h("div.em", {}, "🕳"), h("h3", {}, t("aucun_resultat")),
      h("a.btn.btn-primary", { href: lien("/produits") }, t("nos_produits")))));
    return;
  }

  document.title = L(p.nom) + " · " + (L((etat.parametres.boutique || {}).nom) || "Andalys");
  const cat = p.categorie;
  const zoneSimilaires = h("div");

  remplir(hote, h("div.wrap",
    h("nav.fil",
      h("a", { href: lien("/") }, t("accueil")), "›",
      cat ? h("a", { href: lien("/c/" + cat.slug) }, L(cat.nom)) : null,
      cat ? "›" : null,
      h("span", { style: { color: "var(--ink)" } }, L(p.nom))),

    h("div.fiche",
      galerie(p),
      h("div",
        p.marque ? h("a.eyebrow", { href: lien("/m/" + p.marque.slug) }, p.marque.nom) : null,
        h("h1.fiche-titre", {}, L(p.nom)),
        Number(p.nb_avis) > 0
          ? h("div.row", { style: { gap: "8px", marginBottom: "10px" } },
              etoiles(p.note_moyenne),
              h("span.faint", {}, p.note_moyenne + " " + t("sur_5") + " · " + p.nb_avis + " " + t("avis")))
          : null,
        L(p.description_courte) ? h("p.muted", {}, L(p.description_courte)) : null,
        blocAchat(p),
        faits(p))),

    h("section.section", { style: { paddingBlock: "34px" } },
      L(p.description)
        ? h("details.bloc", { open: true },
            h("summary", {}, t("description")),
            h("div.corps", {}, L(p.description)))
        : null,
      pyramide(p),
      ficheAlimentaire(p),
      blocAvis(p)),

    zoneSimilaires));

  window.scrollTo(0, 0);

  catalogue.similaires(p, 8).then(function (liste) {
    if (!liste.length) return;
    remplir(zoneSimilaires, h("section.section",
      h("div.section-head", h("div", h("h2", {}, t("produits_similaires")))),
      grille(liste)));
  }).catch(function () { /* section simplement absente */ });
}
