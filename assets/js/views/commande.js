/* =====================================================================
   Passage de commande.
   Le formulaire calcule un aperçu ; le montant qui fait foi est celui
   que renvoie boutique.creer_commande() après relecture des prix.
   ===================================================================== */

import { h, remplir, notice, vider } from "../core/dom.js";
import { t, L } from "../i18n/index.js";
import { prix, emailValide, telephoneValide, normaliserTelephone, delai } from "../core/format.js";
import { lien, aller } from "../core/routeur.js";
import { etat } from "../core/etat.js";
import * as panier from "../data/panier.js";
import * as catalogue from "../data/catalogue.js";
import * as commandes from "../data/commandes.js";
import { mesAdresses } from "../data/compte.js";

export default async function commande(hote) {
  if (!etat.panier.length) { aller("/panier", true); return; }

  const u = etat.utilisateur;
  const valeurs = {
    nom_complet: (u && u.nom) || "",
    telephone:   (u && u.telephone) || "",
    email:       (u && u.email) || "",
    ville: "", quartier: "", adresse: "", instructions: "",
    mode_paiement: "cod", code_promo: ""
  };
  let promo = null;   /* { code, remise, livraison_offerte } */

  /* --- champs ----------------------------------------------------- */
  const champ = function (cle, libelle, options) {
    options = options || {};
    const el = options.zone
      ? h("textarea.textarea", { rows: 2 })
      : h("input.input", { type: options.type || "text", inputmode: options.inputmode || null,
                           autocomplete: options.autocomplete || null });
    el.value = valeurs[cle] || "";
    el.addEventListener("input", function () {
      valeurs[cle] = el.value;
      el.removeAttribute("aria-invalid");
      erreurs[cle] = null;
      majErreur(cle);
    });
    champs[cle] = el;
    const err = h("div.err", { hidden: true });
    erreursEl[cle] = err;
    return h("div.field" + (options.classe ? "." + options.classe : ""),
      h("label", {}, libelle + (options.requis ? " *" : "")), el, err);
  };

  const champs = {}, erreurs = {}, erreursEl = {};
  const majErreur = function (cle) {
    const e = erreursEl[cle];
    if (!e) return;
    e.textContent = erreurs[cle] || "";
    e.hidden = !erreurs[cle];
    if (champs[cle]) champs[cle].setAttribute("aria-invalid", erreurs[cle] ? "true" : "false");
  };

  /* --- ville : la zone fixe le tarif et le délai -------------------- */
  const selectVille = h("select.select", {
    onchange: function () { valeurs.ville = selectVille.value; majTotaux(); }
  },
    h("option", { value: "" }, t("choisir_ville")),
    etat.zones.filter(function (z) { return z.ville !== "*"; }).map(function (z) {
      return h("option", { value: z.ville }, L(z.nom));
    }),
    etat.zones.some(function (z) { return z.ville === "*"; })
      ? h("option", { value: "__autre" }, L(etat.zones.find(function (z) { return z.ville === "*"; }).nom))
      : null);

  const villeLibre = h("input.input", {
    placeholder: t("ville"), hidden: true,
    oninput: function () { valeurs.ville = villeLibre.value; majTotaux(); }
  });
  selectVille.addEventListener("change", function () {
    const autre = selectVille.value === "__autre";
    villeLibre.hidden = !autre;
    if (autre) { valeurs.ville = villeLibre.value; villeLibre.focus(); }
  });

  /* --- adresses enregistrées --------------------------------------- */
  const zoneAdresses = h("div");
  if (u) {
    mesAdresses().then(function (liste) {
      if (!liste.length) return;
      remplir(zoneAdresses, h("div.field",
        h("label", {}, t("mes_adresses")),
        h("div.row", { style: { flexWrap: "wrap", gap: "8px" } }, liste.map(function (a) {
          return h("button.chip", {
            type: "button",
            onclick: function () {
              valeurs.nom_complet = a.nom_complet; champs.nom_complet.value = a.nom_complet;
              valeurs.telephone = a.telephone;     champs.telephone.value = a.telephone;
              valeurs.quartier = a.quartier || ""; champs.quartier.value = a.quartier || "";
              valeurs.adresse = a.adresse;         champs.adresse.value = a.adresse;
              valeurs.instructions = a.instructions || "";
              champs.instructions.value = a.instructions || "";
              const dansListe = Array.prototype.some.call(selectVille.options, function (o) {
                return o.value === a.ville;
              });
              selectVille.value = dansListe ? a.ville : "__autre";
              villeLibre.hidden = dansListe;
              if (!dansListe) villeLibre.value = a.ville;
              valeurs.ville = a.ville;
              majTotaux();
            }
          }, (a.par_defaut ? "★ " : "") + a.ville + " · " + a.adresse.slice(0, 28));
        }))));
    }).catch(function () { /* pas d'adresse à proposer */ });
  }

  /* --- code promo --------------------------------------------------- */
  const champPromo = h("input.input", { placeholder: t("code_promo"), autocapitalize: "characters" });
  const messagePromo = h("div.hint");
  const boutonPromo = h("button.btn.btn-ghost", { type: "button" }, t("appliquer"));
  boutonPromo.addEventListener("click", async function () {
    const code = champPromo.value.trim();
    if (!code) return;
    boutonPromo.disabled = true;
    try {
      const r = await commandes.verifierCode(code, panier.sousTotal());
      if (r && r.ok) {
        promo = r;
        valeurs.code_promo = r.code;
        messagePromo.textContent = "✓ " + t("code_applique");
        messagePromo.style.color = "var(--ok)";
      } else {
        promo = null; valeurs.code_promo = "";
        const raisons = { expire: "code_expire", pas_encore: "code_invalide",
                          epuise: "code_invalide", introuvable: "code_invalide",
                          minimum: "code_minimum" };
        const cle = raisons[r && r.raison] || "code_invalide";
        messagePromo.textContent = t(cle) +
          (r && r.minimum ? " " + prix(r.minimum) : "");
        messagePromo.style.color = "var(--danger)";
      }
    } catch (e) {
      promo = null;
      messagePromo.textContent = t("erreur_reseau");
      messagePromo.style.color = "var(--danger)";
    }
    boutonPromo.disabled = false;
    majTotaux();
  });

  /* --- récapitulatif ------------------------------------------------ */
  const zoneTotaux = h("div.totaux");
  const zoneDelai  = h("div.faint");

  function majTotaux() {
    const st = panier.sousTotal();
    const zone = valeurs.ville ? catalogue.zoneParVille(valeurs.ville) : null;
    let frais = 0;
    if (zone) {
      frais = (zone.gratuit_des != null && st >= Number(zone.gratuit_des)) ? 0 : Number(zone.tarif);
    }
    if (promo && promo.livraison_offerte) frais = 0;
    const remise = promo && !promo.livraison_offerte ? Number(promo.remise) : 0;
    const total = Math.max(0, st + frais - remise);

    remplir(zoneTotaux,
      h("div.t", {}, h("span", {}, t("sous_total")), h("span", {}, prix(st))),
      h("div.t", {}, h("span", {}, t("livraison")),
        h("span", {}, zone ? (frais ? prix(frais) : t("livraison_offerte")) : t("calcule_ensuite"))),
      remise ? h("div.t", { style: { color: "var(--ok)" } },
        h("span", {}, t("remise") + (promo ? " · " + promo.code : "")),
        h("span", {}, "−" + prix(remise))) : null,
      h("div.t.grand", {}, h("span", {}, t("total")), h("span", {}, prix(total))));

    zoneDelai.textContent = zone
      ? t("delai_estime") + " : " + delai(zone.delai_min, zone.delai_max) : "";
  }

  /* --- validation et envoi ------------------------------------------ */
  /* Le bouton vit dans le récapitulatif, à côté du formulaire et non dedans.
     L'attribut `form` le rattache explicitement ; sans lui, `type="submit"`
     ne déclenche rien du tout. */
  const boutonValider = h("button.btn.btn-primary.btn-block.btn-lg", {
    type: "submit", form: "form-commande"
  }, t("valider_commande"));

  function valider() {
    let ok = true;
    ["nom_complet", "telephone", "adresse"].forEach(function (c) {
      erreurs[c] = valeurs[c] && valeurs[c].trim() ? null : t("champ_requis");
      if (erreurs[c]) ok = false;
      majErreur(c);
    });
    if (!erreurs.telephone && !telephoneValide(valeurs.telephone)) {
      erreurs.telephone = t("tel_invalide"); majErreur("telephone"); ok = false;
    }
    if (valeurs.email && !emailValide(valeurs.email)) {
      erreurs.email = t("email_invalide"); majErreur("email"); ok = false;
    }
    if (!valeurs.ville || !valeurs.ville.trim()) {
      notice(t("choisir_ville"), true); ok = false;
    }
    return ok;
  }

  const formulaire = h("form#form-commande", {
    novalidate: true,
    onsubmit: async function (e) {
      e.preventDefault();
      if (!valider()) return;
      boutonValider.disabled = true;
      boutonValider.textContent = t("chargement");
      try {
        const res = await commandes.creer(Object.assign({}, valeurs, {
          telephone: normaliserTelephone(valeurs.telephone)
        }));
        aller("/merci/" + encodeURIComponent(res.numero));
      } catch (err) {
        const connus = {
          panier_vide: "panier_vide", stock_insuffisant: "stock_insuffisant",
          produit_indisponible: "rupture", format_indisponible: "rupture",
          coordonnees_incompletes: "champ_requis"
        };
        const cle = Object.keys(connus).find(function (k) {
          return String(err.message || "").indexOf(k) >= 0;
        });
        notice(cle ? t(connus[cle]) : (err.message || t("erreur")), true);
        boutonValider.disabled = false;
        boutonValider.textContent = t("valider_commande");
      }
    }
  },
    h("div.card.card-pad",
      h("h3", {}, t("coordonnees")),
      zoneAdresses,
      h("div.grid-2",
        champ("nom_complet", t("nom_complet"), { requis: true, autocomplete: "name" }),
        champ("telephone", t("telephone"), { requis: true, type: "tel", autocomplete: "tel" })),
      champ("email", t("email"), { type: "email", autocomplete: "email" }),
      h("div.grid-2",
        h("div.field", h("label", {}, t("ville") + " *"), selectVille, villeLibre),
        champ("quartier", t("quartier"))),
      champ("adresse", t("adresse"), { requis: true, zone: true }),
      champ("instructions", t("instructions"), { zone: true })),

    h("div.card.card-pad", { style: { marginTop: "18px" } },
      h("h3", {}, t("mode_paiement")),
      [["cod", t("cod"), t("cod_d"), "💵"], ["virement", t("virement"), t("virement_d"), "🏦"]]
        .map(function (m) {
          return h("label.card", {
            style: { display: "flex", gap: "12px", alignItems: "flex-start", padding: "14px",
                     marginBottom: "10px", cursor: "pointer" }
          },
            h("input", { type: "radio", name: "paiement", value: m[0],
                         checked: valeurs.mode_paiement === m[0],
                         style: { marginTop: "4px", accentColor: "var(--accent)" },
                         onchange: function () { valeurs.mode_paiement = m[0]; } }),
            h("span", { style: { fontSize: "20px" } }, m[3]),
            h("span", {}, h("div", { style: { fontWeight: "500" } }, m[1]),
              h("div.faint", {}, m[2])));
        })));

  const recap = h("aside.card.card-pad", { style: { alignSelf: "start", position: "sticky", top: "86px" } },
    h("h3", {}, t("recapitulatif")),
    h("div", { style: { display: "grid", gap: "8px", marginBottom: "14px" } },
      etat.panier.map(function (l) {
        return h("div.row", { style: { gap: "10px", fontSize: "13.5px" } },
          h("span.grow", {}, L(l.nom) + (l.variante_nom ? " · " + L(l.variante_nom) : "") +
            "  ×" + l.quantite),
          h("span", { style: { fontVariantNumeric: "tabular-nums" } }, prix(l.prix * l.quantite)));
      })),
    h("div.field", { style: { marginTop: "4px" } },
      h("label", {}, t("code_promo")),
      h("div.row", { style: { gap: "8px" } }, champPromo, boutonPromo),
      messagePromo),
    zoneTotaux,
    zoneDelai,
    h("div", { style: { marginTop: "16px" } }, boutonValider));

  remplir(hote, h("div.wrap.section",
    h("h1", {}, t("commande")),
    h("div", {
      style: {
        display: "grid", gap: "24px",
        gridTemplateColumns: window.innerWidth >= 900 ? "1fr 360px" : "1fr"
      }
    }, formulaire, recap)));

  majTotaux();
  window.scrollTo(0, 0);
}
