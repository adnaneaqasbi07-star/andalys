/* =====================================================================
   Commandes : suivi, changement de statut, détail, export CSV.
   Le changement de statut est journalisé par un déclencheur Postgres,
   il n'y a rien à écrire ici pour la traçabilité.
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { prix, dateHeure } from "../core/format.js";
import { lire, lireUn, modifier } from "../core/supa.js";
import { STATUTS } from "../data/commandes.js";
import { table, vide, panneau, fermerPanneau, champ } from "./commun.js";

function pastille(statut) {
  return h("span.statut-pastille.st-" + statut, h("i"), t("st_" + statut));
}

/* ------------------------------------------------------------------ */
async function detail(numero, surFin) {
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));
  panneau(numero, zone, [h("button.btn.btn-ghost", { type: "button", onclick: fermerPanneau },
    t("fermer"))]);

  let c;
  try {
    c = await lireUn("commandes", {
      select: "*,lignes:commande_lignes(*),suivi:commande_suivi(statut,commentaire,cree_par,cree_le)," +
              "zone:zones_livraison(nom,delai_min,delai_max)",
      where: { numero: "eq." + numero }
    });
  } catch (e) {
    remplir(zone, h("p", { style: { color: "var(--danger)" } }, e.message || t("erreur")));
    return;
  }
  if (!c) { remplir(zone, vide(t("aucun_resultat"))); return; }

  const selecteur = h("select.select", {}, STATUTS.map(function (s) {
    return h("option", { value: s, selected: c.statut === s }, t("st_" + s));
  }));
  const commentaire = h("input.input", { placeholder: "Commentaire (facultatif)" });
  const bouton = h("button.btn.btn-primary", { type: "button" }, "Mettre à jour");

  bouton.addEventListener("click", async function () {
    bouton.disabled = true;
    try {
      await modifier("commandes", { id: "eq." + c.id }, { statut: selecteur.value });
      if (commentaire.value.trim()) {
        await import("../core/supa.js").then(function (m) {
          return m.inserer("commande_suivi", {
            commande_id: c.id, statut: selecteur.value,
            commentaire: commentaire.value.trim()
          });
        });
      }
      notice("Statut mis à jour ✓");
      fermerPanneau();
      surFin();
    } catch (e) { notice(e.message || t("erreur"), true); bouton.disabled = false; }
  });

  const notes = champ("Note interne", c.notes_admin, { zone: true, rows: 2 });
  const boutonNote = h("button.btn.btn-ghost.btn-sm", { type: "button" }, t("enregistrer"));
  boutonNote.addEventListener("click", async function () {
    try {
      await modifier("commandes", { id: "eq." + c.id }, { notes_admin: notes.valeur() });
      notice("Note enregistrée ✓");
    } catch (e) { notice(e.message || t("erreur"), true); }
  });

  remplir(zone,
    h("fieldset.fieldset", h("legend", {}, "Statut"),
      h("div.row", { style: { gap: "10px", flexWrap: "wrap" } }, pastille(c.statut),
        h("span.faint", {}, dateHeure(c.cree_le))),
      h("div.field", { style: { marginTop: "12px" } },
        h("label", {}, "Changer le statut"), selecteur),
      h("div.field", h("label", {}, "Commentaire de suivi"), commentaire),
      bouton),

    h("fieldset.fieldset", h("legend", {}, "Livraison"),
      h("p", {}, h("strong", {}, c.nom_complet), " · ", h("a", { href: "tel:" + c.telephone }, c.telephone)),
      c.email ? h("p", {}, h("a", { href: "mailto:" + c.email }, c.email)) : null,
      h("p", {}, [c.adresse, c.quartier, c.ville].filter(Boolean).join(" · ")),
      c.instructions ? h("p.faint", {}, "« " + c.instructions + " »") : null,
      c.delai_estime ? h("p.faint", {}, "Délai annoncé : " + c.delai_estime + " " + t("jours")) : null,
      h("p.faint", {}, "Paiement : " + t(c.mode_paiement === "cod" ? "cod" : "virement"))),

    h("fieldset.fieldset", h("legend", {}, "Articles"),
      table(["Produit", "Réf.", { titre: "PU", num: true }, { titre: "Qté", num: true },
             { titre: "Total", num: true }], c.lignes || [], function (l) {
        return h("tr",
          h("td", {}, L(l.nom) + (l.variante_nom ? " · " + L(l.variante_nom) : "")),
          h("td", {}, h("code", { style: { fontSize: "12px" } }, l.reference || "—")),
          h("td.num", {}, prix(l.prix_unitaire)),
          h("td.num", {}, l.quantite),
          h("td.num", {}, prix(l.total)));
      }),
      h("div.totaux", { style: { marginTop: "12px" } },
        h("div.t", {}, h("span", {}, t("sous_total")), h("span", {}, prix(c.sous_total))),
        h("div.t", {}, h("span", {}, t("livraison")), h("span", {}, prix(c.frais_livraison))),
        Number(c.remise) ? h("div.t", {}, h("span", {}, t("remise") +
          (c.code_promo ? " · " + c.code_promo : "")), h("span", {}, "−" + prix(c.remise))) : null,
        h("div.t.grand", {}, h("span", {}, t("total")), h("span", {}, prix(c.total))))),

    h("fieldset.fieldset", h("legend", {}, "Journal"),
      h("div", { style: { display: "grid", gap: "6px" } },
        (c.suivi || []).slice().sort(function (a, b) {
          return new Date(a.cree_le) - new Date(b.cree_le);
        }).map(function (s) {
          return h("div.row", { style: { gap: "10px", fontSize: "13.5px" } },
            pastille(s.statut),
            h("span.grow.faint", {}, s.commentaire || ""),
            h("span.faint", {}, dateHeure(s.cree_le)));
        }))),

    h("fieldset.fieldset", h("legend", {}, "Interne"), notes.element, boutonNote));
}

/* ------------------------------------------------------------------ */
function exporterCSV(liste) {
  const entetes = ["numero", "date", "statut", "client", "telephone", "ville", "adresse",
                   "sous_total", "livraison", "remise", "total", "paiement"];
  const echapper = function (v) {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lignes = [entetes.join(";")].concat(liste.map(function (c) {
    return [c.numero, c.cree_le, c.statut, c.nom_complet, c.telephone, c.ville, c.adresse,
            c.sous_total, c.frais_livraison, c.remise, c.total, c.mode_paiement]
      .map(echapper).join(";");
  }));
  /* BOM : sans lui, Excel en français casse les accents. */
  const blob = new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "commandes-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

/* ------------------------------------------------------------------ */
export default async function commandes(hote, params) {
  const filtreStatut = h("select.select", {},
    h("option", { value: "" }, "Tous les statuts"),
    h("option", { value: "__actives" }, "À traiter"),
    STATUTS.map(function (s) { return h("option", { value: s }, t("st_" + s)); }));
  const recherche = h("input.input.grow", { type: "search", placeholder: "N°, client, téléphone…" });
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));

  let liste = [];

  async function recharger() {
    try {
      liste = await lire("commandes", {
        select: "id,numero,statut,nom_complet,telephone,email,ville,adresse,total," +
                "sous_total,frais_livraison,remise,mode_paiement,cree_le",
        order: "cree_le.desc", limit: 500
      });
      dessiner();
    } catch (e) {
      remplir(zone, h("div.vide-etat", h("div.em", {}, "⚠️"), h("h3", {}, e.message || t("erreur"))));
    }
  }

  function dessiner() {
    const st = filtreStatut.value;
    const q = recherche.value.trim().toLowerCase();
    const filtres = liste.filter(function (c) {
      if (st === "__actives" && ["livree", "annulee"].indexOf(c.statut) >= 0) return false;
      if (st && st !== "__actives" && c.statut !== st) return false;
      if (!q) return true;
      return (c.numero + " " + c.nom_complet + " " + c.telephone + " " + c.ville)
        .toLowerCase().indexOf(q) >= 0;
    });

    remplir(zone, filtres.length
      ? table(["N°", "Date", "Client", "Ville", "Statut", { titre: "Total", num: true }, ""],
          filtres, function (c) {
            return h("tr",
              h("td", {}, h("strong", {}, c.numero)),
              h("td", {}, dateHeure(c.cree_le)),
              h("td", {}, c.nom_complet, h("div.faint", {}, c.telephone)),
              h("td", {}, c.ville),
              h("td", {}, pastille(c.statut)),
              h("td.num", {}, prix(c.total)),
              h("td", {}, h("button.btn.btn-quiet.btn-sm", { type: "button",
                onclick: function () { detail(c.numero, recharger); } }, t("voir"))));
          })
      : vide(t("aucun_resultat")));
  }

  filtreStatut.addEventListener("change", dessiner);
  recherche.addEventListener("input", dessiner);

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Commandes"), h("span.grow"),
      h("button.btn.btn-ghost", { type: "button",
        onclick: function () { exporterCSV(liste); } }, "⤓ Export CSV")),
    h("div.outils", recherche, filtreStatut),
    zone);

  await recharger();

  /* Lien direct #/commandes/EF-2026-000012 */
  if (params && params.id) detail(params.id, recharger);
}
