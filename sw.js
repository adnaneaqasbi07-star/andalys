/* =====================================================================
   Service worker de la boutique.

   Il est enregistré depuis le sous-dossier, sa portée s'arrête donc au
   sous-dossier. Celui de l'application de recettes, à la racine du site,
   garde la sienne : deux applications, deux caches, aucune interférence.
   La portée la plus précise l'emporte, la boutique n'est jamais servie
   depuis le cache des recettes.
   ===================================================================== */

const CACHE = "andalys-20260907-aaa69d21";

const SOCLE = [
  "index.html",
  "manifest.webmanifest",
  "assets/css/tokens.css",
  "assets/css/app.css",
  "assets/js/app.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        return Promise.all(SOCLE.map(function (a) { return c.add(a).catch(function () {}); }));
      })
      .then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks
          .filter(function (k) { return k.startsWith("andalys-") && k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); }));
});

function memoriser(req, res) {
  if (!res || res.status !== 200 || res.type === "opaque") return res;
  const copie = res.clone();
  caches.open(CACHE).then(function (c) { c.put(req, copie); });
  return res;
}

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  /* Jamais de cache pour Supabase : prix, stock et jetons doivent rester
     frais. Une boutique qui affiche un stock périmé vend ce qu'elle n'a plus. */
  if (url.hostname.endsWith(".supabase.co")) return;

  /* Le back-office non plus : l'administrateur doit voir l'état réel. */
  if (url.pathname.indexOf("/admin.html") >= 0 ||
      url.pathname.indexOf("/assets/js/admin/") >= 0) return;

  /* La page : réseau d'abord, cache en repli hors connexion. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(function (res) { return memoriser(req, res); })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match("index.html") ||
              new Response("", { status: 504, statusText: "hors ligne" });
          });
        }));
    return;
  }

  /* Le reste — code, styles, polices, images : cache d'abord, réseau ensuite. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        /* revalidation silencieuse pour la prochaine visite */
        fetch(req).then(function (res) { memoriser(req, res); }).catch(function () {});
        return hit;
      }
      return fetch(req)
        .then(function (res) { return memoriser(req, res); })
        .catch(function () { return new Response("", { status: 504, statusText: "hors ligne" }); });
    }));
});
