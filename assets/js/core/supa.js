/* =====================================================================
   Client Supabase minimal — PostgREST, Auth et Storage par `fetch`.
   Aucune dépendance : rien à installer, rien à mettre à jour, rien qui
   casse le jour où un CDN tombe.

   Le schéma `boutique` n'étant pas `public`, chaque appel porte l'en-tête
   Accept-Profile (lecture) ou Content-Profile (écriture). C'est la seule
   subtilité de ce fichier.
   ===================================================================== */

import { SUPA, APP } from "./config.js";

export const session = { jeton: null };   /* { access_token, refresh_token, expires_at } */

/* ------------------------------------------------------------------ */
/* Session persistée                                                   */
/* ------------------------------------------------------------------ */
export function chargerSession() {
  try {
    const brut = localStorage.getItem(APP.cleSession);
    if (!brut) return null;
    const s = JSON.parse(brut);
    session.jeton = s && s.access_token ? s : null;
  } catch (e) { session.jeton = null; }
  return session.jeton;
}

export function enregistrerSession(s) {
  session.jeton = s;
  try {
    if (s) localStorage.setItem(APP.cleSession, JSON.stringify(s));
    else localStorage.removeItem(APP.cleSession);
  } catch (e) { /* quota ou navigation privée */ }
}

export function sessionDepuisReponse(d) {
  if (!d || !d.access_token) return null;
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token || null,
    expires_at: Date.now() + (Number(d.expires_in || 3600) * 1000)
  };
}

function base64url(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  try { return decodeURIComponent(escape(atob(s))); } catch (e) { return null; }
}

export function contenuJeton(tok) {
  if (!tok) return null;
  const p = String(tok).split(".");
  if (p.length < 2) return null;
  const brut = base64url(p[1]);
  try { return brut ? JSON.parse(brut) : null; } catch (e) { return null; }
}

/* ------------------------------------------------------------------ */
/* Erreur transportable                                                */
/* ------------------------------------------------------------------ */
export class ErreurSupa extends Error {
  constructor(code, message, details) {
    super(message || "Erreur " + code);
    this.code = code;
    this.details = details || null;
    /* Cas de figure fréquent tant que le tableau de bord n'est pas réglé :
       PostgREST répond « Invalid schema: boutique » ou « The schema must be
       one of the following ». Les deux formulations existent selon la version. */
    this.schemaNonExpose = /invalid schema|schema must be one of/i.test(String(message || ""));
  }
}

/* ------------------------------------------------------------------ */
/* Appel HTTP                                                          */
/* ------------------------------------------------------------------ */
async function appel(chemin, opts) {
  opts = opts || {};
  const methode = opts.method || "GET";
  const lecture = methode === "GET" || methode === "HEAD";

  const entetes = Object.assign({ apikey: SUPA.key }, opts.headers || {});
  if (opts.body !== undefined && !(opts.body instanceof Blob) && !(opts.body instanceof FormData)) {
    entetes["Content-Type"] = "application/json";
  }
  if (opts.profil !== false && chemin.startsWith("/rest/")) {
    entetes[lecture ? "Accept-Profile" : "Content-Profile"] = SUPA.schema;
  }
  if (session.jeton && session.jeton.access_token && !opts.anonyme) {
    entetes.Authorization = "Bearer " + session.jeton.access_token;
  }

  let corps = opts.body;
  if (corps !== undefined && !(corps instanceof Blob) && !(corps instanceof FormData)) {
    corps = JSON.stringify(corps);
  }

  const res = await fetch(SUPA.url + chemin, { method: methode, headers: entetes, body: corps });

  if (res.status === 401 && !opts.dejaRafraichi && session.jeton) {
    if (await rafraichir()) {
      return appel(chemin, Object.assign({}, opts, { dejaRafraichi: true }));
    }
  }

  if (!res.ok) {
    let msg = res.statusText, det = null;
    try { det = await res.json(); msg = det.message || det.error_description || det.error || msg; }
    catch (e) { /* corps vide */ }
    throw new ErreurSupa(res.status, msg, det);
  }

  if (res.status === 204) return null;
  const txt = await res.text();
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return txt; }
}

export async function rafraichir() {
  const s = session.jeton;
  if (!s || !s.refresh_token) return false;
  try {
    const d = await appel("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", anonyme: true, body: { refresh_token: s.refresh_token }
    });
    const ns = sessionDepuisReponse(d);
    if (!ns) return false;
    enregistrerSession(ns);
    return true;
  } catch (e) { enregistrerSession(null); return false; }
}

/* ------------------------------------------------------------------ */
/* PostgREST — lecture                                                 */
/* ------------------------------------------------------------------ */
/**
 * @param {string} table
 * @param {object} q  { select, where:{col:"eq.x"}, filtres:[[col,"lte.9"]],
 *                    order, limit, offset, ou, compte, unique }
 * @returns {Promise<Array>}  la propriété `.total` porte le nombre total si compte:true
 */
export async function lire(table, q) {
  q = q || {};
  const p = new URLSearchParams();
  p.set("select", q.select || "*");
  Object.entries(q.where || {}).forEach(function (e) {
    if (e[1] !== undefined && e[1] !== null && e[1] !== "") p.append(e[0], e[1]);
  });
  /* `filtres` porte les cas où une même colonne revient deux fois,
     par exemple prix=gte.100 et prix=lte.400. */
  (q.filtres || []).forEach(function (e) {
    if (e && e[1] !== undefined && e[1] !== null && e[1] !== "") p.append(e[0], e[1]);
  });
  if (q.ou)     p.set("or", q.ou);
  if (q.order)  p.set("order", q.order);
  if (q.limit)  p.set("limit", q.limit);
  if (q.offset) p.set("offset", q.offset);

  const entetes = {};
  if (q.compte) { entetes.Prefer = "count=exact"; entetes.Range = (q.offset || 0) + "-" + ((q.offset || 0) + (q.limit || 1000) - 1); }
  if (q.unique) entetes.Accept = "application/vnd.pgrst.object+json";

  const chemin = "/rest/v1/" + table + "?" + p.toString();
  if (!q.compte) return (await appel(chemin, { headers: entetes })) || [];

  /* count=exact : il faut lire l'en-tête, donc on refait l'appel à la main */
  const res = await fetch(SUPA.url + chemin, {
    headers: Object.assign({
      apikey: SUPA.key, "Accept-Profile": SUPA.schema, Prefer: "count=exact",
      Range: entetes.Range
    }, session.jeton ? { Authorization: "Bearer " + session.jeton.access_token } : {})
  });
  if (!res.ok) throw new ErreurSupa(res.status, res.statusText);
  const lignes = await res.json();
  const cr = res.headers.get("content-range") || "";
  lignes.total = Number(cr.split("/")[1]) || lignes.length;
  return lignes;
}

export async function lireUn(table, q) {
  const r = await lire(table, Object.assign({}, q, { limit: 1 }));
  return r && r.length ? r[0] : null;
}

/* ------------------------------------------------------------------ */
/* PostgREST — écriture                                                */
/* ------------------------------------------------------------------ */
export function inserer(table, lignes, opts) {
  opts = opts || {};
  const p = new URLSearchParams();
  if (opts.select) p.set("select", opts.select);
  const prefer = ["return=" + (opts.select ? "representation" : "minimal")];
  if (opts.surConflit) { p.set("on_conflict", opts.surConflit); prefer.push("resolution=merge-duplicates"); }
  return appel("/rest/v1/" + table + (p.toString() ? "?" + p : ""), {
    method: "POST", body: lignes, headers: { Prefer: prefer.join(",") }
  });
}

export function modifier(table, where, valeurs, opts) {
  opts = opts || {};
  const p = new URLSearchParams();
  Object.entries(where).forEach(function (e) { p.append(e[0], e[1]); });
  if (opts.select) p.set("select", opts.select);
  return appel("/rest/v1/" + table + "?" + p.toString(), {
    method: "PATCH", body: valeurs,
    headers: { Prefer: "return=" + (opts.select ? "representation" : "minimal") }
  });
}

export function supprimer(table, where) {
  const p = new URLSearchParams();
  Object.entries(where).forEach(function (e) { p.append(e[0], e[1]); });
  return appel("/rest/v1/" + table + "?" + p.toString(), { method: "DELETE" });
}

/** Fonction Postgres (RPC). */
export function rpc(nom, args) {
  return appel("/rest/v1/rpc/" + nom, { method: "POST", body: args || {} });
}

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */
export const auth = {
  connexionGoogle(retour) {
    const dest = retour || (location.origin + location.pathname);
    location.href = SUPA.url + "/auth/v1/authorize?provider=google&redirect_to=" +
      encodeURIComponent(dest);
  },

  async inscription(email, motDePasse, donnees) {
    const d = await appel("/auth/v1/signup", {
      method: "POST", anonyme: true,
      body: { email: email, password: motDePasse, data: donnees || {} }
    });
    const s = sessionDepuisReponse(d);
    if (s) enregistrerSession(s);
    return d;
  },

  async connexion(email, motDePasse) {
    const d = await appel("/auth/v1/token?grant_type=password", {
      method: "POST", anonyme: true, body: { email: email, password: motDePasse }
    });
    const s = sessionDepuisReponse(d);
    if (!s) throw new ErreurSupa(401, "Identifiants refusés");
    enregistrerSession(s);
    return s;
  },

  motDePasseOublie(email, retour) {
    return appel("/auth/v1/recover", {
      method: "POST", anonyme: true,
      body: { email: email, redirect_to: retour || location.origin + location.pathname }
    });
  },

  changerMotDePasse(nouveau) {
    return appel("/auth/v1/user", { method: "PUT", body: { password: nouveau } });
  },

  async deconnexion() {
    try { await appel("/auth/v1/logout", { method: "POST" }); } catch (e) { /* sans importance */ }
    enregistrerSession(null);
  },

  /** Récupère les jetons renvoyés dans le fragment après un retour OAuth. */
  capterRetour() {
    const h = location.hash || "";
    if (h.indexOf("access_token=") < 0 && h.indexOf("error=") < 0) return null;
    const p = new URLSearchParams(h.replace(/^#/, ""));
    let erreur = null;
    if (p.get("error")) {
      erreur = p.get("error_description") || p.get("error");
    } else {
      const s = sessionDepuisReponse({
        access_token: p.get("access_token"),
        refresh_token: p.get("refresh_token"),
        expires_in: p.get("expires_in")
      });
      if (s) enregistrerSession(s);
    }
    try { history.replaceState(null, "", location.pathname + location.search); }
    catch (e) { location.hash = ""; }
    return { erreur: erreur };
  }
};

/* ------------------------------------------------------------------ */
/* Storage — images de produits                                        */
/* ------------------------------------------------------------------ */
export const stockage = {
  urlPublique(chemin) {
    if (!chemin) return "";
    if (/^(https?:|data:|blob:)/.test(chemin)) return chemin;
    /* Un chemin qui commence par `assets/` désigne un fichier livré avec
       le site — les motifs ornementaux, par exemple. Le passer au Storage
       donnerait une URL introuvable. */
    if (/^\.?\/?assets\//.test(chemin)) return String(chemin).replace(/^\.?\//, "");
    return SUPA.url + "/storage/v1/object/public/" + SUPA.bucket + "/" +
      String(chemin).replace(/^\/+/, "");
  },

  async televerser(chemin, fichier) {
    const res = await fetch(
      SUPA.url + "/storage/v1/object/" + SUPA.bucket + "/" + chemin.replace(/^\/+/, ""),
      {
        method: "POST",
        headers: Object.assign(
          { apikey: SUPA.key, "x-upsert": "true", "Cache-Control": "31536000" },
          session.jeton ? { Authorization: "Bearer " + session.jeton.access_token } : {},
          fichier.type ? { "Content-Type": fichier.type } : {}
        ),
        body: fichier
      });
    if (!res.ok) {
      let m = res.statusText;
      try { m = (await res.json()).message || m; } catch (e) { /* vide */ }
      throw new ErreurSupa(res.status, m);
    }
    return stockage.urlPublique(chemin);
  },

  async retirer(chemin) {
    return appel("/storage/v1/object/" + SUPA.bucket + "/" + chemin.replace(/^\/+/, ""),
      { method: "DELETE", profil: false });
  }
};
