/* =====================================================================
   Briques partagées du back-office : champ trilingue, panneau latéral,
   table, confirmation.
   ===================================================================== */

import { h, vider, remplir, notice, piegerFocus } from "../core/dom.js";
import { t, LANGUES, ETIQUETTES } from "../i18n/index.js";

/** Trois champs alignés pour un libellé {"ar":…,"fr":…,"en":…}. */
export function trilingue(valeur, options) {
  options = options || {};
  valeur = valeur && typeof valeur === "object" ? valeur : {};
  const champs = {};
  const bloc = h("div.tril");

  LANGUES.forEach(function (l) {
    const el = options.zone
      ? h("textarea.textarea", { rows: options.rows || 3, dir: l === "ar" ? "rtl" : "ltr" })
      : h("input.input", { dir: l === "ar" ? "rtl" : "ltr" });
    el.value = valeur[l] || "";
    champs[l] = el;
    bloc.appendChild(h("div.rangee", h("span.lg", {}, ETIQUETTES[l]), el));
  });

  return {
    element: h("div.field", options.libelle
      ? h("label", {}, options.libelle + (options.requis ? " *" : "")) : null, bloc),
    valeur: function () {
      const v = {};
      LANGUES.forEach(function (l) { if (champs[l].value.trim()) v[l] = champs[l].value.trim(); });
      return v;
    },
    valide: function () { return !options.requis || !!champs.fr.value.trim(); },
    focus: function () { champs.fr.focus(); }
  };
}

/** Champ simple, avec accès à sa valeur. */
export function champ(libelle, valeur, options) {
  options = options || {};
  const el = options.zone
    ? h("textarea.textarea", { rows: options.rows || 3 })
    : options.choix
      ? h("select.select", {}, options.choix.map(function (c) {
          return h("option", { value: c[0], selected: String(valeur) === String(c[0]) }, c[1]);
        }))
      : h("input.input", {
          type: options.type || "text",
          step: options.step || null, min: options.min || null,
          placeholder: options.placeholder || null
        });
  if (!options.choix) el.value = valeur === null || valeur === undefined ? "" : String(valeur);

  return {
    element: h("div.field", h("label", {}, libelle + (options.requis ? " *" : "")), el,
      options.aide ? h("div.hint", {}, options.aide) : null),
    entree: el,
    valeur: function () {
      const v = el.value.trim();
      if (options.type === "number") return v === "" ? null : Number(v);
      return v || null;
    }
  };
}

export function interrupteur(libelle, actif) {
  const el = h("input", { type: "checkbox", checked: !!actif,
                          style: { width: "18px", height: "18px", accentColor: "var(--accent)" } });
  return {
    element: h("label.row", { style: { gap: "10px", padding: "8px 0", cursor: "pointer" } },
      el, h("span", {}, libelle)),
    valeur: function () { return el.checked; }
  };
}

/* ------------------------------------------------------------------ */
/* Panneau latéral d'édition                                           */
/* ------------------------------------------------------------------ */
let panneauOuvert = null;

export function panneau(titre, corps, actions) {
  fermerPanneau();

  const voile = h("div.voile.on", { onclick: fermerPanneau });
  const el = h("aside.panneau", { role: "dialog", "aria-modal": "true", "aria-label": titre },
    h("div.panneau-tete",
      h("strong.grow", {}, titre),
      h("button.icon-btn", { type: "button", "aria-label": t("fermer"), onclick: fermerPanneau }, "✕")),
    h("div.panneau-corps", corps),
    h("div.panneau-pied", {}, actions));

  document.body.appendChild(voile);
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(function () { el.classList.add("on"); });
  const liberer = piegerFocus(el);
  panneauOuvert = { voile: voile, el: el, liberer: liberer };
  return el;
}

export function fermerPanneau() {
  if (!panneauOuvert) return;
  const p = panneauOuvert;
  panneauOuvert = null;
  p.liberer();
  p.el.classList.remove("on");
  p.voile.classList.remove("on");
  document.body.style.overflow = "";
  setTimeout(function () { p.el.remove(); p.voile.remove(); }, 420);
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") fermerPanneau();
});

/* ------------------------------------------------------------------ */
export function confirmer(message) {
  return new Promise(function (resolution) {
    const boite = h("div.card.card-pad", { style: { maxWidth: "420px" } },
      h("p", { style: { marginTop: 0 } }, message),
      h("div.row", { style: { justifyContent: "flex-end", gap: "10px" } },
        h("button.btn.btn-ghost", { type: "button", onclick: function () { fin(false); } }, t("annuler")),
        h("button.btn.btn-danger", { type: "button", onclick: function () { fin(true); } }, t("confirmer"))));

    const modale = h("div.modale.on", { role: "dialog", "aria-modal": "true" },
      h("div.boite", {}, boite));
    const voile = h("div.voile.on", { onclick: function () { fin(false); } });

    function fin(v) { modale.remove(); voile.remove(); resolution(v); }
    document.body.appendChild(voile);
    document.body.appendChild(modale);
  });
}

/* ------------------------------------------------------------------ */
export function table(colonnes, lignes, rendre) {
  const corps = h("tbody");
  lignes.forEach(function (l) { corps.appendChild(rendre(l)); });
  return h("div.tablewrap",
    h("table.t",
      h("thead", h("tr", {}, colonnes.map(function (c) {
        return h("th", c && c.num ? { class: "num" } : {}, c && c.titre !== undefined ? c.titre : c);
      }))),
      corps));
}

export function vide(message) {
  return h("div.vide-etat", h("div.em", {}, "∅"), h("h3", {}, message));
}

export { notice };
