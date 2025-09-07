# Inventaire Web App

Cette application est une preuve de concept d’un système d’inventaire léger pouvant être utilisé sur un iPhone ou tout autre appareil équipé d’un navigateur moderne. Elle fonctionne entièrement côté client et peut être installée comme une application **PWA** (Progressive Web App) pour un accès hors ligne grâce à un _service worker_. Les données sont stockées localement dans `localStorage` et peuvent être synchronisées avec un back‑end cloud (tel que Firebase) si vous remplacez les fonctions de persistance.

## Fonctionnalités principales

- **Authentification simple** : création de comptes et connexion par email/mot de passe. Les comptes sont sauvegardés localement pour l’exemple (dans une application réelle, utilisez un service d’authentification sécurisé comme Firebase Auth【654204695712524†L1665-L1686】).
- **Gestion des articles détaillée** : ajout, modification et suppression d’articles avec un **nom**, une **catégorie**, une **quantité**, une **date d’utilisation** et un **chantier/atelier**. Le champ « chantier » contient le nom du lieu où le stock est utilisé et le champ « lieu » précise si l’article appartient à l’inventaire **chantier** ou **atelier**.
- **Catégories dynamiques** : ajoutez, renommez ou supprimez des catégories directement depuis l’application. La suppression est bloquée si la catégorie est utilisée par un article, afin de préserver l’intégrité des données.
- **Onglets Inventaire** : l’application présente deux onglets distincts : **Inventaire chantier** (pour les articles utilisés sur les chantiers) et **Inventaire atelier** (pour les stocks présents dans l’atelier). Chaque onglet affiche seulement les articles correspondant à son lieu.
- **Filtrage et recherche** : filtrez la liste par catégorie et effectuez une recherche par nom ou chantier pour retrouver rapidement les articles dans le contexte du chantier ou de l’atelier.
 - **Export CSV amélioré** : exportez la liste des articles affichés dans l’onglet actif au format CSV. Le fichier exporté comporte le nom, la catégorie, la quantité, la date, le chantier, le chef et le lieu de chaque article.
 - **Chef d’équipe** : chaque article peut être affecté à un chef d’équipe (responsable du chantier ou de l’atelier). Cette information est affichée dans la table entre les colonnes « Chantier » et « Lieu ».
 - **Filtre par chef** : un menu déroulant permet de filtrer les articles en fonction du chef d’équipe sélectionné.
- **Mode hors ligne** : le _service worker_ met en cache l’interface de l’application. Couplé à une base de données supportant la persistance hors ligne comme Firestore, cela permettrait une utilisation complète sans réseau【127782114547848†L253-L346】.

## Mise en route

1. Copiez le dossier **InventoryWebApp** sur un serveur statique (ou ouvrez simplement `index.html` dans un navigateur moderne). Sur iOS/Safari, vous pouvez ajouter le site à l’écran d’accueil via le menu de partage ; il se comportera ensuite comme une application native.
2. Lors du premier lancement, créez un compte en cliquant sur _Créer un compte_.
3. Connectez‑vous et commencez à ajouter des articles.
4. Pour effacer toutes les données, effacez le stockage local du navigateur.

## Personnalisation et intégration back‑end

- **Synchronisation cloud** : pour une application professionnelle, remplacez les fonctions `loadInventoryForUser` et `saveInventoryForUser` par des appels à un back‑end. Par exemple, **Cloud Firestore** permet de stocker et de synchroniser des données en ligne et en mode hors ligne. Firestore prend en charge la mise en cache locale et synchronise automatiquement les modifications lorsque le réseau est disponible【186511039412186†L1395-L1406】.
- **Authentification** : utilisez **Firebase Authentication** pour gérer les comptes utilisateurs de manière sécurisée. L’authentification par email et mot de passe est simple à configurer et à utiliser【654204695712524†L1665-L1687】.
- **Progressive Web App** : le fichier `service-worker.js` implémente une stratégie *cache‑first* pour fournir l’interface en mode hors ligne. Pour un contenu dynamique mis à jour régulièrement, vous pouvez adapter la stratégie (réseau‑first, stale‑while‑revalidate, etc.)【127782114547848†L253-L350】.

## Distribution

Cette application étant une web app, aucune soumission sur l’App Store n’est nécessaire. L’utilisateur peut l’installer depuis le navigateur. Si vous décidez de transformer cette preuve de concept en application iOS native, voici quelques pistes :

- **App Store** : convient aux applications grand public. Elle offre une large portée mais impose une validation stricte et parfois lente【300002111665949†L78-L96】.
- **TestFlight** : idéal pour les versions bêta ; permet jusqu’à 10 000 testeurs et fournit des remontées d’erreurs, mais les builds expirent au bout de 90 jours【300002111665949†L105-L121】.
- **Distribution d’entreprise** : réservée aux grandes entreprises (plus de 100 employés) et destinée à des apps internes. Nécessite une adhésion au **Apple Developer Enterprise Program** et des conditions d’éligibilité strictes【382004472896864†L36-L59】.

Pour un usage en petite entreprise, la solution la plus simple reste une **application web** installable sur l’écran d’accueil. Elle est multiplateforme, rapide à mettre à jour et ne nécessite pas de processus de validation par Apple.