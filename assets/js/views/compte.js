/* =====================================================================
   Espace client : connexion, inscription, profil, adresses, commandes.
   ===================================================================== */

import { h, remplir, notice, vider, image } from "../core/dom.js";
import { t, L, LANGUES, NOMS_LANGUE, langue, definirLangue } from "../i18n/index.js";
import { prix, dateHeure, emailValide, telephoneValide } from "../core/format.js";
import { lien, aller } from "../core/routeur.js";
import { etat } from "../core/etat.js";
import { auth, deconnexion, majProfil, mesAdresses, enregistrerAdresse, supprimerAdresse }
  from "../data/compte.js";
import * as commandes from "../data/commandes.js";
import { chronologie } from "./suivi.js";
import { marque } from "../ui/logo.js";

/* ==================================================================== */
/* Connexion / inscription                                              */
/* ==================================================================== */
export function connexion(hote) {
  if (etat.utilisateur) { aller("/compte", true); return; }

  let mode = "connexion";      /* connexion | inscription | oubli */
  const conteneur = h("div");

  function dessiner() {
    const email = h("input.input", { type: "email", autocomplete: "email", required: true });
    const motDePasse = h("input.input", {
      type: "password", autocomplete: mode === "inscription" ? "new-password" : "current-password"
    });
    const nom = h("input.input", { autocomplete: "name" });
    const bouton = h("button.btn.btn-primary.btn-block.btn-lg", { type: "submit" },
      t(mode === "inscription" ? "inscription" : mode === "oubli" ? "mot_de_passe_oublie" : "connexion"));

    const envoyer = async function (e) {
      e.preventDefault();
      if (!emailValide(email.value)) { notice(t("email_invalide"), true); return; }
      if (mode !== "oubli" && String(motDePasse.value).length < 6) {
        notice(t("mot_de_passe") + " · 6+", true); return;
      }
      bouton.disabled = true;
      try {
        if (mode === "oubli") {
          await auth.motDePasseOublie(email.value.trim(),
            location.origin + location.pathname + "#/compte");
          notice(t("lien_envoye"));
        } else if (mode === "inscription") {
          await auth.inscription(email.value.trim(), motDePasse.value,
            { full_name: nom.value.trim() });
          location.hash = "#/compte";
          location.reload();
        } else {
          await auth.connexion(email.value.trim(), motDePasse.value);
          location.hash = "#/compte";
          location.reload();
        }
      } catch (err) { notice(err.message || t("erreur"), true); }
      bouton.disabled = false;
    };

    const basculer = function (m) {
      return h("button.btn.btn-quiet", { type: "button", onclick: function () { mode = m; dessiner(); } },
        t(m === "inscription" ? "inscription" : "connexion"));
    };

    remplir(conteneur, h("form.card.card-pad", { onsubmit: envoyer, novalidate: true },
      h("div", { style: { display: "grid", placeItems: "center", marginBottom: "14px" } }, marque(48)),
      h("h1", { style: { textAlign: "center", fontSize: "27px" } },
        t(mode === "inscription" ? "inscription" : mode === "oubli" ? "mot_de_passe_oublie" : "connexion")),

      h("button.btn.btn-ghost.btn-block.btn-lg", {
        type: "button", style: { marginBottom: "16px" },
        onclick: function () { auth.connexionGoogle(location.origin + location.pathname + "#/compte"); }
      }, "🇬 " + t("avec_google")),

      h("div.row", { style: { gap: "12px", margin: "4px 0 16px" } },
        h("hr", { style: { flex: "1", border: 0, borderTop: "1px solid var(--line)" } }),
        h("span.faint", {}, t("ou")),
        h("hr", { style: { flex: "1", border: 0, borderTop: "1px solid var(--line)" } })),

      mode === "inscription" ? h("div.field", h("label", {}, t("nom_complet")), nom) : null,
      h("div.field", h("label", {}, t("email")), email),
      mode !== "oubli" ? h("div.field", h("label", {}, t("mot_de_passe")), motDePasse) : null,
      bouton,

      h("div.row", { style: { justifyContent: "center", marginTop: "12px", flexWrap: "wrap" } },
        mode === "connexion"
          ? [h("span.faint", {}, t("pas_de_compte")), basculer("inscription")]
          : [h("span.faint", {}, t("deja_compte")), basculer("connexion")]),
      mode === "connexion"
        ? h("div", { style: { textAlign: "center" } },
            h("button.btn.btn-quiet", { type: "button",
              onclick: function () { mode = "oubli"; dessiner(); } }, t("mot_de_passe_oublie")))
        : null));
  }

  dessiner();
  remplir(hote, h("div.wrap.section", h("div", { style: { maxWidth: "440px", margin: "0 auto" } }, conteneur)));
}

/* ==================================================================== */
/* Onglets de l'espace client                                           */
/* ==================================================================== */
function onglets(actif) {
  const items = [["/compte", t("mon_profil")], ["/compte/commandes", t("mes_commandes")],
                 ["/compte/adresses", t("mes_adresses")], ["/favoris", t("mes_favoris")]];
  return h("div.row", { style: { gap: "8px", flexWrap: "wrap", marginBottom: "22px" } },
    items.map(function (i) {
      return h("a.chip", { href: lien(i[0]), "aria-pressed": i[0] === actif ? "true" : "false" }, i[1]);
    }));
}

/* --- profil ---------------------------------------------------------- */
function vueProfil() {
  const u = etat.utilisateur;
  const nom = h("input.input", { value: u.nom || "", autocomplete: "name" });
  const tel = h("input.input", { type: "tel", value: u.telephone || "", autocomplete: "tel" });
  const lang = h("select.select", {}, LANGUES.map(function (l) {
    return h("option", { value: l, selected: (u.langue || langue()) === l }, NOMS_LANGUE[l]);
  }));
  const bouton = h("button.btn.btn-primary", { type: "submit" }, t("enregistrer"));

  return h("form.card.card-pad", {
    style: { maxWidth: "560px" }, novalidate: true,
    onsubmit: async function (e) {
      e.preventDefault();
      if (tel.value && !telephoneValide(tel.value)) { notice(t("tel_invalide"), true); return; }
      bouton.disabled = true;
      try {
        await majProfil({ nom: nom.value.trim() || null, telephone: tel.value.trim() || null,
                          langue: lang.value });
        if (lang.value !== langue()) definirLangue(lang.value);
        notice(t("enregistrer") + " ✓");
      } catch (err) { notice(err.message || t("erreur"), true); }
      bouton.disabled = false;
    }
  },
    h("h3", {}, t("mon_profil")),
    h("div.field", h("label", {}, t("email")),
      h("input.input", { value: u.email, disabled: true })),
    h("div.field", h("label", {}, t("nom_complet")), nom),
    h("div.field", h("label", {}, t("telephone")), tel),
    h("div.field", h("label", {}, t("langue")), lang),
    h("div.row", { style: { gap: "10px", marginTop: "8px" } },
      bouton,
      h("button.btn.btn-danger", { type: "button", onclick: function () {
        deconnexion().then(function () { aller("/"); location.reload(); });
      } }, t("deconnexion"))));
}

/* --- commandes -------------------------------------------------------- */
function vueCommandes() {
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));

  commandes.mesCommandes().then(function (liste) {
    if (!liste.length) {
      remplir(zone, h("div.vide-etat",
        h("div.em", {}, "📦"), h("h3", {}, t("aucune_commande")),
        h("a.btn.btn-primary", { href: lien("/produits"), style: { marginTop: "12px" } },
          t("nos_produits"))));
      return;
    }
    remplir(zone, h("div", { style: { display: "grid", gap: "14px" } }, liste.map(function (c) {
      const detail = h("div", { hidden: true });
      let charge = false;
      return h("div.card.card-pad",
        h("div.row", { style: { justifyContent: "space-between", gap: "12px", flexWrap: "wrap" } },
          h("div",
            h("strong", {}, c.numero),
            h("div.faint", {}, dateHeure(c.cree_le) + " · " + c.ville)),
          h("div.row", { style: { gap: "10px" } },
            h("span.badge" + (c.statut === "livree" ? ".badge-ok" : ""), {}, t("st_" + c.statut)),
            h("strong", {}, prix(c.total)))),
        h("div.row", { style: { gap: "8px", marginTop: "10px", flexWrap: "wrap" } },
          (c.lignes || []).slice(0, 6).map(function (l) {
            return l.image_url
              ? image(l.image_url, "", "vis")
              : h("span.badge", {}, L(l.nom));
          })),
        h("button.btn.btn-quiet.btn-sm", {
          type: "button", style: { marginTop: "10px" },
          onclick: async function () {
            detail.hidden = !detail.hidden;
            if (charge || detail.hidden) return;
            charge = true;
            try {
              const d = await commandes.maCommande(c.numero);
              remplir(detail, h("div", { style: { marginTop: "14px" } },
                chronologie(d.statut, d.suivi),
                h("div.totaux", { style: { marginTop: "12px" } },
                  h("div.t", {}, h("span", {}, t("sous_total")), h("span", {}, prix(d.sous_total))),
                  h("div.t", {}, h("span", {}, t("livraison")),
                    h("span", {}, Number(d.frais_livraison) > 0
                      ? prix(d.frais_livraison) : t("livraison_offerte"))),
                  h("div.t.grand", {}, h("span", {}, t("total")), h("span", {}, prix(d.total))))));
            } catch (e) { remplir(detail, h("p.faint", {}, t("erreur_reseau"))); }
          }
        }, t("suivi")),
        detail);
    })));
  }).catch(function (e) {
    remplir(zone, h("p.faint", {}, e.message || t("erreur_reseau")));
  });

  return zone;
}

/* --- adresses ---------------------------------------------------------- */
function vueAdresses() {
  const zone = h("div", {}, h("p.faint", {}, t("chargement")));

  const formulaire = function (a, surFin) {
    a = a || {};
    const champs = {};
    const mk = function (cle, libelle, opts) {
      opts = opts || {};
      const el = opts.zone ? h("textarea.textarea", { rows: 2 })
                           : h("input.input", { type: opts.type || "text" });
      el.value = a[cle] || "";
      champs[cle] = el;
      return h("div.field", h("label", {}, libelle + (opts.requis ? " *" : "")), el);
    };
    const defaut = h("input", { type: "checkbox", checked: !!a.par_defaut,
                                style: { accentColor: "var(--accent)" } });
    const bouton = h("button.btn.btn-primary", { type: "submit" }, t("enregistrer"));

    return h("form.card.card-pad", {
      style: { marginBottom: "14px" }, novalidate: true,
      onsubmit: async function (e) {
        e.preventDefault();
        const v = {};
        Object.keys(champs).forEach(function (k) { v[k] = champs[k].value.trim(); });
        if (!v.nom_complet || !v.telephone || !v.ville || !v.adresse) {
          notice(t("champ_requis"), true); return;
        }
        if (!telephoneValide(v.telephone)) { notice(t("tel_invalide"), true); return; }
        bouton.disabled = true;
        try {
          await enregistrerAdresse(Object.assign({ id: a.id, par_defaut: defaut.checked }, v));
          notice(t("enregistrer") + " ✓");
          surFin();
        } catch (err) { notice(err.message || t("erreur"), true); bouton.disabled = false; }
      }
    },
      h("h3", {}, a.id ? t("modifier") : t("ajouter_adresse")),
      h("div.grid-2", mk("nom_complet", t("nom_complet"), { requis: true }),
                      mk("telephone", t("telephone"), { requis: true, type: "tel" })),
      h("div.grid-2", mk("ville", t("ville"), { requis: true }), mk("quartier", t("quartier"))),
      mk("adresse", t("adresse"), { requis: true, zone: true }),
      mk("instructions", t("instructions"), { zone: true }),
      h("label.row", { style: { gap: "9px", margin: "4px 0 14px", cursor: "pointer" } },
        defaut, t("adresse_defaut")),
      h("div.row", { style: { gap: "10px" } }, bouton,
        h("button.btn.btn-ghost", { type: "button", onclick: surFin }, t("annuler"))));
  };

  const recharger = function () {
    mesAdresses().then(function (liste) {
      const zoneForm = h("div");
      const boutonAjout = h("button.btn.btn-primary", {
        type: "button",
        onclick: function () { remplir(zoneForm, formulaire(null, recharger)); }
      }, "+ " + t("ajouter_adresse"));

      remplir(zone, zoneForm, boutonAjout,
        h("div", { style: { display: "grid", gap: "12px", marginTop: "16px" } },
          liste.map(function (a) {
            return h("div.card.card-pad",
              h("div.row", { style: { justifyContent: "space-between", gap: "10px", flexWrap: "wrap" } },
                h("div",
                  h("strong", {}, a.nom_complet),
                  a.par_defaut ? h("span.badge.badge-ok", { style: { marginInlineStart: "8px" } },
                    "★ " + t("adresse_defaut")) : null,
                  h("div.faint", {}, a.telephone),
                  h("div", { style: { marginTop: "4px", fontSize: "14px" } },
                    [a.adresse, a.quartier, a.ville].filter(Boolean).join(" · "))),
                h("div.row", { style: { gap: "6px" } },
                  h("button.btn.btn-quiet.btn-sm", { type: "button",
                    onclick: function () { remplir(zoneForm, formulaire(a, recharger));
                                           window.scrollTo(0, 0); } }, t("modifier")),
                  h("button.btn.btn-quiet.btn-sm", { type: "button",
                    onclick: async function () {
                      try { await supprimerAdresse(a.id); recharger(); }
                      catch (e) { notice(t("erreur"), true); }
                    } }, t("supprimer")))));
          })));
    }).catch(function (e) { remplir(zone, h("p.faint", {}, e.message || t("erreur_reseau"))); });
  };

  recharger();
  return zone;
}

/* ==================================================================== */
export default function compte(hote, params, chemin) {
  if (!etat.utilisateur) { aller("/connexion", true); return; }

  const sous = chemin === "/compte/commandes" ? "commandes"
             : chemin === "/compte/adresses"  ? "adresses" : "profil";

  remplir(hote, h("div.wrap.section",
    h("h1", {}, t("bonjour") + (etat.utilisateur.nom ? ", " + etat.utilisateur.nom : "")),
    onglets(chemin),
    sous === "commandes" ? vueCommandes()
      : sous === "adresses" ? vueAdresses()
      : vueProfil()));
}
