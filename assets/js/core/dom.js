/* =====================================================================
   Fabrique d'éléments et petits utilitaires de rendu.
   Tout passe par textContent ou par des nœuds : aucune concaténation de
   HTML avec des données venues de la base ou de la barre d'adresse.
   ===================================================================== */

/**
 * h("div.card", { onclick: f }, enfant, enfant…)
 * Le sélecteur accepte tag, .classes et #identifiant.
 */
export function h(selecteur, attrs) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(selecteur || "div");
  const el = document.createElement((m && m[1]) || "div");
  if (m && m[2]) {
    m[2].split(/(?=[.#])/).forEach(function (p) {
      if (p[0] === ".") el.classList.add(p.slice(1));
      else if (p[0] === "#") el.id = p.slice(1);
    });
  }
  let debut = 2;
  if (attrs && typeof attrs === "object" && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    Object.entries(attrs).forEach(function (e) {
      const k = e[0], v = e[1];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "html") el.innerHTML = v;               /* réservé aux gabarits internes */
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k in el && k !== "list" && typeof v !== "object") {
        /* certaines propriétés sont en lecture seule (button.form, par
           exemple) : l'affectation directe échoue, l'attribut fonctionne. */
        try { el[k] = v; } catch (e) { el.setAttribute(k, v === true ? "" : v); }
      }
      else el.setAttribute(k, v === true ? "" : v);
    });
  } else { debut = 1; }

  for (let i = debut; i < arguments.length; i++) ajouter(el, arguments[i]);
  return el;
}

function ajouter(parent, enfant) {
  if (enfant === null || enfant === undefined || enfant === false || enfant === true) return;
  if (Array.isArray(enfant)) { enfant.forEach(function (e) { ajouter(parent, e); }); return; }
  parent.appendChild(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
}

export function vider(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

/** Vide un élément et le regarnit. Variadique, comme h() : remplir(el, a, b, c). */
export function remplir(el) {
  vider(el);
  for (let i = 1; i < arguments.length; i++) ajouter(el, arguments[i]);
  return el;
}

export const $  = function (s, r) { return (r || document).querySelector(s); };
export const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

/** Message éphémère en bas d'écran. */
let minuteur = null;
export function notice(texte, erreur) {
  let n = document.getElementById("notice");
  if (!n) {
    n = h("div.notice#notice", { role: "status", "aria-live": "polite" });
    document.body.appendChild(n);
  }
  n.textContent = texte;
  n.classList.toggle("err", !!erreur);
  requestAnimationFrame(function () { n.classList.add("on"); });
  clearTimeout(minuteur);
  minuteur = setTimeout(function () { n.classList.remove("on"); }, erreur ? 4200 : 2600);
}

/** Étoiles de notation. */
export function etoiles(note, taille) {
  const n = Math.round(Number(note) || 0);
  const el = h("span.stars", { "aria-label": n + "/5" });
  if (taille) el.style.fontSize = taille;
  for (let i = 1; i <= 5; i++) {
    el.appendChild(h("span" + (i <= n ? "" : ".off"), {}, "★"));
  }
  return el;
}

/** Charge une image seulement quand elle approche de l'écran. */
const observateur = "IntersectionObserver" in window
  ? new IntersectionObserver(function (entrees, obs) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        const img = e.target;
        if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
        obs.unobserve(img);
      });
    }, { rootMargin: "300px" })
  : null;

export function image(src, alt, classe) {
  const img = h("img" + (classe ? "." + classe : ""), {
    alt: alt || "", loading: "lazy", decoding: "async"
  });
  if (!src) { img.dataset.vide = "1"; return img; }
  if (observateur) { img.dataset.src = src; observateur.observe(img); }
  else { img.src = src; }
  return img;
}

/** Focus piégé dans un panneau ouvert (tiroir, modale). */
export function piegerFocus(panneau) {
  function surTab(e) {
    if (e.key !== "Tab") return;
    const cibles = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', panneau)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!cibles.length) return;
    const premier = cibles[0], dernier = cibles[cibles.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }
  panneau.addEventListener("keydown", surTab);
  return function () { panneau.removeEventListener("keydown", surTab); };
}
