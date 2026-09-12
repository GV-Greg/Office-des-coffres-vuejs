# Architecture technique — Frontend (Vue 3)

> Référence structurelle chargée automatiquement (voir `CLAUDE.md` racine). Mise à jour :
> 12/09/2026. Vérifier le code avant de citer un détail précis si ce fichier date de plus de
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
| `/legal/cookies` | `legal-cookies` | — (`meta.public`) |
| `/legal/privacy` | `legal-privacy` | — (`meta.public`) |
| `/legal/mentions` | `legal-mentions` | — (`meta.public`) |
| `/app/` | `home` | — |
| `/app/eco` | `economy` | redirige vers `economy-mines` (enfant `mines`) |
| `/app/secu` (enfant `/guet` → `security-guet`) | `security` | — |
| `/app/company` | `company` | — |
| `/app/anim` | `animation` | — |
| `/app/profil` | `profil` | `redirectToHomeIfNotLoggedIn` |
| `/app/character/new` | `character-new` | `redirectToHomeIfNotLoggedIn` |
| `/:pathMatch(.*)*` | — | 404.vue |

Les deux guards sont **exportés** nommément (en plus du router en export par défaut) pour être
testables isolément (`tests/auth/`). `redirectToHomeIfNotLoggedIn` vérifie `authStore.isLoggedIn`
**puis** la validité réelle du token côté serveur (`checkAuth()`) — un token local peut survivre à
une session expirée ou à un compte supprimé. `redirectToHomeIfLoggedIn` est son symétrique : un
compte déjà connecté qui atterrit sur `/login` ou `/register` part directement sur `/app/`.
`WelcomeView` (`/`) en est volontairement exemptée (voir `docs/DECISIONS.md`).

**Hooks globaux de navigation** : `beforeEach`/`afterEach`/`onError` pilotent `LoadingOverlay.vue`
via `useNavigationLoading` — contexte `chest` pour les modules « Coffres X » (`economy`,
`economy-mines`, `security`, `security-guet`, `animation`), `office` pour tout le reste.

## Stores Pinia (`src/stores/`)

- **`authStore.js`** (style setup, `defineStore('auth', () => {...})`) — couple de tokens Passport.
  State : `user` (localStorage `auth_user`), `token` = access token (localStorage `auth_token`, en
  **string brute**, pas JSON), `refreshToken` (**localStorage si « Rester connecté » est coché,
  sessionStorage sinon** — `auth_refresh_token`, préférence dans `auth_remember_me`).
  `user.characters` est une **liste** (un compte peut avoir 0, 1 ou N personnages).
  Getters : `isLoggedIn`, `getUser`, `getToken`, `getCharacters`, `hasCharacters`, `isAdmin`
  (depuis `user.is_admin`, exposé par l'API — sert au lien vers le panneau admin Blade),
  `activeCharacter`/`defaultCharacter`.
  Actions : `register` (email+password uniquement, ne connecte pas — voir flux vérification email
  ci-dessous), `resendVerification`, `login` (par **email**, avec `remember_me`), `refreshAccessToken`,
  `logout`, `checkAuth` (auto-appelée si token présent au démarrage du store), `createCharacter`,
  `updateCharacterCity` (PATCH `characters/{id}`, resynchronise via `checkAuth()`),
  `setActiveCharacter`/`setDefaultCharacter`, `setToken`/`setUser`.
  **Deux niveaux de personnage** : `defaultCharacter` est le choix persistant (comfort data
  `default_character_id`, modifiable depuis le Profil) appliqué à chaque connexion ;
  `activeCharacter` est le contexte de la session en cours (`SelectorCharacter.vue`), il n'écrase
  jamais le choix par défaut.
  **Intercepteur axios 401 avec mutex** enregistré ici (pas dans `api.js`) : un access token
  expiré déclenche un seul appel à `auth/refresh` même si plusieurs requêtes échouent en
  parallèle, puis rejoue la requête d'origine ; `auth/login` et `auth/refresh` en sont exclus pour
  ne pas boucler, et un échec du refresh purge la session avec un toast « session expirée ».
- **`cookieStore.js`** (style options) — modèle de consentement nommé et extensible :
  `consent: { preferences: bool, choiceMadeAt: number }` (clé `cookie-consent`, migration
  silencieuse depuis l'ancien format `cookie-comply` au chargement, sans nouvelle sollicitation
  utilisateur). Une seule catégorie visible côté UI, **« Préférences »** — pas de catégorie
  « Session » : le jeton d'auth est strictement nécessaire au service demandé (login), exempté
  de consentement (voir `admin/strategies/cookies.md`). Getters `hasUserChoice`/
  `hasAcceptedPreferences`. `comfortData` : bag générique par module (thème, langue, saisies —
  ex. `guet_last_list`, voir `SecurityGuet.vue`) — `getComfortData(key, fallback)` /
  `setComfortData(key, value)`, lecture/écriture en mémoire toujours possible (dégradation
  gracieuse), persistance `localStorage['comfort-cookies']` conditionnée à
  `hasAcceptedPreferences`. `clearConsentedStorage()` purge uniquement les préfixes
  `cookie-*`/`comfort-*` (jamais `auth_*`). `isPreferencesModalOpen` +
  `openPreferencesModal()`/`closePreferencesModal()` pilotent la modale (`CookiesBanner.vue`
  la monte, `NavBar.vue` et `ProfilView.vue` l'ouvrent) sans état local par composant. Palier 3
  "compte" (données communautaires partagées, ex. future liste rouge du module Douane) reste
  hors scope — nécessiterait une vraie table backend, pas du cookie.

## Services

- **`src/api.js`** — seul client HTTP du projet (`http`, instance Axios). Le bearer token est
  attaché manuellement par appel ; l'unique intercepteur (401 → refresh) est enregistré par
  `authStore.js`, pas ici. Exporte aussi `ADMIN_ORIGIN`, dérivé de `VITE_API_ENDPOINT_*` — le
  panneau admin Blade est servi par la même origine que l'API.
- **`src/services/`** n'existe plus (`http-common.js`, `auth-header.js`, `auth.service.js`,
  `user.service.js`, `anim.service.js` : code mort, jamais importé). Toute doc ou tâche qui les
  mentionne est périmée — pour étendre les appels API, passer par `api.js`.

## Vues (`src/views/`)

- **`WelcomeView.vue`** — landing (cadenas animé), `SelectorMenu` en haut à droite, intro roleplay
  et **footer propre** fusionnant le disclaimer « outil non officiel », le copyright et les liens
  légaux — seule page exemptée d'`AppFooter` (voir `App.vue`).
- **`HomeView.vue`** — `NavMenu` + deux rubriques alimentées par `src/data/whatsNew.json` :
  « Chroniques de l'Office » (entrées `type: "feature"`) et « Le Registre des Réparations »
  (`type: "fix"`), en deux colonnes, les entrées `scope: "private"` n'apparaissant que connecté.
  Bouton « Se connecter » si déconnecté.
- **`404.vue`** — stub minimal, pas de navigation (voir « Finitions transversales » dans
  `roadmap.md`).
- **`legal/CookiesPolicyView.vue`**, **`legal/PrivacyPolicyView.vue`**,
  **`legal/MentionsLegalesView.vue`** — pages légales publiques, FR + EN, contenu en i18n sous le
  namespace `Legal` (clés de contact partagées dans `Legal.Common.Contact.*`). ⚠️ Les listes y
  sont rendues avec `tm()` **+ `rt()`** : `tm()` seul renvoie des AST compilés, affichés tels
  quels à l'écran mais invisibles en test (les mocks ne sont pas précompilés).
- **`auth/LoginView.vue`** — connexion par **email** (jamais par pseudo), `SelectorMenu`, checkbox
  « Rester connecté » (préférence mémorisée entre visites via la comfort data
  `remember_me_preference`) et lien « Entrez sans compte » vers `/app/`. Bandeau "email non
  vérifié" + bouton de renvoi
  (`authStore.resendVerification`). Comparaison `error_message.value === 'Email non vérifié.'`
  **volontairement pas traduite** : c'est le message brut renvoyé par l'API (backend français
  uniquement), pas du texte UI. Après connexion réussie, redirige vers `/app/character/new` si le
  compte n'a aucun personnage, sinon `/app/`.
- **`auth/RegisterView.vue`** — ne demande que email + mot de passe + confirmation (pseudo/ville
  déplacés vers `AddCharacterView`). Après soumission, affiche
  un écran "vérifiez votre boîte mail" (`data-testid="check-email-message"`) au lieu de connecter
  ou rediriger — le compte n'est utilisable qu'après confirmation du lien reçu par email.
- **`auth/VerifyEmailView.vue`** (route `/verify-email`) — lit `token`/`error`
  en query string (le backend y redirige après validation du lien signé). Si `token` : connexion
  automatique (`setToken` + `checkAuth`) puis redirection vers `/app/character/new` (aucun
  personnage) ou `/app/profil`. Si `error` : message + mini-formulaire de renvoi.
- **`auth/AddCharacterView.vue`** (route `/app/character/new`, gardée par
  `redirectToHomeIfNotLoggedIn`) — sélecteur royaume → province → ville en cascade (fetch
  `GET map` au montage, ~300 villes chargées en un seul payload, pas de pagination), pseudo,
  soumission via `authStore.createCharacter`. Accessible aussi depuis `ProfilView` pour ajouter un
  personnage supplémentaire à un compte qui en a déjà.
- **`auth/ProfilView.vue`** — affiche la **liste** des personnages du compte
  (`authStore.getCharacters`) en cartes à liseré latéral (vert validé / rouge en attente), avec
  leur résidence (ville → province → royaume, noms de royaumes traduits par
  `kingdomTranslations.js`), un bouton « Modifier la résidence » (`updateCharacterCity` — repasse
  le personnage en attente de validation admin), le choix du personnage **à la connexion** (badge
  couronne sur l'avatar), un bouton « Gérer mes préférences » (cookies, second point d'accès avec
  `NavBar.vue`) et un lien vers `AddCharacterView`.
- **`modules/security/MainSecurity.vue`** — shell + lien vers `security-guet`.
- **`modules/security/SecurityGuet.vue`** — module public (pas de compte requis), pas juste un
  outil isolé : c'est le futur pendant public du module **Douane** (privé, compte requis,
  fonctionnalité pas encore spécifiée — étendra le Guet avec une liste rouge par province
  partagée entre joueurs, donc future donnée backend, pas un cookie). Parse 2 listes villageois
  (hier/aujourd'hui) collées depuis le jeu (tabulation = ligne valide, filtre le préambule
  descriptif), diffe pour calculer entrées/sorties, génère du BBcode à copier sur le forum du
  jeu. **Le BBcode généré reste en français fixe** (contenu de forum francophone, indépendant de
  la langue de l'UI) — seuls les labels/boutons autour sont traduits. La
  liste "d'hier" est pré-remplie automatiquement à la visite suivante via
  `cookieStore.getComfortData`/`setComfortData` (catégorie `comfort`) — dégradation gracieuse
  sans consentement (rien n'est mémorisé, mais l'outil reste utilisable en resaisissant les deux
  listes). ⚠️ Domaine incohérent entre le lien affiché (`renaissancekingdoms.com`) et le lien
  inséré dans le BBcode exporté (`lesroyaumes.com`) — jamais confirmé avec Greg, à vérifier si ça
  pose problème en usage réel.
- **`modules/economy/MainEconomy.vue`** — shell + lien vers `EconomyMines.vue`.
- **`modules/economy/EconomyMines.vue`** — « Bilan des mines » (public, pas de compte requis) :
  colle un relevé de mines exporté du jeu, calcule le bilan par ressource sur une semaine
  sélectionnable, génère du BBcode. Sélecteur de semaine calé sur `modules/gameCalendar.js`
  (dates réelles en interne, année de jeu 2026→1474 seulement à l'affichage). `HelpModal.vue`
  pour l'aide contextuelle. Futur pendant privé (backend, compte requis) : « Registre des
  mines », pas encore développé.
- **`modules/animation/MainAnimation.vue`**, **`modules/company/MainCompany.vue`** — squelettes
  vides, placeholder "Test" i18n minimal (`Common.Placeholder`). Voir `roadmap.md` pour ce qui est
  prévu.

## Composants (`src/components/`)

- **`AppFooter.vue`** — footer légal unique, monté dans `App.vue` **hors du cadre de contenu** de
  chaque page, sur toutes les routes sauf `welcome` (qui a le sien, fusionné avec son disclaimer).
  Liens vers les trois pages légales ; « Gérer mes préférences » et la mention « outil non
  officiel » n'apparaissent que sur les routes `meta.public` (sur `/app/*`, le bouton préférences
  est déjà dans la `NavBar`).
- **`LoadingOverlay.vue`** — overlay plein écran pendant la navigation, monté dans `App.vue` et
  piloté par les hooks du router via `useNavigationLoading`. Icône et texte selon le contexte
  (pavillon « Ouverture de l'office… » / coffre « Ouverture du coffre… »), `role="status"` +
  `aria-live`, `prefers-reduced-motion` respecté.
- **`NavBar.vue`** — header `/app/*` (named view `Nav`, donc partagé par home, éco, sécu, company,
  anim, profil). Contient `SelectorMenu`, `SelectorCharacter`, le bouton de déconnexion, le bouton
  « Gérer mes préférences » (cookies) à côté d'Accueil, et le lien vers le panneau d'administration
  Blade (`ADMIN_ORIGIN`), visible seulement si `authStore.isAdmin`.
- **`SelectorCharacter.vue`** — bascule de personnage **pour la session en cours**, monté
  directement dans `NavBar.vue` (jamais dans `SelectorMenu`, partagé avec les pages publiques) et
  visible seulement si connecté avec plus d'un personnage.
- **`HelpModal.vue`** — modale d'aide contextuelle générique (props `show`/`title`/`purpose`/
  `overview`/`steps`, emit `close`), réutilisable par n'importe quel module. Consommée par
  `EconomyMines.vue`.
- **`forms/CityCascadeSelect.vue`** — sélecteur royaume → province → ville en cascade, alimenté
  par `GET map`.
- **`NavMenu.vue`** — menu circulaire (Accueil/Éco/Sécu/Anim/Profil). Labels réactifs au
  changement de langue (`computed()` + `t()`, jamais un tableau JS figé).
- **`SelectorMenu.vue`** = `SelectorTheme` + `SelectorLanguage` uniquement. Présent sur
  Welcome/Login/Register et sur toutes les pages `/app/*` via `NavBar`.
- **`buttons/*`**, **`forms/*`** — génériques, texte/label passés en props par l'appelant (donc
  pas de texte en dur *dans* ces composants ; le texte en dur était côté appelant, corrigé).

## i18n (`src/locales/fr.json` + `en.json`)

**Couverture complète** — tout texte UI visible passe par vue-i18n, sans
exception hors BBcode `SecurityGuet` (voir plus haut) et le nom de marque `Common.SiteName`
(identique dans les deux langues, routé par i18n quand même pour cohérence). Config live dans
`main.js` (`legacy: false`, messages auto-générés par `@intlify/unplugin-vue-i18n` depuis
`src/locales/**`). Une seconde instance i18n standalone (`src/i18n/index.js`) existe pour
`Validators.js` (hors contexte composant, ne peut pas utiliser `useI18n()`).

Namespaces principaux : `Cookies`, `Common`, `Profil`, `Validation`, `Welcome`, `Home`,
`NotFound`, `Auth` (partagé Login/Register), `Login`, `Register`, `NavBar`, `NavMenu`,
`Security`, `Economy`, `Animation`, `Company`, `Legal` (pages légales + footer) + clés plates
`username`/`password`/`email`/`confirmation` (réutilisées à la fois comme labels de champs et pour
l'interpolation des messages de validation, ex. `Validation.Required`).

⚠️ **Deux pièges vue-i18n déjà rencontrés sur ce projet** : un `@` littéral dans une valeur de
`fr.json`/`en.json` (adresse email, mention) casse la compilation — vérifier au `npm run build` ;
et `tm()` sans `rt()` affiche des AST compilés à l'écran, invisibles en test.

`src/modules/Validators.js` + `src/use/useFormValidation.js` — génèrent les messages d'erreur
inline (requis/min/max/email/confirmation).

## Modules transverses (`src/modules/`) et autres

- **`mineParser.js`** — logique pure (testée isolément, sans DOM) : parsing du relevé de mines
  collé depuis le jeu, calcul du bilan par ressource, filtrage/complétude par semaine. Consommé
  par `EconomyMines.vue`.
- **`gameCalendar.js`** — table d'ancrages année réelle ↔ année de jeu (2026 → 1474), transverse
  à tout module manipulant des dates de jeu (Économie aujourd'hui, futur Guet/Douane).
- **`kingdomTranslations.js`** — traduction FR des noms de royaumes (l'API renvoie les noms dans
  leur langue d'origine), alignée sur `lang/fr.json` côté backend.
- **`data/whatsNew.json`** — entrées de la « Chronique de l'Office » (`HomeView.vue`), scope
  public/privé par entrée.
- **`assets/style.css`** — styles globaux Tailwind (`@layer components`). Charte de boutons
  dégradée `.btn-grad-{couleur}` pour toute action ; les classes plates `.btn-slate`/
  `.btn-yellow`/`.btn-rose`/`.btn-teal` restent nécessaires telles quelles — consommées
  dynamiquement par `NavMenu.vue` (menu circulaire), ne jamais les modifier sans vérifier cet
  usage.
- **`use/useNavigationLoading.js`** — état partagé de l'overlay de navigation (délai anti-flash de
  150 ms, contexte `office`/`chest`). **`use/useFormValidation.js`** — messages d'erreur inline
  des formulaires, avec `modules/Validators.js`.
- **`modules/goBackOrWelcome.js`** — retour arrière sûr (revient à `welcome` quand il n'y a pas
  d'historique).
- **`public/.htaccess`** — déployé tel quel dans `dist/` : fallback SPA (`mod_rewrite`),
  `Cache-Control: public, max-age=31536000, immutable` sur `/assets/*.js|css`, `no-cache` sur
  `index.html`. ⚠️ À traiter avec la stratégie `admin/strategies/performance.md`.
- **`scripts/`** (hors bundle) — `vite-bundle-budget.mjs` + `checkBundleBudget.mjs` (budget de
  taille : le brotli bloque le build, le brut avertit), `docs-sync-check.sh` (CI : un seul
  décompte de tests dans le repo, `ARCHITECTURE.md` pas périmée de plus de 30 jours sur le dernier
  commit `src/`), `whatsNewAnnounce.mjs` (annonces Discord à partir du diff de `whatsNew.json`).

## Tests (`frontend/tests/`)

Décompte à jour dans `README.md` (source unique, pas dupliqué ici — `npm test` lance la suite en
one-shot, le mode watch vit sous `npm run test:watch`). Structure détaillée dans `docs/TESTS.md` :
dossier = domaine (`auth/`, `cookies/`, `eco/`, `legal/`, `security/`, `common/`, `enforcement/`,
`fixtures/`). Toute vue utilisant `useI18n()` doit recevoir un
plugin `createI18n({ legacy: false, ... })` dans `global.plugins` du test (miroir de la config
`main.js`) — sinon `useI18n()` lève une erreur au montage.

## Contraintes projet

- Frontend **FR + EN obligatoire** sur toute vue/composant, y compris existant.
- Ne jamais casser le design existant (NavMenu circulaire, palette, animations).
- Cookies : catégorie « Préférences » uniquement (dégradable), aucun tracking — voir
  `admin/strategies/cookies.md`.
