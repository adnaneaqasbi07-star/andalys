/* =====================================================================
   L'écran de connexion, partagé par le back-office et l'atelier.
   ---------------------------------------------------------------------
   Ce qu'il affiche n'est qu'une politesse : la vraie serrure est dans
   Postgres. Un compte qui n'est pas administrateur voit une interface
   vide, la base refusant toutes ses lectures comme toutes ses écritures
   (boutique.est_admin()).
   ===================================================================== */

import { h, remplir, notice } from "../core/dom.js";
import { t } from "../i18n/index.js";
import { auth } from "../data/compte.js";
import { marque } from "./logo.js";


/* ------------------------------------------------------------------ */
/* Le piège de « localhost »                                           */
/* ------------------------------------------------------------------ */
/* Pour Supabase, `localhost` et `127.0.0.1` sont deux adresses
   différentes, et seule la seconde est dans la liste des URL de retour
   autorisées. Depuis `localhost`, la connexion Google part donc — et
   revient sur le site des recettes, qui partage le même projet. Rien
   dans l'écran ne le laissait deviner ; il a fallu interroger l'API pour
   le découvrir. Une ligne suffit à épargner la prochaine enquête.

   Ne s'affiche qu'en développement local : en production, cette fonction
   ne rend rien du tout. */
function avertissementLocalhost() {
  if (location.hostname !== "localhost") return null;
  const equivalent = location.href.replace("//localhost", "//127.0.0.1");
  return h("p.faint", { style: { fontSize: "12.5px", lineHeight: "1.5", marginBottom: "14px" } },
    "La connexion Google ne revient pas sur « localhost » : cette adresse n'est pas " +
    "dans la liste autorisée du projet Supabase. Ouvrez plutôt ",
    h("a", { href: equivalent }, "127.0.0.1"),
    " — même machine, même serveur.");
}

/**
 * @param {Element} hote       le conteneur de la page (#adm, #atl…)
 * @param {string}  sousTitre  « Back-office », « Atelier »…
 * @param {string}  [message]  la raison du refus, s'il y en a une
 */
export function portail(hote, sousTitre, message) {
  const email = h("input.input", { type: "email", autocomplete: "email" });
  const mdp = h("input.input", { type: "password", autocomplete: "current-password" });
  const bouton = h("button.btn.btn-primary.btn-block.btn-lg", { type: "submit" }, t("connexion"));

  remplir(hote, h("div", {
    style: { minHeight: "100vh", display: "grid", placeItems: "center", padding: "20px" }
  },
    h("form.card.card-pad", {
      style: { width: "min(400px,100%)" }, novalidate: true,
      onsubmit: async function (e) {
        e.preventDefault();
        bouton.disabled = true;
        try {
          await auth.connexion(email.value.trim(), mdp.value);
          location.reload();
        } catch (err) { notice(err.message || t("erreur"), true); bouton.disabled = false; }
      }
    },
      h("div", { style: { display: "grid", placeItems: "center", marginBottom: "14px" } }, marque(48)),
      h("h1", { style: { textAlign: "center", fontSize: "23px" } }, sousTitre),
      message ? h("p", { style: { textAlign: "center", color: "var(--danger)" } }, message) : null,
      h("button.btn.btn-ghost.btn-block", {
        type: "button", style: { marginBottom: "14px" },
        onclick: function () { auth.connexionGoogle(location.origin + location.pathname); }
      }, "🇬 " + t("avec_google")),
      avertissementLocalhost(),
      h("div.field", h("label", {}, t("email")), email),
      h("div.field", h("label", {}, t("mot_de_passe")), mdp),
      bouton)));
}
