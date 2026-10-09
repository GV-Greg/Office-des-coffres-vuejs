# Architecture technique — Frontend (Vue 3)

> Référence structurelle chargée automatiquement (voir `CLAUDE.md` racine). Mise à jour :
> 03/10/2026. Vérifier le code avant de citer un détail précis si ce fichier date de plus de
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
| `/app/eco` | `economy` | redirige vers `economy-mines` (enfant `mines`) ; enfant `registre` → `economy-registry` (`redirectToHomeIfNotLoggedIn`), lien affiché à qui peut lire le registre |
| `/app/secu` (enfant `/guet` → `security-guet`) | `security` | — |
| `/app/company` | `company` | — |
| `/app/anim` | `animation` | — |
| `/app/profil` | `profil` | `redirectToHomeIfNotLoggedIn` |
| `/app/province` | `province` | `redirectToHomeIfNotLoggedIn` — « Ma province » |
| `/app/character/new` | `character-new` | `redirectToHomeIfNotLoggedIn` |
| `/:pathMatch(.*)*` | `not-found` | — (`meta.public`) |

Les deux guards sont **exportés** nommément (en plus du router en export par défaut) pour être
testables isolément (`tests/auth/`). `redirectToHomeIfNotLoggedIn` vérifie `authStore.isLoggedIn`
**puis** la validité réelle du token côté serveur (`checkAuth()`) — un token local peut survivre à
une session expirée ou à un compte supprimé. `redirectToHomeIfLoggedIn` est son symétrique : un
compte déjà connecté qui atterrit sur `/login` ou `/register` part directement sur `/app/`.
`WelcomeView` (`/`) en est volontairement exemptée (voir `docs/DECISIONS.md`).

**Hooks globaux de navigation** : `beforeEach`/`afterEach`/`onError` pilotent `LoadingOverlay.vue`
via `useNavigationLoading` — contexte `chest` pour les modules « Coffres X » (`economy`,
`economy-mines`, `security`, `security-guet`, `animation`), `office` pour tout le reste. Les
envois à l'API lancés par l'utilisateur, que le routeur ne voit pas, passent par `trackApiCall()`
(voir `use/useNavigationLoading.js` plus bas).

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
  `logout`, `deleteAccount` (DELETE `auth/account`, art. 17 RGPD : purge la session locale **et**
  les comfort data liées au compte — `default_character_id` devenu une référence morte,
  `last_login_email` une donnée personnelle ; ne touche ni au consentement cookies ni au thème),
  `checkAuth` (auto-appelée si token présent au démarrage du store ; **une seule requête
  `auth/me` en vol par token**, rendue aux appels concurrents — sans ça, le premier garde qui crée
  le store doublait l'hydratation, garde-fou dans `authStore.test.js`), `createCharacter`,
  `updateCharacterCity` (PATCH `characters/{id}`, resynchronise via `checkAuth()`),
  `setActiveCharacter`/`setDefaultCharacter`, `setToken`/`setUser`.
  **Deux niveaux de personnage** : `defaultCharacter` est le choix persistant (comfort data
  `default_character_id`, modifiable depuis le Profil) appliqué à chaque connexion ;
  `activeCharacter` est le contexte de la session en cours (`SelectorCharacter.vue`), il n'écrase
  jamais le choix par défaut.
  **Intercepteur axios 401 avec mutex** enregistré ici (pas dans `api.js`) : un access token
  expiré déclenche un seul appel à `auth/refresh` même si plusieurs requêtes échouent en
  parallèle, puis rejoue la requête d'origine ; `auth/login` et `auth/refresh` en sont exclus pour
  ne pas boucler. Seul un **refus** du refresh (400/401) purge la session avec un toast « session
  expirée » ; un refresh resté sans réponse (délai d'`api.js` dépassé, réseau coupé) la garde, la
  requête suivante retente. `checkAuth()` applique la même règle.
- **`mandateStore.js`** (style setup) — mandats de maire et de conseiller comtal : `mandates`,
  `characters` (avec `requestable` par niveau, Q6), `offices` (référentiel public avec libellés
  FR/EN). Actions `fetchAll`, `fetchOffices`, `requestMandate`, `renew`, `cancel`, `declareOffice`.
  ⚠️ **Le frontend ne recode aucune règle et ne traduit aucun code** : les titres, motifs et causes
  de fin arrivent de l'API en FR et EN (Q11), les refus avec `messages[champ][langue]` (Q9) ;
  `apiFieldErrors` / `apiMessage` choisissent la langue de l'interface. Seuls les **statuts** et le
  texte d'interface sont dans les locales (`Profil.Mandates.*`). Arbitrages :
  `admin/echanges/mandats-lot2/`.
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
  la monte, `NavBar.vue`, la bannière et le footer des pages publiques l'ouvrent — plus
  `ProfilView`, qui doublait la NavBar) sans état local par composant. Palier 3
  "compte" (données communautaires partagées, ex. future liste rouge du module Douane) reste
  hors scope — nécessiterait une vraie table backend, pas du cookie.

## Services

- **`src/api.js`** — seul client HTTP du projet (`http`, instance Axios), **délai d'attente de 20 s**
  (`HTTP_TIMEOUT_MS` ; axios n'en a aucun par défaut, une requête jamais rendue bloquait l'interface —
  cas réel : la prod retient les 429 du limiteur Laravel). Le bearer token est
  attaché manuellement par appel ; l'unique intercepteur (401 → refresh) est enregistré par
  `authStore.js`, pas ici. Exporte aussi `ADMIN_ORIGIN`, dérivé de `VITE_API_ENDPOINT_*` — le
  panneau admin Blade est servi par la même origine que l'API.
- **`src/services/`** n'existe plus (`http-common.js`, `auth-header.js`, `auth.service.js`,
  `user.service.js`, `anim.service.js` : code mort, jamais importé). Toute doc ou tâche qui les
  mentionne est périmée — pour étendre les appels API, passer par `api.js`.

## Vues (`src/views/`)

- **`WelcomeView.vue`** — landing : logo vertical en guise de `<h1>`, cadenas (lien vers la
  connexion), invite « cliquez » en **rebond fini** (`motion-safe:animate-bounce-hint`, 3 × 1 s,
  arrêt en haut) rejoué au survol du cadenas par Web Animations (6 × 0,5 s, ignoré en mouvement
  réduit), `SelectorMenu` en haut à droite, intro roleplay
  et **footer propre** fusionnant le disclaimer « outil non officiel », le copyright et les liens
  légaux — seule page exemptée d'`AppFooter` (voir `App.vue`).
- **`HomeView.vue`** — `NavMenu` + deux rubriques alimentées par `src/data/whatsNew.json` :
  « Chroniques de l'Office » (entrées `type: "feature"`) et « Le Registre des Réparations »
  (`type: "fix"`), en deux colonnes, les entrées `scope: "private"` n'apparaissant que connecté.
  Bouton « Se connecter » si déconnecté.
- **`404.vue`** (route `not-found`, catch-all `meta.public`) — page introuvable : logo vertical,
  titre, texte roleplay (plus de code « 404 », 27/09/2026). **Un seul bouton** « Retour à l'Office »
  (`odc-btn--soft odc--orange`, flèche `fa-reply`) : retour à la page précédente de l'historique
  **du navigateur** (`window.history.length > 1` — une URL cassée tapée dans la barre recharge la
  page et vide l'historique du routeur), sinon `home` si connecté, `welcome` sinon. Pas de hauteur
  minimale propre : `App.vue` pousse déjà le footer en bas. Porte son propre `SelectorMenu` comme
  Welcome et les pages légales.
- **`legal/CookiesPolicyView.vue`**, **`legal/PrivacyPolicyView.vue`**,
  **`legal/MentionsLegalesView.vue`** — pages légales publiques, FR + EN, contenu en i18n sous le
  namespace `Legal` (clés de contact partagées dans `Legal.Common.Contact.*`). ⚠️ Les listes y
  sont rendues avec `tm()` **+ `rt()`** : `tm()` seul renvoie des AST compilés, affichés tels
  quels à l'écran mais invisibles en test (les mocks ne sont pas précompilés).
  **Registre des mines** (08/10/2026) : la politique porte ses trois insertions (§3 ce qui est
  conservé, §5 la durée et la coupure du lien, §6 qui y accède — avant « Personne d'autre »),
  **avant** l'ouverture de l'écriture. Texte validé par Greg le 06/10
  (`admin/content/policy-registre-mines-draft.md`), garde-fou `tests/legal/privacyMineRegistry`.
- **`auth/LoginView.vue`** — connexion par **email** (jamais par pseudo). Structure (27/09/2026) :
  une colonne `max-w-md` — logo horizontal en `<h1>`, « Entrez sans compte » vers `/app/`
  (`odc-btn--soft` au dégradé orange-rouge `.enter-free`, 20 px gras : grand texte, seuil 3:1),
  séparateur « ou », puis une **carte claire dans les deux thèmes** (`bg-slate-50`, textes répétés
  en `dark:` à cause de `.dark p`). Dans la carte : alerte « email non vérifié » en tête
  (`role="alert"`) + bouton de renvoi (`authStore.resendVerification`), champs, case « Rester
  connecté » native dessinée (`.remember-check` ; préférence mémorisée entre visites via la
  comfort data `remember_me_preference`), « Se connecter » en `odc-btn--soft odc--blue` pleine
  largeur, lien d'inscription. Comparaison `error_message.value === 'Email non vérifié.'`
  **volontairement pas traduite** : c'est le message brut renvoyé par l'API (backend français
  uniquement), pas du texte UI. Après connexion réussie, redirige vers `/app/character/new` si le
  compte n'a aucun personnage, sinon `/app/`.
- **`auth/RegisterView.vue`** — ne demande que email + mot de passe + confirmation (pseudo/ville
  déplacés vers `AddCharacterView`). Même structure que la connexion (logo horizontal, carte
  claire, « S'enregistrer » en `odc-btn--soft odc--blue`, lien « Vous avez déjà un compte ?
  Connectez-vous » au bas de la carte à la place de l'ancien bouton « Retour » isolé). Après soumission, affiche
  un écran "vérifiez votre boîte mail" (`data-testid="check-email-message"`) au lieu de connecter
  ou rediriger — le compte n'est utilisable qu'après confirmation du lien reçu par email.
- **`auth/VerifyEmailView.vue`** (route `/verify-email`) — **depuis le 05/10/2026, le lien de
  l'email pointe ici** (`?id&hash&expires&signature`, jamais le domaine de l'API, qui ferait passer
  l'email pour de l'hameçonnage) : la page rappelle l'API en JSON (`authStore.confirmEmail`). Lit
  aussi `token`/`error` (le backend y redirige encore pour les liens envoyés avant). Si `token` : connexion
  automatique (`setToken` + `checkAuth`) puis redirection vers `/app/character/new` (aucun
  personnage) ou `/app/profil`. **Tout autre cas** — `?error`, aucun paramètre, ou jeton refusé
  par le serveur (`checkAuth()` l'efface alors) — affiche le message + mini-formulaire de renvoi
  (avant le 27/09/2026, seul `?error` y menait : la page restait sinon bloquée sur « Vérification
  en cours… »). Même structure
  que la connexion (logo horizontal, carte claire, « Renvoyer le lien » en `odc-btn--soft
  odc--blue`) ; « Vérification en cours… » annoncé en `role="status"`, lisible dans les deux thèmes.
- **`auth/AddCharacterView.vue`** (route `/app/character/new`, gardée par
  `redirectToHomeIfNotLoggedIn`) — sélecteur royaume → province → ville en cascade (fetch
  `GET map` au montage, ~300 villes chargées en un seul payload, pas de pagination), pseudo,
  soumission via `authStore.createCharacter`. Accessible aussi depuis `ProfilView` pour ajouter un
  personnage supplémentaire à un compte qui en a déjà.
- **`auth/ProfilView.vue`** — structure revue le 27/09/2026 : titre + email en sous-titre, puis
  **deux colonnes à partir de laptop** (tient sans défilement sur ordinateur). À gauche (2/3) :
  « Ajouter un personnage » en tête (lien vers `AddCharacterView`), puis la **liste** des
  personnages (`authStore.getCharacters`) en cartes `<article>` à liseré latéral (vert validé /
  rouge en attente). Carte : **identité en haut** (pseudo + badge de statut plat « Validé » / « En
  attente », résidence ville → province → royaume traduite par `kingdomTranslations.js`),
  explication du statut juste dessous, **actions groupées en bas** (« Modifier la résidence » —
  `updateCharacterCity`, repasse le personnage en attente de validation admin — et « Définir comme
  actif »). Le personnage **à la connexion** porte l'étoile `fa-star` sur l'avatar et le badge plat
  « Personnage actif à la connexion » (ni coche, réservée au statut, ni heaume, déjà l'avatar). Pas
  de bouton « Gérer mes préférences » (déjà dans la NavBar). À droite (1/3) : la **zone
  dangereuse** (`data-testid="danger-zone"`), dépliant `<details>` natif replié par défaut, porte la
  suppression de compte self-service via
  `DeleteAccountModal.vue` : l'appel API et la redirection vivent ici, la modale ne rend que le
  verdict.
- **`ProvinceView.vue`** (route `/app/province`, 6ᵉ bouton du menu) — « Ma province » : historique
  des postes de la province de **résidence** du personnage actif (fil
  `admin/echanges/mandats-historique` ; résidence seule, décision de Greg). Avertissement
  **permanent en tête** (« l'Office n'enregistre que ce que les joueurs déclarent »), conseil par
  titre, maires par ville, villes sans mandat comptées (jamais masquées), export forum
  (`modules/provinceBBcode.js` : BBcode **français fixe**, dates en **1474**). États vides : aucun
  personnage (lien vers l'ajout), résidence inconnue. Le personnage se change par la NavBar.
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
  colle un relevé de mines exporté du jeu, calcule le bilan d'une semaine sélectionnable en
  **une table par mine** (production, valeur, heures, salaire = heures × taux horaire, entretien
  pierre/fer et en écus, solde) avec une ligne Total, génère du BBcode. Sélecteur de semaine calé
  sur `modules/gameCalendar.js` (dates réelles en interne, année de jeu 2026→1474 seulement à
  l'affichage) ; **semaine proposée à l'arrivée : la semaine en cours, sauf le lundi** (semaine passée, pour
  compléter les heures du dimanche — Greg, 08/10/2026, `defaultWeek`). Une semaine incomplète
  s'affiche marquée « Bilan provisoire » mais **ne s'exporte pas**. Prix et taux horaire
  **mémorisés avec chaque semaine** (confort). **Alerte de seuil à l'écran seulement** (jamais
  dans un export), datée du jour du collage. **Registre des mines** (08/10/2026) : sous le collage,
  `components/mines/MineRegistrySave.vue` propose « enregistrer dans le registre de {province} » au seul
  personnage que l'API dit commissaire aux mines ou bailli (`GET characters/{id}/mine-registry`) — la
  province du **poste** est affichée **avant** l'envoi ; un 409 ouvre une confirmation qui nomme
  l'auteur remplacé (« remplacé, pas effacé ») ; aucun refus n'est traduit côté site (`apiMessage`).
  Brief `admin/content/brief-bilan-mines.md`, fil
  `admin/echanges/bilan-mines`. `HelpModal.vue` pour l'aide contextuelle. Futur pendant privé
  (backend, compte requis) : « Registre des mines », pas encore développé.
- **`modules/economy/EconomyRegistry.vue`** (route `economy-registry`, 09/10/2026) — page de **lecture** du
  Registre des mines, pour le commissaire aux mines, le bailli et le dirigeant
  (`GET characters/{id}/mine-registry/reports`). Le serveur sert les faits ; la page affiche l'**âge du
  dernier relevé**, l'**état du parc** au dernier relevé en vigueur (`thresholdAlert`), les **jours sans
  relevé** depuis l'entrée en fonction du lecteur (jusqu'à hier), le **prédécesseur** comme un fait
  (« relevés de X, du … au … » — jamais « votre prédécesseur était »), et l'**historique** remplacements
  compris. Le lien du menu d'Économie n'apparaît qu'à qui peut lire (`MainEconomy`, via
  `GET …/mine-registry`). Reste à venir (PR 4c) : historique des niveaux, bilans de mi-mandat et de fin de mandat.
- **`modules/animation/MainAnimation.vue`**, **`modules/company/MainCompany.vue`** — squelettes
  vides, placeholder "Test" i18n minimal (`Common.Placeholder`). Voir `roadmap.md` pour ce qui est
  prévu.

## Composants (`src/components/`)

- **`CookiesBanner.vue`** / **`CookiesModal.vue`** — bannière de consentement (première visite)
  et modale des préférences, montées une seule fois dans `App.vue`. Boutons `odc-*` (27/09/2026) :
  dans la bannière, « Refuser » et « Accepter » ont **exactement le même style** (standard
  ardoise — la CNIL demande un refus aussi simple et visible que l'acceptation ; l'ancien rouge
  « danger » le présentait comme une faute), « Gérer mes préférences » en discret avec l'icône
  `fa-sliders-h` ; dans la modale, « Annuler » discret, « Enregistrer » standard vert. Gardé par
  un test (`CookiesBanner.test.js`).
- **`buttons/SwitchButton.vue`** — interrupteur de la modale cookies : `type="button"`,
  `role="switch"` + `aria-checked`, `disabled` natif pour un choix obligatoire ; un `id` passé
  par l'appelant le relie au `<label for>`. Rail éteint slate-500 (≥ 3:1).
- **`AppFooter.vue`** — footer légal unique, monté dans `App.vue` **hors du cadre de contenu** de
  chaque page, sur toutes les routes sauf `welcome` (qui a le sien, fusionné avec son disclaimer).
  Liens vers les trois pages légales ; « Gérer mes préférences » et la mention « outil non
  officiel » n'apparaissent que sur les routes `meta.public` (sur `/app/*`, le bouton préférences
  est déjà dans la `NavBar`).
- **`LoadingOverlay.vue`** — overlay plein écran pendant la navigation, monté dans `App.vue` et
  piloté par les hooks du router via `useNavigationLoading`. Icône et texte selon le contexte
  (pavillon « Ouverture de l'office… » / coffre « Ouverture du coffre… » / pavillon « Le greffe
  traite votre demande… » pendant un envoi à l'API), `role="status"` +
  `aria-live`, `prefers-reduced-motion` respecté.
- **`NavBar.vue`** — header `/app/*` (named view `Nav`, donc partagé par home, éco, sécu, company,
  anim, profil). Contient `SelectorMenu`, `SelectorCharacter`, le bouton de déconnexion, le bouton
  « Gérer mes préférences » (cookies) à côté d'Accueil, et le lien vers le panneau d'administration
  Blade (`ADMIN_ORIGIN`), visible seulement si `authStore.isAdmin`. Colonne centrale : le **logo**
  (`assets/logo/logo-horizontal.svg`, texte vectorisé, aucune police chargée), lien vers `home`,
  `alt` = `Common.SiteName`, visible sur toutes les pages `/app/*` accueil compris ; sous
  `tablet`, l'écu seul (`assets/logo/ecu.svg`) via `<picture>`. Tous ses boutons sont des
  `odc-btn odc-btn--rect` de 44 px (voir `assets/odc-buttons.css`).
- **`SelectorCharacter.vue`** — bascule de personnage **pour la session en cours**, monté
  directement dans `NavBar.vue` (jamais dans `SelectorMenu`, partagé avec les pages publiques) et
  visible seulement si connecté avec plus d'un personnage. Depuis le 03/10/2026, **liste dessinée
  par le site** (la liste native d'un `<select>` est dessinée par le système, impossible à
  habiller) au motif **listbox de l'APG W3C** : bouton `aria-haspopup="listbox"`, liste focalisée,
  `aria-activedescendant`, ↑ ↓ Début Fin Entrée Espace Échap Tab, clic extérieur. Coche = personnage
  de la session, étoile = personnage par défaut. L'option active porte un liseré orange-700
  (5,18:1, WCAG 1.4.11) : un simple fond pâle (1,06:1) était invisible.
- **`DeleteAccountModal.vue`** — confirmation de suppression de compte en **deux étapes** (art. 17
  RGPD) : la première nomme ce qui va disparaître (email, personnages cités par leur pseudo,
  préférences), la seconde redemande le mot de passe, le bouton restant désactivé tant qu'il est
  vide. Rouvrir la modale repart toujours de l'étape 1, sans conserver la saisie. Elle ne connaît
  ni le store ni le routeur : elle émet `confirm(password, { onError })`, `ProfilView` fait
  l'appel et lui renvoie l'erreur — un mot de passe refusé laisse l'étape 2 ouverte pour
  réessayer.
- **`HelpModal.vue`** — modale d'aide contextuelle générique (props `show`/`title`/`purpose`/
  `overview`/`steps`, emit `close`), réutilisable par n'importe quel module. Consommée par
  `EconomyMines.vue`.
- **`forms/CityCascadeSelect.vue`** — sélecteur royaume → province → ville en cascade, alimenté
  par `GET map`. Prop `stopAt="province"` (mandats, demande de siège au conseil) : la cascade
  s'arrête à la province, `initialCityId` présélectionne depuis la résidence.
- **`mandates/CharacterMandates.vue`** — bloc « Postes » de chaque carte du Profil (mandats, lot 2) :
  mandats et demandes avec un badge de statut **lisible sans la couleur**, motif d'un refus ou
  d'une révocation, actions (annuler, renouveler, « Déclarer mon poste » sur un conseiller en
  fonction), historique des postes replié, bouton « Demander un poste » piloté par `requestable`
  de l'API. **`mandates/MandateRequestModal.vue`** (demande ou renouvellement : niveau et lieu
  verrouillés, jamais de titre au renouvellement) et **`mandates/DeclareOfficeModal.vue`**
  (avertissement en trois temps : perte immédiate, gain après validation, aucun poste entre les
  deux). Les deux modales ont le focus piégé et Échap via `use/useDialogFocus.js`.
- **`NavMenu.vue`** — menu circulaire, variante **X3** (mix M1 + D2, 27/09/2026) : anneau laiton
  lumineux et états de D2, biseau fin et icône gravée de M1, plaque ardoise bordée d'ambre (Accueil/
  Économie/Sécurité/Animation/Profil). Tout en CSS scopé, sans image, 5 éléments sous le lien.
  Labels réactifs au changement de langue (`computed()` + `t()`, jamais un tableau JS figé).
  **Couleurs dans `navMenuPalette.js`** : `PALETTE` (disque repos/survol/page courante + icône,
  convertis en `--c*`/`--h*`/`--k*` par `paletteVars()`) et `PLATES` (plaques par état, passées en
  `--plate-*`) — une seule source pour le rendu et pour le garde-fou `navmenu-plate-contrast`.
  Plus aucune classe construite, donc plus de safelist Tailwind (garde-fou
  `tests/enforcement/tailwind-safelist.unit.test.js`). Page courante via le slot `custom` de
  `RouterLink` (`aria-current="page"`, correspondance **exacte** pour Accueil : `/app/` préfixe
  toutes les pages). 88 px (72 sous `tablet`), cotes en `--u` = 1 px de la référence D2 (116 px).
- **`SelectorMenu.vue`** = `SelectorTheme` + `SelectorLanguage` uniquement. Présent sur
  Welcome/Login/Register et sur toutes les pages `/app/*` via `NavBar`.
- **`buttons/*`**, **`forms/*`** — génériques, texte/label passés en props par l'appelant (donc
  pas de texte en dur *dans* ces composants ; le texte en dur était côté appelant, corrigé).

## i18n (`src/locales/fr.json` + `en.json`)

**Couverture complète** — tout texte UI visible passe par vue-i18n, sans
exception hors BBcode `SecurityGuet` (voir plus haut) et le nom de marque `Common.SiteName`
(identique dans les deux langues, routé par i18n quand même pour cohérence). **Une seule instance i18n**, créée dans `src/i18n/index.js` et utilisée à la fois par les
composants (via `app.use(i18n)` dans `main.js`) et par les consommateurs hors contexte composant
qui ne peuvent pas appeler `useI18n()` — `Validators.js` et `authStore.js`, via `i18n.global.t`.
⚠️ Il y en avait **deux** jusqu'au 20/09/2026, et personne ne changeait la locale de la seconde :
messages d'erreur de formulaire et toasts d'authentification restaient en français après un
passage en anglais. Ne pas réintroduire d'instance séparée.

**Le français est embarqué, l'anglais chargé à la demande** (chunk `en-*`) : les deux fichiers
partaient dans le bundle d'entrée alors qu'un visiteur n'en lit qu'un. Le français n'est
volontairement **pas** découpé : une requête de locale en échec (réseau, chunk absent après un
déploiement) ferait sinon afficher les clés brutes. `setLocale()` charge le fichier cible puis
bascule — jamais l'inverse — et **ne rejette jamais** : en cas d'échec, l'interface reste dans la
langue courante (avertissement console) et `SelectorLanguage` ne mémorise pas la préférence.
La langue mémorisée est appliquée dans `main.js` **avant `app.mount()`** (elle l'était dans un
`onMounted` de `SelectorLanguage`, donc après un premier rendu en français). `fallbackLocale:
'fr'` est gratuit puisque le français est toujours présent ;
`tests/enforcement/i18n-parity.unit.test.js` échoue en plus sur toute clé présente d'un côté et
absente de l'autre. Repli testé dans `tests/common/i18nLocaleLoading.test.js`.

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
  collé depuis le jeu, calcul du bilan par mine, filtrage/complétude par semaine, alerte de seuil
  (`thresholdAlert` : atteint dès l'égalité, prévention à 2 unités ou moins). Consommé par
  `EconomyMines.vue`. 🔴 **Décalage d'un jour** : pour le jour D, production[D], consommation[D]
  et **heures[D+1]** ; un jour dont une moitié manque est écarté, et une semaine n'est complète
  qu'avec les heures du lundi suivant. La synthèse par ressource (salaire entier sur l'or) a été
  supprimée le 05/10/2026 : elle inversait la lecture. **Fusion clavetée sur le nœud** de la mine (`mineKey`), jamais sur le
  numéro « Mine N », qui glisse quand une mine ouvre ou ferme (le numéro ne reste qu'en repli ;
  les semaines mémorisées sans nœud se rattachent une fois par leur numéro). `todayIso()` donne la
  date **de Paris**. Le futur Registre héritera de cette clé.
  **Bilingue** (07/10/2026, brief §5 bis) : lit l'écran français **ou anglais** (« Management of
  the mines », libellés relevés par Greg dans `admin/jeu/mines.md` §7.12), selon la langue du
  **texte collé**, jamais celle de l'interface. 🔴 **Aucune conversion d'unité** : *tons of stone* /
  *ounces of iron* portent les mêmes nombres que les quintaux et les kilos ; un test jumeau FR/EN le
  fige.
- **`gameCalendar.js`** — table d'ancrages année réelle ↔ année de jeu (2026 → 1474), transverse
  à tout module manipulant des dates de jeu (Économie aujourd'hui, futur Guet/Douane). ⚠️
  **Jumeau** de `app/Support/GameCalendar.php` (backend, emails) : `tests/common/gameCalendarTwin`
  fige la table **et** des conversions, son jumeau backend aussi.
- **`playerDates.js`** — **la seule déclaration** de l'année affichée pour chaque champ de date
  (`game` → 1474, `real` → 2026) : le calendrier appartient au champ, jamais à l'écran (fil
  `mandats-historique`, 06 et 09). Un champ non classé lève une erreur.
- **`kingdomTranslations.js`** — traduction FR des noms de royaumes (l'API renvoie les noms dans
  leur langue d'origine), alignée sur `lang/fr.json` côté backend.
- **`data/whatsNew.json`** — entrées de la « Chronique de l'Office » (`HomeView.vue`), scope
  public/privé par entrée.
- **`assets/style.css`** — styles globaux Tailwind (`@layer components`). Charte de boutons
  dégradée `.btn-grad-{couleur}` pour les actions pas encore migrées. Les classes plates
  `.btn-blue`/`.btn-yellow`/`.btn-rose`/`.btn-teal`/`.btn-slate`/`.btn-menu-rounded` ont été
  **supprimées** le 27/09/2026 : leur seul consommateur, `NavMenu.vue`, passe par des variables
  CSS.
  ⚠️ **Contraste** : chaque dégradé à texte blanc part de l'arrêt le plus clair qui passe 4,5:1
  (planchers commentés au-dessus de `.btn-grad-blue`), le survol ne fait qu'assombrir — gardé par
  `tests/enforcement/btn-grad-contrast.unit.test.js`.
  **`.page-card`** = carte de contenu des pages `/app/*` (ex-sélecteur d'élément `main`). ⚠️ Ne
  jamais styler l'élément `main` : `App.vue` porte l'**unique** repère `<main>` de chaque page ;
  les vues n'en déclarent pas. **`.page-container`** ne déclare aucune couleur de texte (elle
  imposait `text-white`, cause du texte invisible des pages légales en clair) — chaque bloc
  déclare la sienne, par thème.
- **`assets/odc-buttons.css`** — boutons « relief 3D » de l'identité visuelle du 27/09/2026
  (copie de `logo/boutons/`, hors dépôt), importés dans `main.js` après `style.css`, hors
  Tailwind (classes préfixées `odc-`). **Cible pour tout nouveau bouton** : `odc-btn` (+ `--rect`,
  `--icon`, `--sm`/`--lg`) et une couleur `odc--{orange|green|red|blue|gold|teal|rose|violet|
  slate|dark}` ; `odc-dot` pour les pastilles (chronique de `HomeView`). Migrés à ce jour : la
  `NavBar` (et `SelectorTheme`/`SelectorLanguage`, donc aussi sur les pages publiques), les
  pastilles de la chronique, `ProfilView`, les pages publiques (connexion, inscription,
  vérification d'email, 404, bannière et modale cookies), et les boutons de génération d'`EconomyMines`
  (mise en forme du jour, bilan hebdomadaire) et de `SecurityGuet` (entrées/sorties) ;
  `btn-primary`/`btn-grad-*` restent ailleurs (exports BBcode, flèches de semaine, formulaires)
  jusqu'à leur migration. Pilules pour les actions de page (`--sm` dans les cartes), rectangles pour la
  barre de navigation et les formulaires.
  **Trois niveaux** (voir `logo/boutons/README.md`) : **signature** `odc-btn` seul (laiton
  complet, réservé au menu M1), **standard** `odc-btn--soft` (face colorée sans laiton : barre de
  navigation, actions principales et actions des cartes), **discret** `odc-btn--quiet` (fond
  teinté clair, sans relief : Annuler, Gérer mes préférences). Ne jamais poser le relief complet
  sur une action ordinaire : tout crierait au même niveau.
  ⚠️ Trois écarts avec la source, consignés dans `logo/boutons/README.md` (« Retouches
  validées ») : police héritée du site (Manrope n'est pas chargée), **aucun éclaircissement au
  survol d'un bouton texte** (`brightness(1.08)` passait 6 couleurs sur 9 sous 4,5:1), et pas de
  liseré foncé extérieur autour du laiton. Contraste des `--b1` gardé par `tests/enforcement/odc-buttons-contrast.unit.test.js`.
- **`assets/base.css`** — jetons de base alignés sur `CHARTE-GRAPHIQUE.md` (27/09/2026) : ne
  restent que les jetons utilisés (l'ancien bloc de 45 variables `--odc-*`, dont un bleu primaire
  contraire à la charte, en comptait 35 sans usage). **Focus clavier par défaut à deux tons** — or
  `#fde68a` contre l'élément (`box-shadow`), brun `#451a03` autour (`outline`) : l'or seul tombe à
  1,2:1 sur une carte claire. Les composants `odc-*` et le menu gardent leur propre anneau doré.
  Sélection de texte or sur quasi-noir, barre de défilement ardoise. Fond et couleur du `body`
  portés par `style.css`/`App.vue`, plus par ce fichier.
- **Mouvement (WCAG 2.2.2, PR #58)** — `assets/base.css` porte une règle **globale**
  `@media (prefers-reduced-motion: reduce)` : durées d'animation et de transition à `0.01ms`
  `!important` (pas `none` : `animationend`/`transitionend` se déclenchent encore), une seule
  itération, `scroll-behavior: auto`. Toute animation automatique est **finie** : jamais
  `animate-bounce`/`spin`/`ping`/`pulse` (infinies) dans une vue ; une animation maison se déclare
  dans `tailwind.config.js` (`extend.animation`, ex. `bounce-hint`) et s'emploie derrière
  `motion-safe:`. Deux nombres : **budget de conception 3 s**, **plafond réglementaire 5 s**
  jamais approché. Gardé par `tests/enforcement/motion.unit.test.js`. Un composant qui déplace un
  élément au survol neutralise aussi la translation en mouvement réduit (ex. `NavMenu`).
- **`use/useNavigationLoading.js`** — état partagé de l'overlay de navigation (délai anti-flash de
  150 ms, contexte `office`/`chest`/`api`). `trackApiCall(promesse, { context, navigates })`
  couvre un envoi à l'API : sans lui, rien ne bougeait pendant l'attente, jusqu'aux 20 s du
  délai d'`api.js`. Branché sur la connexion (contexte `office`, même écran que la navigation),
  l'inscription, les renvois de lien, l'ajout de personnage, la résidence, la suppression de
  compte et la déconnexion. `navigates: true` **tient** l'écran : la navigation qui suit n'en
  change ni la phrase ni le délai, un seul écran du clic à l'arrivée ; `afterEach`/`onError` ou
  l'échec de l'envoi le libèrent. `LoginView` ignore en plus un second envoi pendant l'attente
  (le limiteur `login` compte chaque tentative). **`use/useFormValidation.js`** — messages d'erreur inline
  des formulaires, avec `modules/Validators.js`.
- **`modules/goBackOrWelcome.js`** — retour arrière sûr (revient à `welcome` quand il n'y a pas
  d'historique).
- **`public/.htaccess`** — déployé tel quel dans `dist/` : fallback SPA (`mod_rewrite`), qui
  exclut `/assets/`, `/.well-known/` et tout chemin contenant `/api/` (02/10/2026 : un scanner
  obtenait 200 sur `/access/api/v1/system/ping`) — garde-fou
  `tests/enforcement/htaccess-spa-fallback.unit.test.js`,
  `Cache-Control: public, max-age=31536000, immutable` sur `/assets/*.js|css`, `no-cache` sur
  `index.html`. **Origine canonique** (29/09/2026) : `www` et `http://` redirigent vers
  `https://officedescoffres.creacube.be` (chemin et paramètres conservés, `/.well-known/` exclu),
  avant le fallback SPA — une seule origine peut être autorisée par CORS côté API. Garde-fous :
  `tests/enforcement/htaccess-canonical-origin.unit.test.js` et l'étape de `deploy.yml` qui sonde
  les quatre variantes en prod. Pas de HSTS (décision séparée). ⚠️ À traiter avec la stratégie
  `admin/strategies/performance.md`.
- **`public/images/email/logo-horizontal.png`** (05/10/2026) — logo des emails du backend, servi par le
  site des joueurs et non par l'admin (un domaine « admin » dans un email ressemble à de
  l'hameçonnage). PNG 480 px (Gmail n'affiche pas le SVG). Hors bundle ; garde-fou
  `tests/enforcement/email-logo.unit.test.js`. Ne pas le renommer : les emails déjà envoyés le chargent.
- **`scripts/`** (hors bundle) — `vite-bundle-budget.mjs` + `checkBundleBudget.mjs` (budget de
  taille : le brotli bloque le build, le brut avertit), `docs-sync-check.sh` (CI : un seul
  décompte de tests dans le repo, `ARCHITECTURE.md` pas périmée de plus de 30 jours sur le dernier
  commit `src/`), `whatsNewAnnounce.mjs` (annonces Discord à partir du diff de `whatsNew.json`).

## Tests (`frontend/tests/`)

Décompte à jour dans `README.md` (source unique, pas dupliqué ici — `npm test` lance la suite en
one-shot, le mode watch vit sous `npm run test:watch`). Structure détaillée dans `docs/TESTS.md` :
dossier = domaine (`auth/`, `cookies/`, `eco/`, `legal/`, `mandates/`, `province/`, `security/`, `common/`, `enforcement/`,
`fixtures/`). Toute vue utilisant `useI18n()` doit recevoir un
plugin `createI18n({ legacy: false, ... })` dans `global.plugins` du test (miroir de la config
`main.js`) — sinon `useI18n()` lève une erreur au montage.

## Contraintes projet

- Frontend **FR + EN obligatoire** sur toute vue/composant, y compris existant.
- Ne jamais casser le design existant (NavMenu circulaire, palette, animations).
- Cookies : catégorie « Préférences » uniquement (dégradable), aucun tracking — voir
  `admin/strategies/cookies.md`.
