/* =====================================================================
   Configuration — Essence de Fès
   ---------------------------------------------------------------------
   Mêmes paramètres de connexion et d'hébergement que « Siham Délices de
   Fès » : le projet Supabase est partagé, la boutique vit dans son propre
   schéma Postgres (`boutique`) pour ne rien croiser avec les recettes.

   La clé ci-dessous est la clé « anon / publishable ». Elle est faite pour
   être publiée : ce n'est pas elle qui protège les données, ce sont les
   règles Row Level Security. N'inscrivez JAMAIS ici la clé service_role.
   ===================================================================== */

export const SUPA = {
  url: "https://gugoqqlxqztcdbdjsqux.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Z29xcWx4cXp0Y2RiZGpzcXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2Mjg0MjksImV4cCI6MjEwNDIwNDQyOX0.er1FuyFyz9iCNoBvnY0YRgHzwYat403xGDQ4yn7mylc",
  schema: "boutique",
  bucket: "boutique",
  admin: "adnane.aqasbi07@gmail.com"
};

/* Réglages qui ne dépendent pas de la base. */
export const APP = {
  devise: "MAD",
  cleSession: "essencefes.session",
  clePanier:  "essencefes.panier",
  cleLangue:  "essencefes.langue",
  cleTheme:   "essencefes.theme",
  cleFavoris: "essencefes.favoris",
  qteMax: 99
};
