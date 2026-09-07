/* =====================================================================
   La bannière en relief — Fès, la médina, et le zellige
   ---------------------------------------------------------------------
   Quatre plans posés à des profondeurs réelles sur l'axe Z, dans un
   espace en perspective :

     • la photographie de la médina, au fond ;
     • le voile qui garde le texte lisible, 100 px devant ;
     • et devant tout, un réseau de zellige où court la lumière.

   Le navigateur calcule la perspective ; la souris fait tourner le monde
   de quelques degrés. Comme les plans ne sont pas à la même profondeur,
   ils ne se déplacent pas de la même quantité : la médina bouge à peine,
   les portes un peu, le réseau franchement. C'est cette parallaxe qui
   donne le relief, et elle est vraie — ce n'est pas une illusion peinte.

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
  { classe: "plan-voile", z: 200 },
  { classe: "reseau", z: 120, etincelles: 4 }
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
      enfants.push(h("div.zel"), flux);
    }
    monde.appendChild(h("div." + p.classe, {
      style: { transform: "translateZ(" + (-p.z) + "px)", inset: debord(p.z) }
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

  /* on ne branche qu'une fois la scène dans le document */
  requestAnimationFrame(brancher);

  el.debrancher = debrancher;
  return el;
}
