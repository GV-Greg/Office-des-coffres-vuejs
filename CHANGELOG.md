# Changelog — Office des Coffres (frontend)

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Une entrée par PR
mergée sur `main` (ou merge direct pour les deux entrées antérieures aux PR GitHub). Pas de
versionnage sémantique — chaque merge sur `main` déclenche un déploiement, la date de merge fait
foi. L'historique détaillé (raisonnement, incidents, décisions) reste dans `roadmap.md` à la
racine du workspace ; ce fichier n'en retient que le résumé daté.

## [2026-08-10] — PR #26

### Added
- Intercepteur axios avec refresh automatique du token sur 401 (mutex : une seule requête de
  refresh en vol même si plusieurs appels échouent en parallèle, les autres attendent puis
  rejouent) — voir PR backend #15.
- Checkbox « Rester connecté » sur le login (`Auth.RememberMe` FR+EN) ; refresh token stocké en
  localStorage si cochée, sessionStorage sinon.

### Changed
- `authStore.js` migré du token Sanctum unique au couple access+refresh token Passport.
- Catégorie cookie « Session » (orpheline depuis la PR #20) et mention TTL "2 heures" (fausse)
  retirées des locales.

## [2026-08-09] — PR #25

### Added
- `scripts/docs-sync-check.sh` en CI : échoue si le décompte de tests diverge entre fichiers, ou
  si `docs/ARCHITECTURE.md` accuse plus de 30 jours de retard sur le dernier commit `src/`.

## [2026-08-09] — PR #24

### Fixed
- `docs/ARCHITECTURE.md` décrivait encore l'ancien modèle cookies (`acceptedCookies`) et un
  `services/anim.service.js` déjà supprimé ; module Économie décrit comme un squelette vide alors
  que livré depuis le 08/08.

### Changed
- Sources uniques : plus de chiffre de tests ni d'historique de changements dans
  `ARCHITECTURE.md` (README/CHANGELOG font foi), structure détaillée retirée du README.

## [2026-08-09] — PR #23

### Added
- Accès permanent à la modale de préférences cookies : `AppFooter.vue` (nouveau, bouton « Gérer
  mes préférences ») + bouton identique dans `ProfilView.vue`. `cookieStore.js` expose
  `isPreferencesModalOpen`/`openPreferencesModal()`/`closePreferencesModal()`.

## [2026-08-09] — PR #22

### Removed
- `src/services/` entier (5 fichiers : `auth.service.js`, `auth-header.js`, `http-common.js`,
  `user.service.js`, `anim.service.js`) — code mort, aucune référence restante.

## [2026-08-09] — PR #20

### Changed
- Modèle de consentement cookies : `acceptedCookies: [...]` remplacé par `consent: { preferences:
  bool, choiceMadeAt: number }`, migration douce de l'ancien format. `clearCookies()` renommé
  `clearConsentedStorage()`, limité aux préfixes `cookie-*`/`comfort-*` (l'ancienne version
  effaçait aussi `auth_token`/`auth_user`).

### Added
- Validation stricte du JSON de consentement au chargement (`initializeCookies()`) — un JSON
  corrompu repart d'un état vierge plutôt que de planter.

## [2026-08-09] — PR #21

### Added
- `tests/enforcement/storage-usage.unit.test.js` : échoue si `localStorage`/`sessionStorage`/
  `document.cookie` apparaît hors de `cookieStore.js` (whitelist `authStore.js` pour le jeton
  d'auth).

## [2026-08-08] — PR #19

### Added
- Module Économie : sélecteur de semaine (`EconomyMines.vue`), `HelpModal.vue` (composant d'aide
  générique), `gameCalendar.js` (ancrage année réelle ↔ année de jeu, 2026 → 1474).

### Fixed
- Bug bloquant du sélecteur de semaine : `isValidDate()` exigeait une année ≥ 2000, écartant
  toute date en 1474 collée depuis le jeu.

## [2026-08-08] — PR #18

### Changed
- Migration ESLint 8 → 10 (flat config).

## [2026-08-08] — PR #17

### Added
- `docs/TESTS.md` : table domaine → script, convention `.unit.test.js`, temps de référence.

### Changed
- Cache `node_modules/.vite` en CI ; étape qui échoue si un test traîne à la racine de `tests/`
  plutôt que dans un dossier de domaine.

## [2026-08-08] — PR #16

### Changed
- Tests restructurés par domaine (`tests/{auth,cookies,eco,security,common}/`) plutôt que par
  type technique, suffixe `.unit.test.js` pour la logique pure sans DOM.

### Fixed
- `test:logic` utilisait un glob invalide en argument positionnel Vitest (traité comme filtre
  substring, jamais comme glob) — remplacé par un filtre substring équivalent.

## [2026-08-08] — PR #15

### Added
- `CHANGELOG.md` (ce fichier) et `docs/DECISIONS.md` (ADR pour les choix structurants).

## [2026-08-08] — PR #14

### Fixed
- `npm run lint` s'exécutait plus du tout (`exit 2`, plugin d'import manquant) — retiré plutôt
  qu'installé, l'unique resolver d'alias compatible ESLint 8 cassait sur `notivue` (paquet ESM
  pur). 16 erreurs de code réelles révélées par la réparation, corrigées dans la foulée.
- Bruit `[Vue warn]: Failed to resolve component: v-icon` dans les tests de composants —
  `tests/setup.js` stubbe désormais le composant globalement.

### Changed
- `npm test` lance `vitest run` (one-shot) au lieu du mode watch, qui piégeait quiconque tapait la
  commande instinctivement en CI/ponctuel — le mode watch vit sous `test:watch`.
- Scripts `test:<module>` ciblés (`test:auth`, `test:cookies`, `test:eco`, `test:security`,
  `test:common`) pour ne plus lancer la suite complète en développement.

## [2026-08-08] — PR #13

### Changed
- Le déploiement (`deploy.yml`) attend désormais la réussite de `tests.yml` (appelé en
  `workflow_call`) avant de partir en prod — jusque-là les deux workflows tournaient en parallèle
  sans dépendance.

## [2026-08-07] — PR #12

### Fixed
- `SelectorCharacter` s'affichait à tort sur les pages publiques (Welcome, Login, Register) pour
  un compte déjà connecté — `SelectorMenu` était partagé entre pages publiques et `NavBar`.
  Déplacé dans `NavBar.vue` uniquement.
- Un compte déjà connecté qui tentait d'aller sur `/login` ou `/register` n'était pas redirigé —
  nouveau guard `redirectToHomeIfLoggedIn`, symétrique du guard existant.

## [2026-08-06] — PR #11

### Fixed
- 7 fichiers utilisaient `sm:`/`md:` (breakpoints Tailwind par défaut) sans effet — le projet
  redéfinit `theme.screens` avec `tablet:`/`laptop:`/`desktop:`, ce qui supprime silencieusement
  les préfixes par défaut. Corrigés vers les bons préfixes.

## [2026-08-06] — PR #10

### Added
- Annonce de la relance du serveur Discord dans la Chronique de l'Office.

## [2026-08-06] — PR #9

### Added
- Bouton "Se connecter" sur `HomeView` si déconnecté.
- Lien vers le panneau d'administration Blade dans la `NavBar`, visible uniquement pour un compte
  avec le rôle admin (`authStore.isAdmin`, alimenté par `is_admin` côté API).

## [2026-08-06] — PR #8

### Added
- Notifications Discord sur 3 salons distincts : `#coulisses-admin` (déploiement), `#chronique-de-
  loffice` (nouveautés, salon Texte), `#registre-des-reparations` (correctifs, salon **Forum** —
  un post/thread par entrée pour permettre aux testeurs de discuter chaque correctif).
- `whatsNew.json` : nouveau champ `type` (`feature`/`fix`), `id` stable pour la déduplication.
- `HomeView` : Chronique scindée en deux rubriques, "Chroniques de l'Office" et "Le Registre des
  Réparations", affichées en deux colonnes.

## [2026-08-06] — PR #7

### Added
- Bouton de déconnexion dans la `NavBar` (`authStore.logout()` existait mais n'était appelé par
  aucun composant jusqu'ici).
- Palette de boutons dégradée `.btn-grad-{couleur}` (blue/slate/red/green/yellow/cyan/purple/
  light/dark) — remplace `.btn-ghost` pour toute action qui doit avoir le même poids visuel que
  les actions primaires.

## [2026-08-06] — PR #6

### Added
- Module Économie — Bilan des mines (`/app/eco/mines`) : parsing du texte collé depuis
  l'interface du jeu, calcul du bilan hebdomadaire (production − entretien − salaires) par
  ressource, export BBcode avec gabarit repliable, mémorisation "comfort" entre visites.

## [2026-08-06] — PR #5

### Added
- "Chronique de l'Office" (`HomeView`) : fil des nouveautés datées, `whatsNew.json`.
- Personnage actif vs personnage par défaut (`authStore`) — le personnage par défaut est le choix
  persistant utilisé à la connexion, le personnage actif est modifiable librement pendant la
  session sans écraser le choix par défaut.
- Refonte de `ProfilView` : carte par personnage, badge couronne sur le personnage par défaut.
- Palette de boutons dégradée initiale (orange→rouge, `.btn-primary`).

## [2026-08-04] — Merge `feat/account-verification`

### Added
- Flux d'inscription en 3 écrans : email + mot de passe seuls (`RegisterView`), écran "vérifiez
  votre boîte mail", route `/verify-email` (connexion automatique après clic sur le lien reçu).
- Route `/app/character/new` : création de personnage (sélecteur royaume → province → ville en
  cascade), accessible aussi depuis `ProfilView` pour ajouter un personnage supplémentaire.
- `ProfilView` affiche la liste des personnages du compte (avant : un seul pseudo/statut).
- Catégorie de cookies unifiée "comfort" (thème, langue, dernières saisies des outils publics) —
  remplace l'ancienne distinction fonctionnel/essentiel, avec dégradation gracieuse.
- Modification de la résidence d'un personnage depuis `ProfilView`.

### Changed
- Connexion par **email** plutôt que par pseudo.
- `redirectToHomeIfNotLoggedIn` vérifie désormais la validité du token côté serveur, pas
  seulement sa présence en localStorage.

## [2026-08-03] — PR #4

### Fixed
- `ProfilView.vue` cassée (`getUsername`/`getRoles` inexistants sur `authStore`) — malgré la
  roadmap l'indiquant réparée, ce n'était jamais réellement corrigé.
- Guard `redirectToHomeIfNotLoggedIn` cassé (référençait `getIsLoggedIn`, inexistant) —
  `/app/profil` redirigeait systématiquement vers `/login`, même connecté.
- Bug de validation email/confirmation de mot de passe dans `Validators.js` (argument décalé).

### Added
- Couverture i18n complète du site (Welcome, Home, 404, Login, Register, NavBar, NavMenu,
  Sécurité, modules squelettes, messages de validation) — plus un seul texte en dur hors BBcode.

## [2026-08-03] — PR #3

### Fixed
- Parsing des sorties dans `SecurityGuet.vue` : le texte collé contient un préambule descriptif
  avant le tableau tabulé (maire, adjoints, noblesse d'épée sans tabulation), gonflant les comptes
  et dupliquant des membres. Corrigé en ignorant toute ligne sans tabulation.

## [2026-06-28] — Merge `feat/api-rest-auth`

### Added
- `authStore` connecté à l'API REST backend (`api.js`), tokens Sanctum.

### Removed
- Services HTTP legacy (`http-common.js`, `auth.service.js`, `user.service.js`,
  `auth-header.js`) — contrat localStorage incompatible avec le nouveau store.

## [2026-06-27] — PR #1

### Changed
- Mise à jour des dépendances, correction de la safelist Tailwind, réécriture du README.
