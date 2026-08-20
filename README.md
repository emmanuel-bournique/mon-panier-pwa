---
path: 3_FREELANCE/03_TASKS/panier_ia/app_pwa_v0/README.md
parent: 3_FREELANCE/03_TASKS/panier_ia/_index.md
destination: garder comme source web GitHub Pages pour les itérations PWA rapides ; Xcode reste un livrable séparé
---

# Mon Panier — voie web GitHub Pages

## Source de vérité

Pour la phase PWA, ce dépôt `main` est la source de vérité. GitHub Pages publie directement cette version :

`https://emmanuel-bournique.github.io/mon-panier-pwa/`

Le serveur local `127.0.0.1:4173` est uniquement un outil de diagnostic ponctuel. Il ne représente pas la version utilisée sur l’iPhone et ne doit pas devenir une deuxième surface produit. Sur un iPhone, `127.0.0.1` désigne l’iPhone lui-même, pas le Mac.

Le projet n’entretient plus de parité automatique avec `OpenDesignBundle`, de copie byte à byte, de manifeste de hashes ou de déclaration de divergence PWA pour chaque itération web. Les anciennes preuves de l’état précédent sont conservées dans les sauvegardes Git/externes de rollback, hors du flux actif.

## Règle d’itération

1. Modifier la voie web dans ce dépôt.
2. Faire un petit commit Git explicite.
3. Publier sur GitHub Pages uniquement après validation du smoke test et du rendu attendu.
4. Tester le lien GitHub Pages sur ordinateur puis sur l’iPhone réel.
5. En cas de régression, utiliser `git revert` du commit concerné. Aucun répertoire de candidate parallèle n’est nécessaire.

Le service worker conserve un seul identifiant de runtime court, nécessaire pour éviter un ancien cache. Il ne constitue pas un système de parité avec Xcode.

## Coque desktop et PWA réelle

La prévisualisation desktop possède une coque `.phone` destinée à rendre l’application lisible dans une page GitHub Pages large. Cette coque affiche une Dynamic Island et un faux statut horaire uniquement dans le navigateur desktop.

Sur un vrai iPhone, `.desktop-preview-statusbar` est masqué. La PWA utilise alors le viewport et la zone système fournis par iOS ; elle ne dessine pas une fausse Dynamic Island dans un téléphone réel.

## Données et partage

Chaque téléphone dispose de son propre `localStorage`. Aucun compte réel, backend, synchronisation inter-appareils ou panier collaboratif n’est ajouté dans ce palier. Le lien public donne accès à la même application, mais ne partage pas les données locales d’un panier.

## Vérification légère

Depuis le dépôt :

```bash
node --test qa/*.test.cjs qa/*.test.mjs
git diff --check
node --check app-v1.js
node --check sw.js
```

Le contrôle web vérifie le shell PWA, le manifeste, le service worker, les URL de runtime et la séparation du faux chrome desktop. Il ne parcourt pas le bundle iOS et ne calcule pas de parité de hashes.

## Xcode

Le bundle natif Xcode reste gelé pendant les itérations PWA. Il ne doit être resynchronisé qu’après stabilisation visuelle de la voie web et décision explicite de préparer une version native. Les contrôles de livraison Xcode seront alors propres à Xcode, au lieu d’être exécutés à chaque modification web.

## Rollback

Avant la migration vers cette voie web, un rollback complet a été créé sur le volume externe. Le rollback Git reste également disponible par l’historique `main`. Toute publication doit conserver un commit identifiable afin de permettre un `git revert` rapide.

## Gate suivant

Valider le rendu GitHub Pages sur ordinateur et sur l’iPhone réel, en vérifiant notamment : source affichée, version du service worker, proportions de la coque desktop, absence de faux chrome sur iPhone et position de la fiche recette. Le statut du pilote reste individuel et limité à l’usage de test.
