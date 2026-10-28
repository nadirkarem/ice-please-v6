# Ice Please, maquette du site (FR / EN / AR)

Aperçu en ligne : **https://nadirkarem.github.io/ice-please-v6/** (version 6 : V5 + la boutique en ligne, brouillon non indexé).

Maquette de refonte du site d'Ice Please Morocco (FAAB & CO), glaçons premium et clear ice pour les professionnels de la boisson. Ce n'est pas le site officiel : les textes reprennent le site actuel, les visuels de synthèse (vidéo, sphère dans un verre de whisky) sont des illustrations, et la page est en `noindex`.

Site statique en HTML, CSS et JavaScript, construit avec [Vite](https://vite.dev). Aucun framework, aucune base de données. La boutique (`/shop`, panier, livraison, paiement simulé, compte) rejoue le parcours d'Odoo dans le navigateur (`src/shop.js`, données dans `localStorage`) ; dans Odoo, c'est la boutique d'Odoo qui sert, habillée avec ce design (`ODOO_BOUTIQUE.md`). Français à la racine, anglais sous `/en/`, arabe sous `/ar/` (mise en page inversée).

## Lancer en local

```bash
npm install --legacy-peer-deps
npm run dev      # http://127.0.0.1:5300
npm run build    # génère dist/ (100 pages)
```

Pour tester la construction sous un sous-dossier, comme sur GitHub Pages :

```bash
BASE_PATH=/ice-please-v6 npm run build
BASE_PATH=/ice-please-v6 npx vite preview
```

## Où modifier quoi

| Pour changer… | Fichier |
|---|---|
| un texte (FR, EN, AR) | `content/fr.json`, `content/en.json`, `content/ar.json` (mêmes clés) |
| téléphone, e-mail, Instagram, indexation | `content/site.json` |
| la structure d'une page | `scripts/lib/pages.mjs` |
| l'en-tête, le pied de page, le `<head>` | `scripts/lib/layout.mjs` |
| les adresses des pages | `scripts/lib/routes.mjs` |
| le design | `src/style.css` |
| le comportement (menu, transitions de page, givre, récit, défilement fluide, révélation titre et image, formulaires) | `src/main.js` |
| la boutique : catalogue, prix (vides : « -- MAD »), livraison, paiement | `content/shop.json`, `content/shop.<langue>.json`, `scripts/lib/shop-pages.mjs`, `src/shop.js` |
| l'habillage des pages d'Odoo | `src/odoo-skin.css` |
| les vidéos (MP4, WebM, affiche) | `public/media/` |

## Mise en ligne

Chaque envoi sur la branche `main` reconstruit le site et le publie sur GitHub Pages (`.github/workflows/pages.yml`). Le même envoi publie aussi le paquet pour Odoo (pages, catalogue de la boutique, feuille de style et script) sous `/odoo-pack/`, `/ip.css` et `/ip.js` : une page HTTPS comme celle d'Odoo ne peut pas lire un serveur local, elle peut lire celui-ci.
