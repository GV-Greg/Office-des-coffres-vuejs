# Architecture technique — Frontend (Vue 3)

> Référence structurelle chargée automatiquement (voir `CLAUDE.md` racine). Mise à jour :
> 20/11/2026. Vérifier le code avant de citer un détail précis si ce fichier date de plus de
> quelques semaines.

Vue 3 (Composition API, `<script setup>`) + Vite 6 + Tailwind 3 + Pinia 2 + Vue Router 4 +
vue-i18n 9 + notivue (toasts) + oh-vue-icons. Parle au backend Laravel via `src/api.js` (Axios,
`VITE_API_ENDPOINT_DEV`/`_PROD`).

## Router (`src/router/index.js`)

`createWebHistory`. Routes `/app/*` en **named views** (`Nav` = `NavBar.vue` partagé, lazy +
`default` = la vue). Routes top-level (`welcome`/`login`/`register`) importées eagerly.

| Path | Name | Guard |
|---|---|---|
| `/` | `welcome` | — (`meta.public`) |
| `/login` | `login` | `redirectToHomeIfLoggedIn` |
| `/register` | `register` | `redirectToHomeIfLoggedIn` |
| `/verify-email` | `verify-email` | — |
| `/maintenance/:secret` | `maintenance-bypass` | — (`meta.public`) — retient le secret (onglet) puis redirige vers `home` |
| `/legal/cookies` | `legal-cookies` | — (`meta.public`) |
| `/legal/privacy` | `legal-privacy` | — (`meta.public`) |
| `/legal/mentions` | `legal-mentions` | — (`meta.public`) |
| `/legal/data` | `legal-data` | — (`meta.public`) — « Vos données, outil par outil » |
| `/app/` | `home` | — |
| `/app/eco` | `economy` | redirige vers `economy-mines` ; enfants `registre` → `economy-registry` (`redirectToHomeIfNotLoggedIn`), `registre/prix` → `economy-prices` (même garde, **sans lien de menu** : via bouton « Historique des prix » du registre); `balance` → `economy-inventory-balance` (public, « La Balance des stocks »), `registre-stocks` → `economy-inventory-registry` (`redirectToHomeIfNotLoggedIn`, « Registre des stocks » : lien de menu et carte d'accueil seulement pour qui lit un registre — `GET inventory-scopes` : ville, province) |
| `/app/secu` (enfant `/guet`) | `security` | — |
| `/app/company` | `company` | — |
| `/app/anim` | — | enfants : `` (`animation`), `decode` → `animation-decode`, `decode/creer|gerer|reinitialiser|confirmer-email` (publics, sans compte), `decode/ma-salle` → `animation-mine` (`redirectToHomeIfNotLoggedIn`), `grille[/creer|gerer|reinitialiser|confirmer-email|ma-grille]` (même schéma) |
| `/public/activite/decode/:slug` | `animation-public` | — (`meta.public`, `meta.noFooter`) — page publique, convention `/public/` = pages à partager |
| `/public/activite/grille/:slug` | `rewards-public` | — (idem) |
| `/app/profil` | `profil` | `redirectToHomeIfNotLoggedIn` |
| `/app/mon-bureau/:section(province\|prix\|categories)?` | `province` | `redirectToHomeIfNotLoggedIn` — « Mon bureau » (`/app/province` y redirige) |
| `/app/character/new` | `character-new` | `redirectToHomeIfNotLoggedIn` |
| `/:pathMatch(.*)*` | `not-found` | — (`meta.public`) |

Les deux guards sont **exportés** nommément (testables dans `tests/auth/`). `redirectToHomeIfNotLoggedIn` vérifie `authStore.isLoggedIn` **puis** la validité réelle du token (`checkAuth()`). `WelcomeView` exemptée de redirection (voir `docs/DECISIONS.md`).

**Toasts** : Notivue en haut à droite, **entrée et sortie par la droite** (`animations` de `createNotivue` dans `main.js`, classes `odc-toast-*` dans `App.vue`, mouvement réduit honoré par `base.css`) ; garde-fou `toastAnimation.unit.test.js`.

**Hooks globaux** : `beforeEach`/`afterEach`/`onError` pilotent `LoadingOverlay.vue` via `useNavigationLoading` — contexte `chest` pour les modules « Coffres X » (`economy`, `economy-mines`, `security`, `security-guet`, `animation`), `entry` du portail `welcome` vers `home` (phrase « Vous entrez dans l'Office »), `office` pour le reste. **Couleur** : celle du module pour `chest` seulement ; tout autre loader global (office, entry, envoi API, vérification de démarrage) est **violet** (couleur de Mon bureau — l'ambre était trop proche de l'or d'Économie). Les envois API utilisateur passent par `trackApiCall()`.

## Stores Pinia (`src/stores/`)

- **`authStore.js`** (style setup) — tokens Passport. State : `user` (localStorage), `token` (string brute, localStorage), `refreshToken` (**localStorage si « Rester connecté », sessionStorage sinon**). `user.characters` = liste (0, 1 ou N personnages).
  Getters : `isLoggedIn`, `getUser`, `getToken`, `getCharacters`, `hasCharacters`, `isAdmin`, `activeCharacter`/`defaultCharacter`.
  Actions : `register` (email+password, ne connecte pas), `resendVerification`, `login` (par **email**, avec `remember_me`), `refreshAccessToken`, `logout`, `deleteAccount` (DELETE `auth/account`, art. 17 : purge session locale + comfort data du compte), `checkAuth` (**une seule requête `auth/me` en vol par token**, garde-fou `authStore.test.js`), `createCharacter`, `updateCharacterCity`, `setActiveCharacter`/`setDefaultCharacter`.
  **Deux niveaux de personnage** : `defaultCharacter` = choix persistant (comfort data `default_character_id`), `activeCharacter` = session en cours.
  🔴 **Intercepteur axios 401 avec mutex** : un seul `auth/refresh` même si plusieurs requêtes échouent, rejoue l'originale ; `auth/login` et `auth/refresh` exclus. Un **refus** du refresh purge avec toast « session expirée » ; un refresh sans réponse garde la session.
- **`mandateStore.js`** (style setup) — mandats : `mandates`, `characters` (avec `requestable`), `offices` (référentiel FR/EN). ⚠️ **Le frontend ne recode aucune règle** : titres, motifs et causes arrivent de l'API en FR/EN (Q11), refus avec `messages[champ][langue]` (Q9) ; `apiFieldErrors` / `apiMessage` choisissent la langue. Seuls les **statuts** et le texte d'interface sont dans les locales (`Profil.Mandates.*`). Arbitrages : `admin/echanges/mandats-lot2/`.
- **`cookieStore.js`** (style options) — consentement nommé et extensible : `consent: { preferences: bool, choiceMadeAt }` (clé `cookie-consent`, migration silencieuse depuis `cookie-comply`). Une catégorie « Préférences » — pas de « Session » (jeton d'auth exempté, voir `admin/strategies/cookies.md`). `comfortData` : bag générique par module — `getComfortData(key, fallback)` / `setComfortData(key, value)`, persistance conditionnée à `hasAcceptedPreferences`. `clearConsentedStorage()` purge `cookie-*`/`comfort-*` (jamais `auth_*`). `isPreferencesModalOpen` partagé entre composants.
- **`inventoryStore.js`** (style setup) — **seul** lecteur/écrivain des réglages d'inventaire et du texte collé. **Sans compte** : navigateur (clés confort). **Avec compte** (`serverMode`) : serveur par personnage, trois niveaux `personal`/`city`/`province` selon `GET inventory-scopes`. Document normalisé (`normalizeDoc`, `toPayload`), écritures groupées (800 ms) avec version (409 → remplacement local). Reprise à la première connexion (`importLocalIfNeeded`) si base vide. ⚠️ Aucune règle côté site. Backend : `backend/docs/ARCHITECTURE.md`, « Inventaires ». **Registre des stocks** (fil `admin/echanges/registre-stocks`) : `registryOf(level)` / `loadRegistry(level, force)` / `recordRegistry(level, raw, confirmReplace)` pour `city` (`GET|POST inventory/city/registry`) et `province` (`inventory/province`) ; `history` = province, `cityHistory` = ville. `recordRegistry` **lève** le 409 (`error.response.data.existing` nomme le rédacteur de l'inscription à remplacer) ; le corps ne porte `confirm_replace: true` qu'à la confirmation. `readLastPaste(level)` : **lecture pure** du dernier inventaire retenu (personnel/ville : `GET …/inventory/{niveau}` ; province : plus récent exemplaire de l'historique ; sans compte : cache de la Gestion des stocks), sans reprise ni effacement — réservée à La Balance des stocks (ne jamais y brancher `loadPaste`, qui importe le collage du navigateur en base).

## Services

- **`src/api.js`** — seul client HTTP, **délai 20 s** (`HTTP_TIMEOUT_MS`). Bearer token par appel ; intercepteur 401 dans `authStore.js`. Exporte `ADMIN_ORIGIN`.
- **`src/services/`** n'existe plus (code mort). Toute doc les mentionnant est périmée.

## Vues (`src/views/`)

- **`WelcomeView.vue`** — landing : logo vertical `<h1>`, cadenas, invite « cliquez » en rebond fini (`bounce-hint`), `SelectorMenu`, intro roleplay, **footer propre** (disclaimer + copyright + liens légaux, exemptée d'`AppFooter`).
- **`HomeView.vue`** — `NavMenu` + deux rubriques de `whatsNew.json` : « Chroniques » (`feature`) et « Registre des réparations » (`fix`/`improvement`), entrées `scope: "private"` connecté seulement.
- **`404.vue`** — logo, texte roleplay, un bouton retour (historique navigateur ou `home`/`welcome`). Pas de hauteur minimale propre.
- **Pages légales** (`legal/`) — FR + EN, contenu i18n `Legal.*`. ⚠️ Listes rendues avec `tm()` **+ `rt()`** (sinon AST invisibles en test). Insertions par module (Décode, Registre des mines, Inventaires) avec gardes-fous `tests/legal/privacy*`.
- **`legal/DataPageView.vue`** — « Vos données, outil par outil » : badge d'accès par outil, `modules/dataPageSections.js` = source unique. 🔴 **Version B** : les énumérations de la politique ne perdent jamais une ligne, la page renvoie à la politique pour durée/destinataires. Gardes-fous `dataPageSingleSource` et `badgeContrast`.
- **`LoginView.vue`** — connexion par **email**. Carte claire deux thèmes, alerte « email non vérifié » + renvoi, case « Rester connecté » (comfort data `remember_me_preference`). Comparaison `error_message === 'Email non vérifié.'` **volontairement pas traduite** (message brut API).
- **`RegisterView.vue`** — email + mot de passe + confirmation seulement (pseudo/ville dans `AddCharacterView`). Après soumission : écran « vérifiez votre boîte mail ».
- **`VerifyEmailView.vue`** — le lien email pointe ici (`?id&hash&expires&signature`). Rappelle l'API en JSON. Si `token` : connexion auto puis redirection. Tout autre cas : message + mini-formulaire de renvoi.
- **`AddCharacterView.vue`** — sélecteur cascade royaume→province→ville (fetch `GET map`, ~300 villes en un seul payload), pseudo.
- **`ProfilView.vue`** — deux colonnes laptop : à gauche personnages en cartes (liseré vert validé / rouge en attente, identité, actions, étoile = personnage par défaut) ; à droite zone dangereuse (`<details>` replié, `DeleteAccountModal`).
- **`MonBureauView.vue`** — « Mon bureau », **sections une à la fois** via param `section` : Ma province (défaut), Prix des mines (si droit), Catégories d'inventaire. Menu de liens (`aria-current="page"`). Héros violet. **Catégories** : accordéon par inventaire (`InventoryLevelsAccordion`), deux colonnes (gestion 3/4, ordre d'export 1/4). ⚠️ `ProvinceView.vue` n'est plus routée. Section Ma province : historique des postes (résidence seule), avertissement permanent, export BBCode français fixe (`provinceBBcode.js`, dates 1474).
- **`SecurityGuet.vue`** — « Relevé de guet » (module « La Salle des gardes », brief `admin/content/brief-module-securite.md`, fil `admin/echanges/module-securite/`), public, sans compte : parse 2 listes (hier/aujourd'hui), diffe, génère BBCode français fixe. Parseur pur `modules/guetParser.js` (`parseGuet`, `diffGuet`) : pseudo = **premier mot** du champ (la noblesse suit après un espace, « Brennos de Lapin » — la forme « Pseudo, Titre » du brief n'existe pas dans les collages réels, tolérée en repli), réputation `nPR`, total « Liste des villageois (N) » **FR seulement** confronté aux lignes lues (alerte « collage peut-être tronqué »). Tests `guetParser.unit.test.js` (fixture réelle `Bug_ExportSorties.txt`). Liste d'hier pré-remplie via comfort data. ⚠️ Incohérence domaine lien affiché vs BBCode exporté.
- **`EconomyMines.vue`** — « Bilan des mines » (public) : colle un relevé, bilan par mine/semaine, BBCode. Semaine proposée : en cours sauf le lundi. Alerte de seuil **à l'écran seulement**. `MineRegistrySave` : enregistrement au registre pour le commissaire aux mines/bailli ; 409 → confirmation avec auteur remplacé. Brief `admin/content/brief-bilan-mines.md`.
- **`EconomyRegistry.vue`** — lecture du Registre des mines (commissaire, bailli, dirigeant). Bilans de mi-mandat et fin de mandat, jours sans données, historique des niveaux, relevés inscrits. Lien menu conditionné à `GET …/mine-registry`. Logique pure dans `modules/mineRegistry.js`.
- **Prix des mines** (lot 2, brief `admin/content/brief-prix-registre.md`) — `EconomyPrices.vue` (historique, ajout, correction), `MinePricesModal.vue`, `MinePriceForm.vue`. Le serveur sert les prix (`GET provinces/{id}/mine-prices`) ; `modules/minePrices.js` tire le jeu en vigueur par jour. `computePeriodBilan` accepte une fonction `jour => {prices, rate}`. Repli sur prix du relevé si aucun jeu en base. Dans le registre : un seul tableau navigable par semaine, export BBCode partagé (`mineBBcode.js`). ⚠️ Aucune règle côté site. Dates en année du jeu (1474), saisie comprise. Aides lot 3 : `EconomyMines.RegistryPage.HelpStep1…9`. Tests `mineModuleTexts.unit.test.js`.
- **Bilan des stocks** (ex-« Gestion des stocks », ex-« Inventaires » ; route, fichiers et namespace `EconomyInventory` inchangés) — `EconomyInventory.vue` : colle l'inventaire, range par catégorie (`inventoryCategories.js`), masque, exporte en BBCode (`inventoryBBcode.js`, français fixe). Catégories gérées dans Mon bureau (`InventoryCategoryPanel`). Ordre via `catConfig.order` → `orderCategoryKeys()`. Encart « Consignes au scribe ». Texte légal : `Legal.Privacy.Section3.Inventory*` etc., garde-fou `tests/legal/privacyInventory`.
- **Registre des stocks** (PR 3a, `EconomyInventoryRegistry.vue`, namespace `EconomyInventoryRegistry`) : lecture de l'historique d'une ville (maire) ou d'une province (commissaire au commerce, dirigeant) — niveaux = ceux de `scopes` (ville d'abord). **Gabarit du Registre des mines** : titre `Registre des stocks : {lieu}` et filet, « Dernière inscription : il y a N jours, le JJ/MM. » à droite (orange gras dès 2 jours, jour du jeu = `today` du serveur, bascule 04:00), deux colonnes — à gauche l'inscription ouverte (chevrons ◀ ▶ avant et après le titre, toujours là, grisés aux extrémités ; infos et nombre d'articles à côté du chevron de droite ; articles en colonnes compactes, il peut y en avoir des centaines), à droite la **comparaison de deux inscriptions** (`inventoryCompare.js`, tableau Article/Avant/Après/Écart, l'ancienne est « avant » quel que soit l'ordre ; sélecteur grisé tant qu'il n'y a qu'une inscription) au-dessus de « Inscriptions (n) » repliable. Coffre à l'ouverture (`ChestLoader`), cadenas (`AccessDenied`) sans poste de lecture ; menu : lien + aide « i ». 🔴 **Auteurs** : jamais celui d'une inscription en vigueur (`by_me` seulement) ; seul le rédacteur d'une inscription **remplacée** est nommé (`replaced`), conformément à la politique §3 ; **aucun stockage** (lecture seule, gardé par test). Le **Bilan des stocks** porte l'**inscription** : au niveau ville ou province (jamais personnel), bloc à droite — **champ date à gauche de la phrase « Cet inventaire sera inscrit au registre : {lieu}, le {date} »** (jour du jeu en cours par défaut ; de 14 jours du jeu avant l'entrée en fonction à aujourd'hui, `registry.backdate_min` / `today` du serveur ; saisi en année du jeu, envoyé en date réelle, `date` absent si c'est aujourd'hui ; lien « Aujourd'hui » pour y revenir), bouton « Inscrire au registre » (plume). 409 `registry_needs_confirmation` → confirmation qui nomme le rédacteur remplacé ; **409 `registry_before_mandate_locked` → message seul, « Fermer », jamais « Remplacer »** ; « déjà inscrit » = toast d'information (bleu). Pas de « rouvrir une inscription » : le Registre montre le passé. **PR 3b** (réponses de Cowork `12-reponse-cowork.md`) : sous l'inscription, trois lectures côte à côte (auto-fit, comme les mines), **toutes tirées des dates du serveur** (`mandate: { in_office_from, mid_at, end_at, predecessor_from }` — aucune règle de durée côté site) par le module pur `modules/inventoryRegistry.js` — **Prise de poste** (l'inventaire **hérité** = dernière inscription au plus tard le jour d'entrée en fonction, à défaut la première du mandat ; ce que d'**autres** ont inscrit dans la fenêtre « prédécesseurs », dates cliquables, personne n'est nommé), **Bilans de votre mandat** (mi-mandat et fin : `compareInventories(départ, arrivée)`, arrivée = dernière inscription **strictement avant** la date et après le départ ; avant la date « disponible le JJ/MM, dans N jours », **jamais un bilan partiel** ; « pas assez d'inscriptions » dit laquelle manque ; détail = `InventoryDiffTable`, partagé avec la comparaison libre), **Jours sans inscription** (périodes depuis l'entrée en fonction jusqu'à hier, sans seuil ni couleur). **Exports BBCode** (`use/useRegistryExport.js`, `modules/registryBBcode.js`, français fixe, catégories du niveau + options du joueur, rien d'enregistré) : une inscription (titre « Inventaire du {date} — {lieu} »), un bilan (« Bilan de mi-mandat, du … au … »), la comparaison libre. Page en **trois colonnes** au large (inscription, comparaison, inscriptions tout à droite), deux sur laptop, une en dessous. ⚠️ Un test sans bloc `mandate` ne couvre pas ces lectures : `EconomyInventoryRegistry.test.js` les rend avec un `mandate` (une variable de gabarit non définie avait blanchi la page).
- **La Balance des stocks** (4ᵉ module de la Salle des comptes, `EconomyInventoryBalance.vue`, route `economy-inventory-balance`, fil `admin/echanges/inventaire-comparaison/`, brief `brief-comparaison-inventaires.md`) : deux champs de collage (ancien, actuel), comparaison automatique (`modules/inventoryCompare.js`, pur : hausse/baisse/identique/nouveau/disparus + écart du trésor, comparaison sur les noms fusionnés par `resolveItems` — un nom tronqué se compare à lui-même), tableau groupé par catégories **de la Gestion des stocks** (niveau choisi), badge « Nouveau » **à l'écran seulement**, section « Disparus » barrée. « Récupérer » (action volontaire, `readLastPaste`) remplit « ancien » ; désactivé sans compte ni consentement « Préférences », sans ouvrir la bannière. « Confier au scribe » exporte le BBCode annoté (`modules/inventoryBalanceBBcode.js` : `[color=#16a34a]▲ +3`, `#dc2626` ▼ ; **rien** si la quantité est identique (jamais de tiret, Greg 19/11) ; disparus en section finale ; options d'export de la Gestion des stocks) et **n'enregistre rien**. 🔴 **Ne stocke RIEN** (ni cookie, ni stockage local, ni serveur) : gardé par `EconomyInventoryBalance.test.js` (espions + contrôle positif) et le texte `Legal.Data.InventoryBalance`. Namespace i18n `EconomyBalance`.
  - **Inventaires en base** (front #111) : `inventoryStore.js` gère serveur/navigateur (voir Stores).
  - **Icônes d'items** (phase 2) : interrupteur `SwitchButton` **réservé aux connectés** (`store.serverMode`). 🔴 **Ne commande que le BBCode** : aucune image chargée dans l'interface (IP du joueur → CDN Celsius exclu par `/legal/privacy` §6). `modules/itemIcons.js` construit l'URL (⚠️ **jumeau** de `ItemIcon::CDN_URL_PATTERN` backend), lots ≤ 200 noms et ≤ 6000 chars URL. Export avec `[img]` devant le texte dans le gras. Réglage personnel `exportShowIcons` (booléen, dans le document serveur). 🔴 **Sans compte, l'interrupteur n'existe pas** (les noms voyageraient au serveur). Tests : `itemIcons.unit.test.js`, `EconomyInventoryIcons.test.js`.
- **Module Animation** (`views/modules/animation/`) — première activité : **Décode le code**. Le serveur dit les activités ouvertes (`GET anim/activity-types`, sans jeton). ⚠️ **Aucune règle côté site** : refus affichés tels quels (`apiMessage`/`apiFieldErrors`). Spéc. : `admin/echanges/animation-coffres-scelles/12-synthese-cc.md`.
  - `MainAnimation.vue` : menu à gauche (un lien par activité ouverte, `TYPE_ROUTES`), `RouterView`, types chargés une fois et `provide`.
  - `AnimationHomeView.vue` : « La Salle des Jeux », une carte par activité (`ModuleHomeCards`, slot `visual-<clé>`).
  - Pages publiques : `DecodePublicView.vue` / `AnimPublicShell.vue` (menu, logo, pas de footer).
  - Organisateur : `DecodeActivityCard.vue` / `RewardsGridCard.vue` (**même composant** pour les deux modes via `gestures`).
  - Création : `AnimCreateForm.vue` (formulaire + récapitulatif, slot `extra` pour champs propres), `DecodeCreateForm` et `RewardsCreateForm` = enveloppes.
  - Entrée : `AnimStartPanel.vue` (six scénarios), `DecodeStartPanel`/`RewardsStartPanel` = enveloppes.
  - Écrans sans compte : `Anim{CreateAnonymous,Manage,Reset,ConfirmEmail}View.vue` partagés, les `Decode*View`/`RewardsGrid*View` = enveloppes d'une ligne.
  - `use/animApi.js` (socle API partagé), `use/useAnimKind.js` (`kt('Section.Clé')` lit le namespace du type puis le fallback commun).
  - **`animKinds.js`** (`ANIM_KINDS`) : déclarer un type = une entrée. Voir `admin/strategies/animation.md`.
- **Grille des lots** (`rewards`) : `RewardsGridBoard.vue` (plateau : cases numérotées, ✕ réclamée, rétrécit au-delà de 8/12 colonnes), `RewardsGridAside.vue` (lots attribués, exports BBCode). 🔴 **Le tirage passe directement à `confirmed`** (pas de `drawed`). Pas de page publique avant tirage (404). Bornes de dimensions au serveur. Email sous la clé `email`.
- **`MainCompany.vue`** — squelette vide, placeholder i18n.

## Composants (`src/components/`)

- **`CookiesBanner.vue`** / **`CookiesModal.vue`** — bannière + modale, montées une fois dans `App.vue`. « Refuser » et « Accepter » **même style** (exigence CNIL). Gardé par test.
- **`SwitchButton.vue`** — `role="switch"` + `aria-checked`, `disabled` natif, relié à `<label for>`.
- **`AppFooter.vue`** — footer légal, hors `welcome`. « Outil non officiel » **partout**. « Gérer mes préférences » sur `meta.public` seulement.
- **`LoadingOverlay.vue`** — overlay plein écran (navigation + API), piloté par `useNavigationLoading`. Contextes `office` (portique aux torches), `chest`, `api` (parchemin déroulé). Couleur de module via `navigationAccent`. `role="status"` + `aria-live`.
- **`ChestLoader.vue`** — chargement interne d'une page, **dans la carte**. Rien avant 150 ms, coffre qui s'ouvre, puis contenu. Échec/> 10 s : coffre refermé + « Réessayer ». Durées dans `chestTiming.js` (instantanées en test).
- **`AccessLoader.vue`** — attente en ligne d'un droit (cadenas + squelette).
- **`useSharedResource.js`** + **`useMineAccess.js`** — ressource par clé avec `ready`, appels simultanés partagés, pas de cache.
- **`AnnouncementBanner.vue`** + **`useAnnouncement.js`** — bandeau d'annonce sur `HomeView`, défile 3 passes puis reste à plat. `GET announcements/current` (public). Pause/relance. En mouvement réduit : à plat d'emblée. `aria-hidden` sur la piste mobile, copie `sr-only`. Plaque d'azur cerclée de laiton, médaillon « Oyez ». Tests `announcementBanner.test.js`.
- **`NavBar.vue`** — header `/app/*`. Contient `SelectorMenu`, `SelectorCharacter`, déconnexion, préférences, lien admin (si `isAdmin`). Logo horizontal (écu seul sous `tablet`). Boutons `odc-btn odc-btn--rect` 44 px.
- **`SelectorCharacter.vue`** — bascule de personnage session, **listbox APG W3C** (clavier complet). Coche = session, étoile = défaut. Liseré orange-700 (5,18:1).
- **`DeleteAccountModal.vue`** — deux étapes (art. 17 RGPD), redemande le mot de passe. Émet `confirm(password, { onError })`.
- **`HelpModal.vue`** — aide contextuelle générique (props `show`/`title`/`steps`).
- **`CityCascadeSelect.vue`** — cascade royaume→province→ville. Prop `stopAt="province"`.
- **`CharacterMandates.vue`** — mandats du Profil (badges lisibles sans couleur, actions, historique replié). `MandateRequestModal`, `DeclareOfficeModal` (focus piégé via `useDialogFocus`).
- **`NavMenu.vue`** — menu circulaire X3 (anneau laiton, biseau, 5 éléments). Couleurs dans `navMenuPalette.js` (source unique). `aria-current="page"` exact pour Accueil. 88 px (72 sous `tablet`).
- **`SelectorMenu.vue`** = `SelectorTheme` + `SelectorLanguage`.

## i18n (`src/locales/fr.json` + `en.json`)

Couverture complète. **Une seule instance i18n** (`src/i18n/index.js`), utilisée par composants et hors contexte (`Validators.js`, `authStore.js` via `i18n.global.t`). ⚠️ Il y en avait **deux** avant le 20/09/2026, ne pas réintroduire.

**Français embarqué, anglais chargé à la demande** (chunk). `setLocale()` charge puis bascule, **ne rejette jamais**. Langue appliquée dans `main.js` **avant `app.mount()`**. `fallbackLocale: 'fr'`. Parité gardée par `i18n-parity.unit.test.js`.

Namespaces : `Cookies`, `Common`, `Profil`, `Validation`, `Welcome`, `Home`, `NotFound`, `Auth`, `Login`, `Register`, `NavBar`, `NavMenu`, `Security`, `Economy`, `EconomyBalance`, `EconomyMenu`, `EconomyInventoryRegistry`, `EconomyMines`, `Animation`, `Announcement`, `Company`, `Legal`, `Maintenance` + clés plates `username`/`password`/`email`/`confirmation`.

⚠️ **Pièges** : `@` littéral dans JSON casse la compilation ; `tm()` sans `rt()` = AST à l'écran.

## Modules transverses (`src/modules/`) et autres

- **`mineParser.js`** — logique pure : parsing relevé, bilan, semaine, seuils. 🔴 **Décalage d'un jour** (production[D], heures[D+1]). Fusion sur `mineKey` (nœud), jamais sur numéro. `todayIso()` = date de Paris. **Bilingue** (lit FR ou EN selon le texte collé). 🔴 **Aucune conversion d'unité**.
- **`gameCalendar.js`** — 2026 → 1474, transverse. ⚠️ **Jumeau** de `GameCalendar.php` backend, gardé par `gameCalendarTwin`.
- **`playerDates.js`** — **seule déclaration** de l'année par champ (`game` → 1474, `real` → 2026).
- **`kingdomTranslations.js`** — traduction FR des noms de royaumes.
- **`data/whatsNew.json`** — chronique de l'Office, scope public/privé.
- **`assets/style.css`** — Tailwind `@layer components`. Plus aucune classe `.btn*` (toutes en `odc-*` depuis 17/10/2026). `.page-card` = carte des pages `/app/*`. ⚠️ Ne jamais styler `main` : `App.vue` porte l'unique `<main>`. `.page-container` sans couleur de texte.
- **`assets/odc-buttons.css`** — boutons relief 3D, classes `odc-btn` + `odc--{couleur}`. Trois niveaux : **signature** (laiton complet, menu M1), **standard** `--soft` (actions principales), **discret** `--quiet` (Annuler). Garde-fou contrast `odc-buttons-contrast.unit.test.js`.
- **`assets/base.css`** — jetons alignés sur `CHARTE-GRAPHIQUE.md`. Focus clavier deux tons (or + brun). Sélection or sur quasi-noir.
- 🔴 **Mouvement (WCAG 2.2.2)** — règle globale `prefers-reduced-motion: reduce` dans `base.css`. Jamais `animate-bounce`/`spin`/`ping`/`pulse` dans une vue. Budget 3 s, plafond 5 s. Gardé par `motion.unit.test.js`.
- **`useNavigationLoading.js`** — état partagé de l'overlay (délai 150 ms, contextes). `trackApiCall(promesse, { context, navigates })` : `navigates: true` tient l'écran du clic à l'arrivée.
- **Mode maintenance** — 503 `{message: "maintenance"}` → `useMaintenance.js` → `MaintenanceNotice.vue` (page embarquée, aucun appel API). Sonde toutes les 30 s. 🔴 **Sonde de démarrage** (`maintenanceProbe.js`, avant montage) : `GET auth/me` sans jeton (401 immédiat), bornée à 2,5 s, **jamais bloquante** ; **arrivée sur `/` (portail d'accueil) : aucun loader** (`cover: false`, main.js), la sonde tourne sans recouvrir. Bypass : `/maintenance/<secret>` → `sessionStorage` → header `X-Maintenance-Bypass`. Accès admin depuis la page maintenance (essai du secret auprès de l'API). 🔴 **Le secret n'est jamais dans `.env` frontend** (garde-fou de test). Tests `maintenance.test.js`.
- **`goBackOrWelcome.js`** — retour sûr (welcome si pas d'historique).
- **`.htaccess`** — SPA fallback (exclut `/assets/`, `/.well-known/`, `/api/`), cache immutable assets, `no-cache` index.html. **Origine canonique** : www et http → `https://officedescoffres.creacube.be`. Gardes-fous + sonde prod dans `deploy.yml`.
- **`public/images/email/logo-horizontal.png`** — logo emails backend, PNG 480 px, ne pas renommer.
- **`scripts/`** — `vite-bundle-budget.mjs` (budget taille), `docs-sync-check.sh` (CI), `whatsNewAnnounce.mjs` (Discord).

## Tests (`frontend/tests/`)

Décompte à jour dans `README.md` (source unique). Structure dans `docs/TESTS.md` : dossier = domaine (`auth/`, `cookies/`, `eco/`, `legal/`, `mandates/`, `province/`, `security/`, `common/`, `enforcement/`, `fixtures/`). Toute vue `useI18n()` → plugin `createI18n({ legacy: false })` dans `global.plugins` du test.

## Contraintes projet

- Frontend **FR + EN obligatoire** sur toute vue/composant, y compris existant.
- Ne jamais casser le design existant (NavMenu circulaire, palette, animations).
- Cookies : catégorie « Préférences » uniquement (dégradable), aucun tracking — voir
  `admin/strategies/cookies.md`.
