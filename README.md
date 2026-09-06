# Essence de Fès — عبق فاس — Essence of Fez

Boutique en ligne trilingue des produits authentiques de Fès : parfums
traditionnels et internationaux, pâtisseries, produits du terroir, artisanat.
Livraison à domicile partout au Maroc.

**HTML/CSS/JS natif · zéro dépendance · Supabase (PostgREST + RLS) · GitHub Pages**

> Cette boutique partage le **projet Supabase** de *Siham Délices de Fès*, sans
> jamais y toucher : elle vit dans le schéma Postgres `boutique`, et n'ajoute
> aucun déclencheur sur `auth.users`. L'hébergement, lui, est séparé : son
> propre dépôt GitHub Pages. Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) § 0.

---

## Démarrer

```bash
python3 -m http.server 4321
# http://localhost:4321/
```

Rien à installer, rien à compiler. Les fichiers du dossier sont ceux qui
seront publiés.

Tant que la base n'est pas en place, la boutique s'affiche et signale
`La base n'est pas encore configurée`.

## Mettre en service

Trois étapes, une seule fois — le détail est dans
[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) :

1. `supabase db push` — crée le schéma `boutique` ;
2. dans le tableau de bord : exposer le schéma `boutique`, ajouter l'URL de
   retour Google, créer le compartiment de stockage `boutique` ;
3. `python3 bin/deploie.py --pousser` — publie sur GitHub Pages.

## Adresses

| | |
|---|---|
| Boutique | `https://adnaneaqasbi07-star.github.io/fes/` |
| Back-office | `https://adnaneaqasbi07-star.github.io/fes/admin.html` |
| Recettes (inchangée) | `https://adnaneaqasbi07-star.github.io/SihamDelicesFes/` |

---

## Ce que fait l'application

**Catalogue** — catégories arborescentes, marques, fiches parfum (famille
olfactive, pyramide tête/cœur/fond, intensité, tenue, sillage) et fiches
alimentaires (poids, ingrédients, allergènes, conservation, origine), formats
multiples avec prix et stock propres, galerie avec zoom, avis modérés.

**Recherche** — plein texte Postgres sur les trois langues, suggestions à la
frappe, filtres (prix, marque, genre, famille olfactive, disponibilité,
promotion) et tri. Les filtres sont dans l'URL, une page de résultats se
partage.

**Achat** — panier conservé dans le navigateur, codes promo vérifiés en base,
zones de livraison avec tarif, délai et seuil de gratuité par ville, paiement à
la livraison ou virement, sept statuts de commande et suivi — avec compte ou
par numéro + téléphone.

**Espace client** — connexion par e-mail ou Google, profil, carnet d'adresses,
historique, favoris (locaux avant la connexion, fusionnés ensuite).

**Trois langues** — arabe, français, anglais, y compris le contenu du
catalogue ; RTL complet pour l'arabe.

**Back-office** — tableau de bord, produits, commandes, clients, catégories,
marques, codes promo, zones de livraison, réglages et pages légales.

---

## Le point important

Le total d'une commande n'est jamais celui que la page envoie.

Le navigateur transmet des identifiants de produits et des quantités ;
`boutique.creer_commande()` relit les prix en base, vérifie les stocks,
applique la zone de livraison et le code promo, puis écrit la commande. Une
page modifiée dans les outils du navigateur ne peut pas s'offrir un parfum à un
dirham.

La même logique vaut partout : les codes promo ne sont jamais listés côté
client, les statistiques sont agrégées par Postgres, et l'accès au back-office
est décidé par `boutique.est_admin()`, pas par une adresse difficile à deviner.

---

## Vérifier avant de publier

```bash
python3 bin/verifier.py
```

Sans base de données ni Docker, en une seconde. Le script reconstruit le schéma
depuis les migrations (parseur PostgreSQL officiel) puis confronte le reste du
projet à ce modèle :

- chaque table, relation imbriquée et colonne interrogée par le JavaScript
  existe bien — y compris dans les chaînes `select` de PostgREST ;
- chaque fonction appelée par `rpc()` est déclarée ;
- les valeurs proposées par l'interface sont celles qu'autorisent les
  contraintes `check` (statuts de commande, types de produit, formes de parfum) ;
- chaque clé de traduction employée existe et a bien ses trois langues ;
- chaque vue chargée à la demande est présente sur le disque ;
- rien ne s'adresse au schéma de l'application de recettes, et aucune migration
  n'écrit dans `public`.

Dépendance unique, et seulement pour ce script :
`python3 -m pip install --user pglast`

Puis, pour éprouver la base elle-même :

```bash
./bin/valider_local.sh
```

Monte un PostgreSQL jetable, y rejoue les trois migrations et le catalogue,
lance les **63 contrôles** de `supabase/tests.sql`, puis démolit tout. Sans
Docker : seulement `brew install postgresql@17`.

Ce que ces tests garantissent, entre autres :

- un panier qui annonce un prix falsifié est facturé au prix de la base ;
- un produit vendu au format (3 ml, 6 ml…) ne peut pas être commandé sans
  format, ni un produit masqué être vendu ;
- le stock fait barrage, et une commande refusée n'en consomme pas ;
- une commande passée garde le nom et le prix du jour de l'achat, même si le
  produit est renommé ou soldé ensuite ;
- le suivi sans compte exige le téléphone, quel que soit son format d'écriture ;
- un visiteur ne voit ni les commandes, ni les codes promo, ni les fiches
  clients ; un client ne voit que les siennes ;
- rien n'est écrit dans le schéma de l'application de recettes, et aucun
  déclencheur n'est posé sur `auth.users`.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure du projet, base de
  données, pages, design system
- [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) — mise en service, publication,
  sauvegarde

## Notes de développement

- Toute sortie passe par `textContent` ou par des nœuds : aucune donnée de la
  base n'est concaténée dans du HTML.
- Tout placement CSS utilise les propriétés logiques (`inline-start`,
  `inline-end`) : le RTL ne demande aucune règle miroir.
- Les libellés d'interface se déclarent dans `assets/js/i18n/dictionnaire.js`,
  une ligne par entrée, `[ar, fr, en]` — les trois colonnes restent alignées.
- Les libellés venus de la base sont des `jsonb {"ar":…,"fr":…,"en":…}` lus
  par `L()`.
- Les vues sont chargées par `import()` à l'entrée dans la route.
- Le script de publication renumérote le cache du service worker : sans cela,
  un visiteur déjà venu garderait l'ancien code. Il ne supprime que ce qu'il
  avait lui-même publié — `.git` et un éventuel `CNAME` survivent.
