---
path: 3_FREELANCE/03_TASKS/panier_ia/app_pwa_v0/README.md
parent: 3_FREELANCE/03_TASKS/panier_ia/_index.md
destination: garder comme staging PWA exacte jusqu’au gate HTTPS et appareils réels
---

# Mon Panier — PWA exacte

## Objectif

Cette staging PWA reprend directement le bundle runtime canonique de l’app iOS `MonPanierLocalV1/OpenDesignBundle`. Elle ne réimplémente pas les écrans en React et ne crée pas une seconde logique de recettes.

Le lien local `app_pwa_v0` dans le workspace pointe vers l’artefact lourd situé sur le volume externe :

`/Volumes/USB/Hermes-External/workspaces/panier_ia/app_pwa_exact_v1`

## Parité

- 2 532 fichiers runtime canoniques recopiés.
- 796 253 050 octets de runtime canonique conservés.
- HTML, CSS, JavaScript, catalogue, médias, navigation, persistance locale et actions proviennent de la même source que l’app iOS.
- Les seules additions de livraison sont `manifest.webmanifest`, `sw.js`, `pwa-register.js` et les icônes PWA.
- Le contrat `qa/pwa-shell.test.mjs` compare les fichiers canoniques byte à byte et normalise uniquement les trois ajouts PWA dans `index.html`.

## Modèle de partage validé

Chaque téléphone dispose de son propre `localStorage`. Aucun compte réel, backend, synchronisation inter-appareils ou panier collaboratif n’a été ajouté dans ce palier. Le partage visé ici est l’accès à la même application par un futur lien HTTPS, pas le partage des données d’un panier.

Le bundle conserve volontairement les écrans et le comportement de la source canonique, y compris les parcours locaux de démonstration. Les boutons Apple/Google/e-mail ne constituent donc pas une authentification réelle pour des testeurs externes. Le pont Google Swift `WKScriptMessageHandler` existe seulement dans l’hôte iOS ; dans Safari, le code canonique suit son fallback local existant. Cela doit être testé et expliqué avant toute invitation externe.

## Vérification locale

Depuis l’artefact réel :

```bash
node --test qa/pwa-shell.test.mjs
python3 -m http.server 4173
```

Puis ouvrir `http://127.0.0.1:4173/`. HTTP local permet de tester le rendu et le service worker ; il ne constitue pas encore un lien partageable à des amis.

## Backup de rollback

L’ancien candidat React complet a été sauvegardé avant remplacement ici :

`/Volumes/USB/Hermes-External/workspaces/panier_ia/backups/app_pwa_v0-react-20260816T151716Z`

## Gate suivant

Avant d’envoyer une URL : héberger cette empreinte exacte en HTTPS, tester l’URL déployée sur un iPhone et un Android réels, vérifier le manifest/service worker après fermeture et rechargement, confirmer les droits des médias et fournir une consigne de test sans données personnelles. Statut actuel : `internal_only`.
