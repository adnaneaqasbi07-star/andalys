/* =====================================================================
   La bannière en relief — Fès, la médina, et le zellige
   ---------------------------------------------------------------------
   Quatre plans posés à des profondeurs réelles sur l'axe Z, dans un
   espace en perspective :

     • la photographie de la médina, au fond ;
     • des voiles de nuages qui dérivent dans son ciel, 50 px devant ;
     • le voile qui garde le texte lisible, 50 px plus près ;
     • et devant tout, un réseau de zellige où court la lumière.

   Le navigateur calcule la perspective. La souris n'incline que le plan
   du réseau, de quelques degrés : la photographie reste immobile, comme
   il se doit, et c'est le zellige qui glisse devant elle. Le décalage est
   vrai — ce n'est pas une illusion peinte.

   Le réseau et son animation sont dans app.css (.reseau) ; ce module ne
   pose que la profondeur de chaque plan et le mouvement de la souris.

   Aucune bibliothèque. Une poignée d'éléments et deux transformations.
   ===================================================================== */

import { h } from "../core/dom.js";

/* Profondeur de chaque plan, et l'agrandissement qui va avec.

   Un plan reculé de |z| paraît plus petit du facteur PERSP / (PERSP + |z|).
   Pour qu'il remplisse encore le cadre, il faut l'agrandir de l'inverse.
   C'est pour cela que le facteur est calculé et non choisi : posé à la
   main, il laisserait un liseré vide sur un bord ou l'autre.

   L'agrandissement se fait en débordant le cadre (`inset` négatif), et
   non par `scale()`. La différence compte : un `scale()` grossirait aussi
   l'image de fond, si bien qu'on ne verrait plus qu'un détail de la vue
   de Fès. En débordant, la boîte est simplement plus grande et son
   `background-size: cover` s'y ajuste — la vue garde son cadrage. */
const PERSP = 900;

const PLANS = [
  { classe: "plan-fond", z: 300 },
  /* Les nuages passent entre la photo et le voile : ils se mêlent au ciel
     avant qu'on l'assombrisse, au lieu d'être peints par-dessus. */
  { classe: "nuages", z: 250, derives: 2 },
  { classe: "plan-voile", z: 200 },
  /* `incline` : seul ce plan suit la souris. La rotation était sur le
     monde entier, si bien que la photographie tanguait au passage du
     curseur — ce qui n'est pas un effet, c'est un défaut : le sol d'une
     image ne bouge pas. Le zellige, lui, est censé flotter devant elle,
     et c'est de son décalage seul que vient le relief. */
  { classe: "reseau", z: 120, etincelles: 4, incline: true }
];

function facteur(z) {
  /* un peu de marge : la rotation du monde découvrirait sinon les bords */
  return (PERSP + z) / PERSP * 1.06;
}

function debord(z) {
  /* un débord de x % de chaque côté agrandit la boîte de (1 + 2x/100) */
  return (-(facteur(z) - 1) / 2 * 100).toFixed(2) + "%";
}

/** Construit la scène. Renvoie l'élément et une fonction de démontage. */
export function scene() {
  const monde = h("div.scene-monde", { "aria-hidden": "true" });

  PLANS.forEach(function (p) {
    const enfants = [];
    if (p.etincelles) {
      /* le dégradé du zellige, puis les lumières qui y courent */
      const flux = h("div.flux");
      for (let i = 0; i < p.etincelles; i++) flux.appendChild(h("i"));
      /* Le balai : une barre de lumière douce qui traverse le cadre de
         loin en loin. Les lueurs isolées font respirer le zellige ; c'est
         le balai qui donne à voir que la lumière le PARCOURT, parce qu'il
         allume des colonnes entières d'entrelacs dans un sens net. */
      flux.appendChild(h("b"));
      enfants.push(h("div.zel"), flux);
    }
    if (p.derives) {
      /* Chaque voile de nuages est une piste de deux dalles identiques,
         côte à côte, que l'on translate d'exactement une dalle. Quand
         l'animation reboucle, la seconde dalle se trouve pile là où était
         la première : la dérive est continue, sans saut. C'est pour cela
         qu'on ne peut pas se contenter d'un fond répété — un `background`
         qui défile laisse voir sa couture. */
      for (let i = 0; i < p.derives; i++) {
        enfants.push(h("div.derive" + (i ? ".lente" : ""), {}, h("i"), h("i")));
      }
    }
    const tourne = p.incline
      ? "rotateX(var(--incl-x)) rotateY(var(--incl-y)) "
      : "";
    monde.appendChild(h("div." + p.classe, {
      style: {
        transform: tourne + "translateZ(" + (-p.z) + "px)",
        inset: debord(p.z)
      }
    }, enfants));
  });

  const el = h("div.scene", { "aria-hidden": "true" }, monde);

  /* --- le relief au mouvement ------------------------------------- */
  const doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let attache = false;

  function incliner(fx, fy) {
    /* quelques degrés suffisent : au-delà, les plans se décollent */
    el.style.setProperty("--incl-y", (fx * 5).toFixed(2) + "deg");
    el.style.setProperty("--incl-x", (fy * -3).toFixed(2) + "deg");
  }

  function surSouris(e) {
    const r = el.getBoundingClientRect();
    if (!r.height) return;
    incliner((e.clientX - r.left) / r.width - 0.5,
             (e.clientY - r.top) / r.height - 0.5);
  }

  function surSortie() { incliner(0, 0); }

  function surDefilement() {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    /* le cadre s'incline doucement quand on descend la page */
    incliner(0, Math.max(-0.5, Math.min(0.5, -r.top / (r.height || 1))));
  }

  function brancher() {
    if (attache || doux) return;
    attache = true;
    const cible = el.parentElement || el;
    cible.addEventListener("mousemove", surSouris);
    cible.addEventListener("mouseleave", surSortie);
    if (window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener("scroll", surDefilement, { passive: true });
    }
  }

  function debrancher() {
    if (!attache) return;
    attache = false;
    const cible = el.parentElement || el;
    cible.removeEventListener("mousemove", surSouris);
    cible.removeEventListener("mouseleave", surSortie);
    window.removeEventListener("scroll", surDefilement);
  }

  /* On ne branche qu'une fois la scène dans le document — l'écouteur va
     sur le parent, qui n'existe pas encore à la construction.

     Deux voies, et ce n'est pas de la ceinture-bretelles : dans un onglet
     ouvert en arrière-plan, `requestAnimationFrame` ne s'exécute pas du
     tout. `setTimeout`, lui, tourne même caché. `brancher` est protégé
     par son drapeau, donc être appelé deux fois ne coûte rien. */
  requestAnimationFrame(brancher);
  setTimeout(brancher, 0);

  el.debrancher = debrancher;
  return el;
}
