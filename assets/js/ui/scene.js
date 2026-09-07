/* =====================================================================
   La bannière en perspective — l'enfilade d'arches de la médina
   ---------------------------------------------------------------------
   Cinq travées d'arcades posées à des profondeurs réelles sur l'axe Z. Le
   navigateur calcule la perspective ; la souris fait tourner la scène de
   quelques degrés, ce qui suffit à donner le relief. Sur écran tactile
   le défilement fait le même travail.

   La forme des arcs et le percement du mur sont dans app.css (.travee) ;
   ce module ne pose que la profondeur et la teinte de chaque travée.

   Aucune bibliothèque, et une seule ressource : la tuile de zellige,
   3,8 Ko de SVG, mise en cache dès la première visite. Le reste tient en
   une dizaine d'éléments et deux transformations.
   ===================================================================== */

import { h } from "../core/dom.js";

/* Profondeur, teinte du mur et pas du zellige, travée par travée — de la
   plus lointaine à la plus proche. La géométrie de l'arcade est la même
   partout : c'est la perspective qui met à l'échelle. Seule la teinte
   change, et elle s'assombrit en s'approchant : c'est ce qui creuse la
   galerie.

   Le pas du zellige, lui, est corrigé travée par travée. À sa taille
   nominale, la perspective réduirait la tuile de la travée du fond à une
   quarantaine de pixels : le motif se brouillerait en moiré. Le pas est
   donc agrandi avec la profondeur, de façon à ce que la tuile fasse
   toujours une centaine de pixels à l'écran. La correction est partielle
   (exposant 0,6) : le zellige reste un peu plus serré au loin, ce qui
   continue de dire la distance. */
const TRAVEES = [
  { z: -1250, mur: "#1B5C46", zel: 201 },
  { z:  -900, mur: "#14493A", zel: 182 },
  { z:  -580, mur: "#0E3A2D", zel: 161 },
  { z:  -300, mur: "#0A2B21", zel: 142 },
  { z:   -80, mur: "#061A14", zel: 126 }
];

/** Construit la scène. Renvoie l'élément et une fonction de démontage. */
export function scene() {
  const monde = h("div.scene-monde", { "aria-hidden": "true" });
  monde.appendChild(h("div.scene-fond"));

  TRAVEES.forEach(function (t) {
    monde.appendChild(h("div.travee", {
      style: {
        transform: "translateZ(" + t.z + "px)",
        "--t-mur": t.mur,
        "--t-zel": t.zel + "px"
      }
    }, h("div.mur")));
  });

  const el = h("div.scene", { "aria-hidden": "true" }, monde);

  /* --- le relief au mouvement ------------------------------------- */
  const doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let attache = false;

  function incliner(fx, fy) {
    /* quelques degrés suffisent : au-delà, les travées se décollent */
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
    /* le couloir s'incline doucement quand on descend la page */
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
