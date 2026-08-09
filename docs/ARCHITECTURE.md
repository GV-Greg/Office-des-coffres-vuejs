# Architecture technique — Frontend (Vue 3)

> Référence structurelle chargée automatiquement (voir `CLAUDE.md` racine). Mise à jour :
> 09/08/2026. Vérifier le code avant de citer un détail précis si ce fichier date de plus de
> quelques semaines.

Vue 3 (Composition API, `<script setup>`) + Vite 6 + Tailwind 3 + Pinia 2 + Vue Router 4 +
vue-i18n 9 + notivue (toasts) + oh-vue-icons. Parle au backend Laravel via `src/api.js` (Axios,
`VITE_API_ENDPOINT_DEV`/`_PROD`).

## Router (`src/router/index.js`)

`createWebHistory`. Routes `/app/*` en **named views** (`Nav` = `NavBar.vue` partagé, lazy +
`default` = la vue). Routes top-level (`welcome`/`login`/`register`) importées eagerly.

| Path | Name | Guard |
|---|---|---|
| `/` | `welcome` | — |
| `/login` | `login` | — |
| `/register` | `register` | — |
| `/verify-email` | `verify-email` | — (nouveau, 03/08/2026) |
| `/app/` | `home` | — |
| `/app/eco` | `economy` | — |
| `/app/secu` (enfant `/guet` → `security-guet`) | `security` | — |
| `/app/company` | `company` | — |
| `/app/anim` | `animation` | — |
| `/app/profil` | `profil` | `redirectToHomeIfNotLoggedIn` |
| `/app/character/new` | `character-new` | `redirectToHomeIfNotLoggedIn` (nouveau, 03/08/2026) |
| `/:pathMatch(.*)*` | — | 404.vue |

`redirectToHomeIfNotLoggedIn` est **exportée** (nommée, en plus du router en export par défaut)
pour être testable isolément (`tests/router/redirectToHomeIfNotLoggedIn.test.js`). Vérifie
`authStore.isLoggedIn` — a été cassée pendant longtemps (référençait `getIsLoggedIn`, inexistant,
donc redirigeait toujours vers `/login` même connecté), corrigé le 03/08/2026.

## Stores Pinia (`src/stores/`)

- **`authStore.js`** (style setup, `defineStore('auth', () => {...})`) — state `user`/`token`
  (localStorage `auth_user`/`auth_token`, `auth_token` en **string brute**, pas JSON).
  `user.characters` est une **liste** (un compte peut avoir 0, 1 ou N personnages). Getters :
  `isLoggedIn`, `getUser`,
  `getToken`, `getCharacters`, `hasCharacters` (remplacent `getPseudo`/`getIsValidated`,
  supprimés). Actions : `register` (email+password uniquement, ne connecte plus — voir flux
  vérification email ci-dessous), `resendVerification`, `login` (par **email**, plus par pseudo),
  `logout`, `checkAuth` (auto-appelée si token présent au démarrage du store), `createCharacter`
  (POST `characters`, puis re-synchronise via `checkAuth()`), `setToken`/`setUser`. Pas de notion
  de rôles côté frontend (n'existe que côté admin Blade).
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

- **`src/api.js`** — seul client HTTP réellement utilisé (importé par `authStore.js`). Instance
  Axios simple, pas d'intercepteur — le bearer token est attaché manuellement par appel.
- **`src/services/`** a existé (`http-common.js`, `auth-header.js`, `auth.service.js`,
  `user.service.js`, `anim.service.js`) mais était du code mort, non importé nulle part —
  supprimé le 09/08/2026 (item #15 de `admin/strategies/cookies.md`). Si besoin d'étendre les
  appels API, passer par `api.js`.

## Vues (`src/views/`)

- **`WelcomeView.vue`** — landing, `SelectorMenu` en haut à droite.
- **`HomeView.vue`** — placeholder "en construction", `NavMenu`.
- **`404.vue`** — stub minimal, pas de navigation (roadmap Phase 6).
- **`auth/LoginView.vue`** — connexion par **email** depuis le 03/08/2026 (avant : par pseudo).
  `SelectorMenu` ajouté le 03/08/2026 (absent avant). Bandeau "email non vérifié" (avant : "compte
  non validé", devenu obsolète avec les comptes multi-personnages) + bouton de renvoi
  (`authStore.resendVerification`). Comparaison `error_message.value === 'Email non vérifié.'`
  **volontairement pas traduite** : c'est le message brut renvoyé par l'API (backend français
  uniquement), pas du texte UI. Après connexion réussie, redirige vers `/app/character/new` si le
  compte n'a aucun personnage, sinon `/app/`.
- **`auth/RegisterView.vue`** — ne demande que email + mot de passe + confirmation (pseudo/ville
  déplacés vers `AddCharacterView`). Après soumission, affiche
  un écran "vérifiez votre boîte mail" (`data-testid="check-email-message"`) au lieu de connecter
  ou rediriger — le compte n'est utilisable qu'après confirmation du lien reçu par email.
- **`auth/VerifyEmailView.vue`** (nouveau, 03/08/2026, route `/verify-email`) — lit `token`/`error`
  en query string (le backend y redirige après validation du lien signé). Si `token` : connexion
  automatique (`setToken` + `checkAuth`) puis redirection vers `/app/character/new` (aucun
  personnage) ou `/app/profil`. Si `error` : message + mini-formulaire de renvoi.
- **`auth/AddCharacterView.vue`** (nouveau, 03/08/2026, route `/app/character/new`, gardée par
  `redirectToHomeIfNotLoggedIn`) — sélecteur royaume → province → ville en cascade (fetch
  `GET map` au montage, ~300 villes chargées en un seul payload, pas de pagination), pseudo,
  soumission via `authStore.createCharacter`. Accessible aussi depuis `ProfilView` pour ajouter un
  personnage supplémentaire à un compte qui en a déjà.
- **`auth/ProfilView.vue`** — affiche la **liste** des personnages du compte
  (`authStore.getCharacters`), chacun avec son badge validé/en attente, un bouton « Gérer mes
  préférences » (cookies, second point d'accès avec `NavBar.vue`), plus un lien vers
  `AddCharacterView`.
- **`modules/security/MainSecurity.vue`** — shell + lien vers `security-guet`.
- **`modules/security/SecurityGuet.vue`** — module public (pas de compte requis), pas juste un
  outil isolé : c'est le futur pendant public du module **Douane** (privé, compte requis,
  fonctionnalité pas encore spécifiée — étendra le Guet avec une liste rouge par province
  partagée entre joueurs, donc future donnée backend, pas un cookie). Parse 2 listes villageois
  (hier/aujourd'hui) collées depuis le jeu (tabulation = ligne valide, filtre le préambule
  descriptif), diffe pour calculer entrées/sorties, génère du BBcode à copier sur le forum du
  jeu. **Le BBcode généré reste en français fixe** (contenu de forum francophone, indépendant de
  la langue de l'UI) — seuls les labels/boutons autour sont traduits. Depuis le 03/08/2026, la
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
  vides (Phase 4/5), placeholder "Test" i18n minimal (`Common.Placeholder`).

## Composants (`src/components/`)

- **`NavBar.vue`** — header `/app/*`. `SelectorMenu` dans un emplacement qui était vide
  (`justify-self-end`) — couvre d'un coup toutes les pages `/app/*` (home, éco, sécu, company,
  anim, profil) puisqu'elles partagent toutes ce composant via la named view `Nav`. Bouton
  « Gérer mes préférences » (cookies) à côté d'Accueil — premier essai avec un footer global
  retiré sur retour direct de Greg, ce placement est le choix retenu.
- **`NavMenu.vue`** — menu circulaire (Accueil/Éco/Sécu/Anim/Profil). Labels **réactifs au
  changement de langue** depuis le 03/08/2026 (`computed()` + `t()` — avant, tableau JS figé en
  dur, ne suivait pas un changement de locale à chaud).
- **`SelectorMenu.vue`** = `SelectorTheme` + `SelectorLanguage`. Présent maintenant sur
  Welcome/Login/Register + toutes les pages `/app/*` via `NavBar` — vérifié exhaustivement le
  03/08/2026 suite à une demande explicite de Greg ("garder les deux options" dark mode/langue
  sur toutes les pages).
- **`buttons/*`**, **`forms/*`** — génériques, texte/label passés en props par l'appelant (donc
  pas de texte en dur *dans* ces composants ; le texte en dur était côté appelant, corrigé).

## i18n (`src/locales/fr.json` + `en.json`)

**Couverture complète depuis le 03/08/2026** — tout texte UI visible passe par vue-i18n, sans
exception hors BBcode `SecurityGuet` (voir plus haut) et le nom de marque `Common.SiteName`
(identique dans les deux langues, routé par i18n quand même pour cohérence). Config live dans
`main.js` (`legacy: false`, messages auto-générés par `@intlify/unplugin-vue-i18n` depuis
`src/locales/**`). Une seconde instance i18n standalone (`src/i18n/index.js`) existe pour
`Validators.js` (hors contexte composant, ne peut pas utiliser `useI18n()`).

Namespaces principaux : `Cookies`, `Common`, `Profil`, `Validation`, `Welcome`, `Home`,
`NotFound`, `Auth` (partagé Login/Register), `Login`, `Register`, `NavBar`, `NavMenu`,
`Security`, `Economy`, `Animation`, `Company` + clés plates `username`/`password`/`email`/
`confirmation` (réutilisées à la fois comme labels de champs et pour l'interpolation des
messages de validation, ex. `Validation.Required`).

`src/modules/Validators.js` + `src/use/useFormValidation.js` — génèrent les messages d'erreur
inline (requis/min/max/email/confirmation). **Bug corrigé le 03/08/2026** : `isEmail` et
`isConfirmed` recevaient un argument `fieldName` en trop non déclaré dans leur signature (le
paramètre réel se retrouvait décalé), ce qui faisait échouer silencieusement la validation email
et confirmation de mot de passe sur toute saisie valide. Ce bug n'affectait que l'affichage
inline (`errors[fieldName]`) — la soumission réelle du formulaire ne consulte pas cet état et
validait correctement côté serveur.

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

## Tests (`frontend/tests/`)

Décompte à jour dans `README.md` (source unique, pas dupliqué ici — `npx vitest run` ; `npm run
test` est en mode watch, ne pas l'utiliser tel quel). Structure détaillée dans `docs/TESTS.md` :
dossier = domaine (`auth/`, `cookies/`, `eco/`, `security/`, `common/`, `enforcement/`,
`fixtures/`). Toute vue utilisant `useI18n()` doit recevoir un
plugin `createI18n({ legacy: false, ... })` dans `global.plugins` du test (miroir de la config
`main.js`) — sinon `useI18n()` lève une erreur au montage.

## Contraintes projet

- Frontend **FR + EN obligatoire** sur toute vue/composant, y compris existant.
- Ne jamais casser le design existant (NavMenu circulaire, palette, animations).
- Cookies : catégorie « Préférences » uniquement (dégradable), aucun tracking — voir
  `admin/strategies/cookies.md`.
