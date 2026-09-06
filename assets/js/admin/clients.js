/* Liste des clients et de leur historique. */

import { h, remplir } from "../core/dom.js";
import { t } from "../i18n/index.js";
import { prix, dateHeure } from "../core/format.js";
import { lire } from "../core/supa.js";
import { table, vide, panneau, fermerPanneau } from "./commun.js";

async function detail(c) {
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));
  panneau(c.nom || c.email, zone,
    [h("button.btn.btn-ghost", { type: "button", onclick: fermerPanneau }, t("fermer"))]);

  try {
    const commandes = await lire("commandes", {
      select: "numero,statut,total,cree_le,ville",
      where: { user_id: "eq." + c.user_id }, order: "cree_le.desc"
    });
    const adresses = await lire("adresses", {
      select: "*", where: { user_id: "eq." + c.user_id }
    });

    remplir(zone,
      h("div.fieldset", h("legend", {}, "Contact"),
        h("p", {}, "✉️ " + c.email),
        c.telephone ? h("p", {}, "📞 " + c.telephone) : null,
        h("p.faint", {}, "Inscrit le " + dateHeure(c.cree_le) + " · " + (c.langue || "fr").toUpperCase())),

      h("div.fieldset", h("legend", {}, t("mes_adresses")),
        adresses.length
          ? adresses.map(function (a) {
              return h("p", {}, (a.par_defaut ? "★ " : "") +
                [a.adresse, a.quartier, a.ville].filter(Boolean).join(" · ") + " — " + a.telephone);
            })
          : h("p.faint", {}, "Aucune adresse")),

      h("div.fieldset", h("legend", {}, t("mes_commandes")),
        commandes.length
          ? table(["N°", "Date", "Ville", "Statut", { titre: "Total", num: true }], commandes,
              function (o) {
                return h("tr",
                  h("td", {}, h("a", { href: "#/commandes/" + o.numero }, o.numero)),
                  h("td", {}, dateHeure(o.cree_le)),
                  h("td", {}, o.ville),
                  h("td", {}, h("span.statut-pastille.st-" + o.statut, h("i"), t("st_" + o.statut))),
                  h("td.num", {}, prix(o.total)));
              })
          : h("p.faint", {}, t("aucune_commande"))));
  } catch (e) {
    remplir(zone, h("p", { style: { color: "var(--danger)" } }, e.message || t("erreur")));
  }
}

export default async function clients(hote) {
  remplir(hote, h("div.adm-tete", h("h1", {}, "Clients")), h("p.faint", {}, t("chargement")));

  let liste;
  try {
    liste = await lire("clients", { select: "*", order: "cree_le.desc", limit: 500 });
  } catch (e) {
    remplir(hote, h("div.vide-etat", h("div.em", {}, "⚠️"), h("h3", {}, e.message || t("erreur"))));
    return;
  }

  const recherche = h("input.input.grow", { type: "search", placeholder: t("rechercher") });
  const zone = h("div");

  const dessiner = function () {
    const q = recherche.value.trim().toLowerCase();
    const filtres = q
      ? liste.filter(function (c) {
          return (c.email + " " + (c.nom || "") + " " + (c.telephone || "")).toLowerCase().indexOf(q) >= 0;
        })
      : liste;

    remplir(zone, filtres.length
      ? table(["Nom", "E-mail", "Téléphone", "Langue", "Inscrit le", ""], filtres, function (c) {
          return h("tr",
            h("td", {}, c.nom || "—"),
            h("td", {}, c.email),
            h("td", {}, c.telephone || "—"),
            h("td", {}, (c.langue || "fr").toUpperCase()),
            h("td", {}, dateHeure(c.cree_le)),
            h("td", {}, h("button.btn.btn-quiet.btn-sm", {
              type: "button", onclick: function () { detail(c); } }, t("voir"))));
        })
      : vide(t("aucun_resultat")));
  };

  recherche.addEventListener("input", dessiner);

  remplir(hote,
    h("div.adm-tete", h("h1", {}, "Clients"), h("span.faint", {}, liste.length + " " + t("resultats"))),
    h("div.outils", recherche),
    zone);
  dessiner();
}
