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
| `/app/` | `home` | — |
| `/app/eco` | `economy` | — |
| `/app/secu` (enfant `/guet` → `security-guet`) | `security` | — |
| `/app/company` | `company` | — |
| `/app/anim` | `animation` | — |
| `/app/profil` | `profil` | `redirectToHomeIfNotLoggedIn` |
| `/:pathMatch(.*)*` | — | 404.vue |

`redirectToHomeIfNotLoggedIn` est **exportée** (nommée, en plus du router en export par défaut)
pour être testable isolément (`tests/router/redirectToHomeIfNotLoggedIn.test.js`). Vérifie
`authStore.isLoggedIn` — a été cassée pendant longtemps (référençait `getIsLoggedIn`, inexistant,
donc redirigeait toujours vers `/login` même connecté), corrigé le 03/08/2026.

## Stores Pinia (`src/stores/`)

- **`authStore.js`** (style setup, `defineStore('auth', () => {...})`) — state `user`/`token`
  (localStorage `auth_user`/`auth_token`, `auth_token` en **string brute**, pas JSON). Getters :
  `isLoggedIn`, `getUser`, `getToken`, `getPseudo`, `getIsValidated`. Actions : `register`,
  `login`, `logout`, `checkAuth` (auto-appelée si token présent au démarrage du store),
  `setToken`/`setUser`. Pas de notion de rôles côté frontend (n'existe que côté admin Blade).
- **`cookieStore.js`** (style options) — flux consentement en 2 écrans : `CookiesBanner.vue`
  (accepter/refuser/gérer) + `CookiesModal.vue` (granulaire). Catégories : `functional` (requis,
  connexion persistante) et `session` (optionnel, nécessaire pour se connecter — `canUserLogin`).
  Persisté `localStorage['cookie-comply']`. Séparément, `essentialCookies` (`theme`/`locale`/
  `session-declined`) dans `localStorage['essential-cookies']` — préférences UI **hors
  consentement RGPD** (pas de tracking). Palier 3 (données de jeu liées au compte) en réflexion,
  non implémenté — voir mémoire `project_cookie_tiers` côté session Claude.

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
- **`auth/LoginView.vue`** — connexion par pseudo. `SelectorMenu` ajouté le 03/08/2026 (absent
  avant). Bandeau "compte non validé" fonctionnel depuis le 03/08/2026 (comparait avant contre
  une clé localStorage morte + un message backend qui n'existait pas — le backend n'a été
  modifié pour bloquer/renvoyer ce message qu'à cette date, voir doc backend). Comparaison
  `error_message.value === 'Compte non validé.'` **volontairement pas traduite** : c'est le
  message brut renvoyé par l'API (backend français uniquement), pas du texte UI.
- **`auth/RegisterView.vue`** — inscription. `SelectorMenu` ajouté, titre corrigé
  ("Créez votre compte", était grammaticalement invalide).
- **`auth/ProfilView.vue`** — affiche pseudo (`getPseudo`) + statut de validation
  (`getIsValidated`). Corrigé le 03/08/2026 (référençait avant `getUsername`/`getRoles`,
  inexistants sur le store — la vue était cassée depuis le refactor de `authStore`).
- **`modules/security/MainSecurity.vue`** — shell + lien vers `security-guet`.
- **`modules/security/SecurityGuet.vue`** — seul module métier fonctionnel. Parse 2 listes
  villageois (hier/aujourd'hui) collées depuis le jeu (tabulation = ligne valide, filtre le
  préambule descriptif), diffe pour calculer entrées/sorties, génère du BBcode à copier sur le
  forum du jeu. **Le BBcode généré reste en français fixe** (contenu de forum francophone,
  indépendant de la langue de l'UI) — seuls les labels/boutons autour sont traduits. ⚠️ Domaine
  incohérent entre le lien affiché (`renaissancekingdoms.com`) et le lien inséré dans le BBcode
  exporté (`lesroyaumes.com`) — jamais confirmé avec Greg, à vérifier si ça pose problème en usage réel.
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

**60/60 verts** (`npx vitest run` — `npm run test` est en mode watch, ne pas l'utiliser tel
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
