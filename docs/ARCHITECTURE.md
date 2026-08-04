# Architecture technique — Frontend (Vue 3)

> Référence structurelle chargée automatiquement (voir `CLAUDE.md` racine). Mise à jour :
> 03/08/2026. Vérifier le code avant de citer un détail précis si ce fichier date de plus de
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
  (localStorage `auth_user`/`auth_token`, `auth_token` en **string brute**, pas JSON). **Refonte
  du 03/08/2026** : `user.characters` est désormais une **liste** (un compte peut avoir 0, 1 ou
  N personnages) au lieu d'un pseudo/statut unique. Getters : `isLoggedIn`, `getUser`,
  `getToken`, `getCharacters`, `hasCharacters` (remplacent `getPseudo`/`getIsValidated`,
  supprimés). Actions : `register` (email+password uniquement, ne connecte plus — voir flux
  vérification email ci-dessous), `resendVerification`, `login` (par **email**, plus par pseudo),
  `logout`, `checkAuth` (auto-appelée si token présent au démarrage du store), `createCharacter`
  (POST `characters`, puis re-synchronise via `checkAuth()`), `setToken`/`setUser`. Pas de notion
  de rôles côté frontend (n'existe que côté admin Blade).
- **`cookieStore.js`** (style options) — flux consentement en 2 écrans : `CookiesBanner.vue`
  (accepter/refuser/gérer) + `CookiesModal.vue` (granulaire). Deux catégories, **toutes deux
  optionnelles** : `session` (nécessaire pour se connecter — `canUserLogin`) et `comfort`
  (persisté `localStorage['cookie-comply']`). **Modèle refondu le 03/08/2026** : `comfort`
  remplace l'ancien `functional` (connexion persistante) et fusionne dedans ce qui était avant
  hors-consentement (`essentialCookies` → renommé `comfortData`, `theme`/`locale`/
  `session-declined`), plus toute donnée de confort par module (ex. `guet_last_list`, voir
  `SecurityGuet.vue`). Stockage générique et réutilisable par n'importe quel module :
  `getComfortData(key, fallback)` / `setComfortData(key, value)` — la lecture/écriture en
  mémoire fonctionne toujours (dégradation gracieuse), seule la **persistance** en
  `localStorage['comfort-cookies']` dépend du consentement `comfort`
  (`hasAcceptedComfort`). Accepter `comfort` flush les changements faits en mémoire avant le
  consentement ; le refuser/retirer purge les données déjà stockées
  (`_syncComfortPersistence`). Palier 3 "compte" (données communautaires partagées, ex. future
  liste rouge du module Douane) reste hors scope — nécessiterait une vraie table backend, pas du
  cookie. Voir mémoire `project_cookie_tiers` côté session Claude.

## Services

- **`src/api.js`** — seul client HTTP réellement utilisé (importé par `authStore.js`). Instance
  Axios simple, pas d'intercepteur — le bearer token est attaché manuellement par appel.
- **`src/services/*`** (`http-common.js`, `auth-header.js`, `auth.service.js`, `user.service.js`,
  `anim.service.js`) — **code mort**, non importé nulle part. Contrat localStorage incompatible
  avec `authStore.js` (ex. `auth_token` JSON-stringifié vs string brute). Ne pas réutiliser ; si
  besoin d'étendre les appels API, passer par `api.js`.

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
- **`auth/RegisterView.vue`** — **refonte du 03/08/2026** : ne demande plus que email + mot de
  passe + confirmation (pseudo/ville déplacés vers `AddCharacterView`). Après soumission, affiche
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
- **`auth/ProfilView.vue`** — **refonte du 03/08/2026** : affiche la **liste** des personnages du
  compte (`authStore.getCharacters`), chacun avec son badge validé/en attente, plus un lien vers
  `AddCharacterView`. Avant : un seul pseudo/statut (`getPseudo`/`getIsValidated`, supprimés).
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
- **`modules/economy/MainEconomy.vue`**, **`modules/animation/MainAnimation.vue`**,
  **`modules/company/MainCompany.vue`** — squelettes vides (Phase 4/5), placeholder "Test" i18n
  minimal (`Common.Placeholder`).

## Composants (`src/components/`)

- **`NavBar.vue`** — header `/app/*`. `SelectorMenu` ajouté le 03/08/2026 dans un emplacement
  qui était vide (`justify-self-end`) — couvre d'un coup toutes les pages `/app/*` (home, éco,
  sécu, company, anim, profil) puisqu'elles partagent toutes ce composant via la named view `Nav`.
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

## Tests (`frontend/tests/`)

**86/86 verts** (`npx vitest run` — `npm run test` est en mode watch, ne pas l'utiliser tel
quel). Structure : `components/` (CookiesBanner, CookiesModal, NavBar, NavMenu),
`stores/` (authStore, cookieStore), `views/` (HomeView, SecurityGuet, LoginView, RegisterView,
ProfilView), `router/` (redirectToHomeIfNotLoggedIn), `fixtures/` (données réelles anonymisées
pour le test de non-régression SecurityGuet). Toute vue utilisant `useI18n()` doit recevoir un
plugin `createI18n({ legacy: false, ... })` dans `global.plugins` du test (miroir de la config
`main.js`) — sinon `useI18n()` lève une erreur au montage.

## Contraintes projet

- Frontend **FR + EN obligatoire** sur toute vue/composant, y compris existant — voir mémoire
  `feedback_translations` côté session Claude pour l'historique de cette règle.
- Ne jamais casser le design existant (NavMenu circulaire, palette, animations).
- Cookies : essentiels + session uniquement, aucun tracking.
