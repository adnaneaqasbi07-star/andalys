/* =====================================================================
   La bannière en relief — les portes du palais et le réseau de zellige
   ---------------------------------------------------------------------
   Deux plans posés à des profondeurs réelles sur l'axe Z, dans un espace
   en perspective :

     • la photographie des portes du palais, au fond ;
     • le voile qui garde le texte lisible, 100 px devant ;
     • et 80 px plus près encore, un réseau de zellige lumineux.

   Le navigateur calcule la perspective ; la souris fait tourner le monde
   de quelques degrés. Comme les deux plans ne sont pas à la même
   profondeur, ils ne se déplacent pas de la même quantité : le réseau
   glisse sur les portes. C'est cette parallaxe qui donne le relief, et
   elle est vraie — ce n'est pas une illusion peinte.

   Le réseau et son animation sont dans app.css (.reseau) ; ce module ne
   pose que la profondeur de chaque plan et le mouvement de la souris.

   Aucune bibliothèque. Une poignée d'éléments et deux transformations.
   ===================================================================== */

import { h } from "../core/dom.js";

/* Profondeur de chaque plan, et l'agrandissement qui va avec.

   Un plan reculé de |z| paraît plus petit du facteur PERSP / (PERSP + |z|).
   Pour qu'il remplisse encore le cadre, il faut l'agrandir de l'inverse.
   C'est pour cela que l'échelle est calculée et non choisie : posée à la
   main, elle laisserait un liseré vide sur un bord ou l'autre. */
const PERSP = 900;

/* L'ordre de peinture ne suit pas le DOM mais la profondeur : le plan le
   plus lointain est dessiné en premier. C'est pour cela que le voile est
   ici, entre la photo et le réseau, et non plus posé par-dessus le tout.
   Placé au-dessus, il éteignait la lumière du réseau — 94 % du voile sur
   le bord du titre, il n'en restait rien. */
const PLANS = [
  { classe: "plan-porte", z: 300 },
  { classe: "plan-voile", z: 200 },
  { classe: "reseau", z: 120, contenu: ["zel", "flux"] }
];

function echelle(z) {
  /* un peu de marge : la rotation du monde découvrirait sinon les bords */
  return (PERSP + z) / PERSP * 1.06;
}

/** Construit la scène. Renvoie l'élément et une fonction de démontage. */
export function scene() {
  const monde = h("div.scene-monde", { "aria-hidden": "true" });

  PLANS.forEach(function (p) {
    const enfants = (p.contenu || []).map(function (c) {
      /* les trois étincelles qui courent sur le réseau */
      return c === "flux"
        ? h("div.flux", {}, h("i"), h("i"), h("i"))
        : h("div." + c);
    });
    monde.appendChild(h("div." + p.classe, {
      style: {
        transform: "translateZ(" + (-p.z) + "px) scale(" +
                   echelle(p.z).toFixed(4) + ")"
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

  /* on ne branche qu'une fois la scène dans le document */
  requestAnimationFrame(brancher);

  el.debrancher = debrancher;
  return el;
}
