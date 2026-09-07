/* =====================================================================
   Coque de la boutique : en-tête, recherche, navigation, tiroir du
   panier, pied de page et barre mobile. Construite une fois, mise à jour
   ensuite par événements.
   ===================================================================== */

import { h, $, remplir, vider, notice, image, piegerFocus } from "../core/dom.js";
import { t, L, LANGUES, ETIQUETTES, langue, definirLangue } from "../i18n/index.js";
import { prix, emojiType } from "../core/format.js";
import { lien, aller, routeCourante } from "../core/routeur.js";
import { etat, surEtat } from "../core/etat.js";
import { APP } from "../core/config.js";
import * as panier from "../data/panier.js";
import * as catalogue from "../data/catalogue.js";
import { deconnexion } from "../data/compte.js";
import { marque } from "./logo.js";

let elPanierCompte, elFavorisCompte, elTiroir, elVoile, elNav, elSuggest, elRecherche;

/* ------------------------------------------------------------------ */
/* Thème                                                               */
/* ------------------------------------------------------------------ */
export function appliquerTheme(mode) {
  const html = document.documentElement;
  if (mode === "auto") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", mode);
  try { localStorage.setItem(APP.cleTheme, mode); } catch (e) { /* privé */ }
}

export function themeMemorise() {
  try { return localStorage.getItem(APP.cleTheme) || "auto"; } catch (e) { return "auto"; }
}

function basculerTheme() {
  const suite = { auto: "light", light: "dark", dark: "auto" };
  const suivant = suite[themeMemorise()] || "light";
  appliquerTheme(suivant);
  notice({ auto: "🌓", light: "☀️", dark: "🌙" }[suivant] + " " + t("theme"));
}

/* ------------------------------------------------------------------ */
/* En-tête                                                             */
/* ------------------------------------------------------------------ */
function selecteurLangue() {
  const el = h("div.langsw", { role: "group", "aria-label": t("langue") });
  LANGUES.forEach(function (l) {
    el.appendChild(h("button", {
      type: "button",
      "aria-pressed": langue() === l ? "true" : "false",
      title: l,
      onclick: function () { definirLangue(l); }
    }, ETIQUETTES[l]));
  });
  return el;
}

function barreRecherche() {
  elSuggest = h("div.suggest", { hidden: true, role: "listbox" });

  elRecherche = h("input.input", {
    type: "search", autocomplete: "off",
    placeholder: t("recherche_aide"),
    "aria-label": t("rechercher")
  });

  let minuteur = null;
  elRecherche.addEventListener("input", function () {
    clearTimeout(minuteur);
    const q = elRecherche.value.trim();
    if (q.length < 2) { elSuggest.hidden = true; return; }
    minuteur = setTimeout(function () { proposer(q); }, 220);
  });

  elRecherche.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const q = elRecherche.value.trim();
      elSuggest.hidden = true;
      if (q) aller("/recherche?q=" + encodeURIComponent(q));
    } else if (e.key === "Escape") { elSuggest.hidden = true; }
  });

  document.addEventListener("click", function (e) {
    if (elSuggest && !elSuggest.hidden && !elSuggest.contains(e.target) && e.target !== elRecherche) {
      elSuggest.hidden = true;
    }
  });

  return h("div.searchbar",
    h("span.ico", { "aria-hidden": "true" }, "⌕"),
    elRecherche, elSuggest);
}

async function proposer(q) {
  let liste = [];
  try { liste = await catalogue.suggestions(q, 6); }
  catch (e) { elSuggest.hidden = true; return; }

  vider(elSuggest);
  if (!liste.length) {
    elSuggest.appendChild(h("div", { style: { padding: "14px", color: "var(--ink-faint)" } },
      t("aucun_resultat")));
  } else {
    liste.forEach(function (p) {
      elSuggest.appendChild(h("button", {
        type: "button", role: "option",
        onclick: function () { elSuggest.hidden = true; elRecherche.value = ""; aller("/p/" + p.slug); }
      },
        p.image ? image(p.image, "") : h("span", { style: { fontSize: "22px" } }, emojiType(p.type)),
        h("span.grow", {}, h("div.nm", {}, L(p.nom)), h("div.mt", {}, prix(p.prix)))));
    });
    elSuggest.appendChild(h("button", {
      type: "button", role: "option",
      onclick: function () { elSuggest.hidden = true; aller("/recherche?q=" + encodeURIComponent(q)); }
    }, h("span.grow", {}, h("div.nm", {}, t("voir_tout") + " · " + q))));
  }
  elSuggest.hidden = false;
}

function boutonCompte() {
  return h("button.icon-btn", {
    type: "button", title: t("compte"), "aria-label": t("compte"),
    onclick: function () { aller(etat.utilisateur ? "/compte" : "/connexion"); }
  }, etat.utilisateur ? "👤" : "🔑");
}

function entete() {
  elPanierCompte  = h("span.count", { hidden: true }, "0");
  elFavorisCompte = h("span.count", { hidden: true }, "0");

  const reglages = etat.parametres.livraison || {};
  const bandeau = h("div.topbar", {}, L(reglages.message) || t("assur_livraison") + " · " + t("assur_livraison_d"));

  const header = h("header.header",
    h("div.wrap",
      h("div.header-in",
        (function () {
          const b = etat.parametres.boutique || {};
          return h("a.brand", { href: lien("/"), "aria-label": L(b.nom) || "Andalys" },
            marque(30),
            h("span", {},
              h("div.nm", {}, (L(b.nom) || "Andalys").toUpperCase()),
              h("div.sub", {}, L(b.signature) || "Trésor de Fès")));
        })(),
        barreRecherche(),
        h("div.header-acts",
          selecteurLangue(),
          h("button.icon-btn", {
            type: "button", title: t("theme"), "aria-label": t("theme"), onclick: basculerTheme
          }, "◐"),
          h("button.icon-btn", {
            type: "button", title: t("favoris"), "aria-label": t("favoris"),
            onclick: function () { aller("/favoris"); }
          }, "♡", elFavorisCompte),
          boutonCompte(),
          h("button.icon-btn", {
            type: "button", title: t("panier"), "aria-label": t("panier"),
            onclick: ouvrirTiroir
          }, "🛍", elPanierCompte)))));

  elNav = h("nav.nav", { "aria-label": t("categories") }, h("div.wrap", h("div.nav-in")));

  return h("div", {}, bandeau, header, elNav);
}

/** Redessine la barre de catégories quand le référentiel arrive. */
export function majNavigation() {
  if (!elNav) return;
  const dans = $(".nav-in", elNav);
  vider(dans);
  const r = routeCourante();
  const actif = r && r.params ? r.params.slug : null;

  dans.appendChild(h("a", { href: lien("/produits"), "aria-current": r && r.chemin === "/produits" ? "page" : null },
    h("span", { "aria-hidden": "true" }, "✦"), t("nos_produits")));

  catalogue.racines().forEach(function (c) {
    dans.appendChild(h("a", {
      href: lien("/c/" + c.slug),
      "aria-current": actif === c.slug ? "page" : null
    }, h("span", { "aria-hidden": "true" }, c.icone || ""), L(c.nom)));
  });
}

/* ------------------------------------------------------------------ */
/* Tiroir du panier                                                    */
/* ------------------------------------------------------------------ */
function tiroir() {
  elVoile = h("div.voile", { onclick: fermerTiroir, "aria-hidden": "true" });
  elTiroir = h("aside.tiroir", {
    role: "dialog", "aria-modal": "true", "aria-label": t("mon_panier"), hidden: true
  });
  return h("div", {}, elVoile, elTiroir);
}

export function ouvrirTiroir() {
  elTiroir.hidden = false;
  dessinerTiroir();
  requestAnimationFrame(function () {
    elVoile.classList.add("on"); elTiroir.classList.add("on");
  });
  document.body.style.overflow = "hidden";
  const liberer = piegerFocus(elTiroir);
  elTiroir._liberer = liberer;
  const premier = elTiroir.querySelector("button");
  if (premier) premier.focus();
}

export function fermerTiroir() {
  if (!elTiroir) return;
  elVoile.classList.remove("on"); elTiroir.classList.remove("on");
  document.body.style.overflow = "";
  if (elTiroir._liberer) { elTiroir._liberer(); elTiroir._liberer = null; }
  setTimeout(function () { elTiroir.hidden = true; }, 420);
}

function ligneTiroir(l) {
  const majQte = function (d) {
    panier.definirQuantite(l.produit_id, l.variante_id, l.quantite + d);
  };
  return h("div.ligne",
    l.image ? image(l.image, L(l.nom), "vis")
            : h("div.vis", { style: { display: "grid", placeItems: "center", fontSize: "26px" } },
                emojiType(l.type)),
    h("div",
      h("a.nm", { href: lien("/p/" + l.slug), onclick: fermerTiroir }, L(l.nom)),
      l.variante_nom ? h("div.mt", {}, L(l.variante_nom)) : null,
      h("div.row", { style: { marginTop: "7px", gap: "8px" } },
        h("div.qte", { style: { transform: "scale(.82)", transformOrigin: "inline-start" } },
          h("button", { type: "button", "aria-label": "−", onclick: function () { majQte(-1); } }, "−"),
          h("input", { type: "text", inputmode: "numeric", value: l.quantite, readOnly: true,
                       "aria-label": t("quantite") }),
          h("button", { type: "button", "aria-label": "+", onclick: function () { majQte(1); } }, "+")),
        h("button.btn-quiet", {
          type: "button", style: { border: 0, background: "none", cursor: "pointer",
                                   color: "var(--ink-faint)", fontSize: "12.5px" },
          onclick: function () { panier.retirer(l.produit_id, l.variante_id); }
        }, t("supprimer")))),
    h("div.px", {}, prix(l.prix * l.quantite)));
}

function dessinerTiroir() {
  if (!elTiroir || elTiroir.hidden) return;
  vider(elTiroir);

  const tete = h("div.tiroir-tete",
    h("strong.grow", {}, t("mon_panier") + " · " + panier.nombreArticles()),
    h("button.icon-btn", { type: "button", "aria-label": t("fermer"), onclick: fermerTiroir }, "✕"));

  if (!etat.panier.length) {
    elTiroir.appendChild(tete);
    elTiroir.appendChild(h("div.tiroir-corps",
      h("div.vide-etat",
        h("div.em", {}, "🛍"),
        h("h3", {}, t("panier_vide")),
        h("p", {}, t("panier_vide_d")),
        h("button.btn.btn-primary", { type: "button", style: { marginTop: "14px" },
          onclick: function () { fermerTiroir(); aller("/produits"); } }, t("continuer_achats")))));
    return;
  }

  const st = panier.sousTotal();
  const seuil = Number((etat.parametres.livraison || {}).gratuite_des) || 0;
  const manque = seuil - st;

  elTiroir.appendChild(tete);
  elTiroir.appendChild(h("div.tiroir-corps", {},
    etat.panier.map(ligneTiroir),
    seuil && manque > 0
      ? h("div.card.card-pad", { style: { marginTop: "16px", background: "var(--gold-wash)", border: 0 } },
          h("div", { style: { fontSize: "13.5px" } },
            t("plus_que") + " " + prix(manque) + " " + t("pour_offerte")))
      : (seuil ? h("div.badge.badge-ok", { style: { marginTop: "16px" } }, "✓ " + t("livraison_offerte")) : null)
  ));

  elTiroir.appendChild(h("div.tiroir-pied",
    h("div.totaux",
      h("div.t", {}, h("span", {}, t("sous_total")), h("span", {}, prix(st))),
      h("div.t.faint", {}, h("span", {}, t("livraison")), h("span", {}, t("calcule_ensuite")))),
    h("button.btn.btn-primary.btn-block.btn-lg", {
      type: "button", style: { marginTop: "14px" },
      onclick: function () { fermerTiroir(); aller("/commande"); }
    }, t("passer_commande")),
    h("button.btn.btn-quiet.btn-block", {
      type: "button", style: { marginTop: "6px" }, onclick: fermerTiroir
    }, t("continuer_achats"))));
}

/* ------------------------------------------------------------------ */
/* Pied de page et barre mobile                                        */
/* ------------------------------------------------------------------ */
function pied() {
  const b = etat.parametres.boutique || {};
  const colonne = function (titre, liens) {
    return h("div", h("h4", {}, titre),
      h("ul", {}, liens.map(function (l) {
        return h("li", {}, h("a", { href: l[1] }, l[0]));
      })));
  };

  return h("footer.footer",
    h("div.wrap",
      h("div.footer-in",
        h("div",
          h("div.row", { style: { gap: "10px", marginBottom: "10px" } },
            marque(28),
            h("span", {},
              h("div.display", { style: { fontSize: "20px", letterSpacing: ".12em" } },
                (L(b.nom) || "Andalys").toUpperCase()),
              h("div.eyebrow", { style: { fontSize: "9.5px" } }, L(b.signature) || "Trésor de Fès"))),
          h("p.faint", { style: { maxWidth: "34ch" } }, L(b.baseline) || t("hero_lede"))),
        colonne(t("categories"), catalogue.racines().slice(0, 6).map(function (c) {
          return [L(c.nom), lien("/c/" + c.slug)];
        })),
        colonne(t("aide"), [
          [t("suivre_commande"), lien("/suivi")],
          [t("mes_commandes"),   lien("/compte/commandes")],
          [t("contact"),         lien("/page/contact")]
        ]),
        colonne(t("mentions"), [
          [t("conditions"),      lien("/page/conditions")],
          [t("confidentialite"), lien("/page/confidentialite")],
          [t("mentions"),        lien("/page/mentions")]
        ])),
      h("div.bas",
        h("span", {}, "© " + new Date().getFullYear() + " " + (L(b.nom) || "Andalys") +
          " · " + t("droits")),
        h("span", {}, t("assur_livraison") + " 🇲🇦"))));
}

function barreMobile() {
  const onglets = [
    ["🏠", t("accueil"),  "/"],
    ["✦",  t("boutique"), "/produits"],
    ["♡",  t("favoris"),  "/favoris"],
    ["🛍", t("panier"),   "/panier"],
    ["👤", t("compte"),   etat.utilisateur ? "/compte" : "/connexion"]
  ];
  const r = routeCourante();
  return h("nav.tabbar", { "aria-label": t("menu") },
    onglets.map(function (o) {
      return h("a", {
        href: lien(o[2]),
        "aria-current": r && r.chemin === o[2] ? "page" : null
      }, h("span.em", { "aria-hidden": "true" }, o[0]), h("span", {}, o[1]));
    }));
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */
export function construire() {
  const principal = h("main#principal", { tabindex: "-1" });
  const racine = $("#app");
  vider(racine);
  racine.appendChild(h("a.sr-only", { href: "#principal" }, t("accueil")));
  racine.appendChild(entete());
  racine.appendChild(principal);
  racine.appendChild(h("div#pied"));
  racine.appendChild(h("div#tabbar"));
  racine.appendChild(tiroir());

  majNavigation();
  majPied();
  majBarreMobile();
  majCompteurs();

  surEtat("panier", function () { majCompteurs(); dessinerTiroir(); });
  surEtat("favoris", majCompteurs);
  surEtat("catalogue", function () { majNavigation(); majPied(); });
  surEtat("auth", function () { majBarreMobile(); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && elTiroir && !elTiroir.hidden) fermerTiroir();
  });

  return principal;
}

export function majPied()        { remplir($("#pied"), pied()); }
export function majBarreMobile() { remplir($("#tabbar"), barreMobile()); }

export function majCompteurs() {
  const n = panier.nombreArticles();
  if (elPanierCompte) { elPanierCompte.textContent = n; elPanierCompte.hidden = !n; }
  const f = etat.favoris.size;
  if (elFavorisCompte) { elFavorisCompte.textContent = f; elFavorisCompte.hidden = !f; }
}

/** Redessine tout ce qui contient du texte après un changement de langue. */
export function retraduire() {
  const racine = $("#app");
  const defilement = window.scrollY;
  vider(racine);
  const principal = construire();
  window.scrollTo(0, defilement);
  return principal;
}
