# Office des Coffres — Frontend

> Outil communautaire non officiel pour le jeu [Renaissance Kingdoms](https://www.renaissancekingdoms.com/).
> Ce site n'est pas affilié à Celsius Online, l'éditeur du jeu.

Site : [officedescoffres.creacube.be](https://officedescoffres.creacube.be)
Dépôt backend : [Office-des-coffres-backend](https://github.com/GV-Greg/Office-des-coffres-backend)

---

## Stack technique

| Outil | Version | Rôle |
|---|---|---|
| Vue.js | 3.4 | Framework (Composition API) |
| Vite | 6.2 | Bundler |
| Tailwind CSS | 3.4 | Styling utilitaire |
| Pinia | 2.1 | État global |
| Vue Router | 4.2 | Routage SPA |
| vue-i18n | 9.9 | Internationalisation (FR/EN) |
| notivue | 2.4 | Notifications toast |
| Axios | 1.6 | Requêtes HTTP |

---

## Structure du projet

```
src/
├── views/
│   ├── WelcomeView.vue          # Page d'accueil pré-connexion (cadenas animé)
│   ├── HomeView.vue             # Dashboard post-connexion
│   ├── auth/
│   │   ├── LoginView.vue        # Connexion par email + renvoi d'email de vérification
│   │   ├── RegisterView.vue     # Inscription (email + mot de passe uniquement)
│   │   ├── VerifyEmailView.vue  # Route /verify-email — connexion auto après clic sur le lien reçu
│   │   ├── AddCharacterView.vue # Route /app/character/new — création de personnage (royaume→province→ville), résidence aussi modifiable depuis ProfilView
│   │   └── ProfilView.vue       # Liste des personnages du compte, résidence, statut individuel, choix du personnage actif
│   └── modules/
│       ├── security/           # Module Guet (export BBcode)
│       ├── economy/            # EconomyMines.vue — bilan des mines (export BBcode)
│       ├── animation/          # Module Animation (en développement)
│       └── company/            # Module Compagnie (en développement)
├── stores/
│   ├── authStore.js            # Authentification (Pinia) + personnage actif (activeCharacter/setActiveCharacter)
│   └── cookieStore.js          # Consentement cookies (Pinia)
├── api.js                       # Client HTTP Axios (baseURL VITE_API_ENDPOINT_*)
├── data/
│   └── whatsNew.json           # Entrées de la "Chronique de l'Office" (HomeView), scope public/private
├── modules/
│   ├── Validators.js            # Validation de formulaires
│   ├── kingdomTranslations.js   # Traduction FR des noms de royaumes (alignée sur lang/fr.json backend)
│   ├── gameCalendar.js          # Année du jeu (2026 → 1474) — table d'ancrages, transverse à tous les modules
│   └── mineParser.js            # Parsing + calcul du bilan des mines (logique pure, testée isolément)
├── services/
│   └── anim.service.js         # Appels API animation (utilise api.js)
├── components/
│   ├── NavBar.vue              # Barre de navigation (routes /app/*)
│   ├── NavMenu.vue             # Menu circulaire des modules
│   ├── SelectorMenu.vue        # SelectorCharacter + SelectorTheme + SelectorLanguage
│   ├── SelectorCharacter.vue   # Switch du personnage actif (visible si connecté et >1 personnage)
│   ├── CookiesBanner.vue       # Bannière RGPD
│   ├── CookiesModal.vue        # Gestion détaillée des cookies
│   ├── HelpModal.vue           # Modale d'aide générique (but / fonctionnement / étapes) — réutilisable par tout module
│   └── forms/CityCascadeSelect.vue  # Sélecteur royaume→province→ville, réutilisé par AddCharacterView et l'édition de résidence
├── router/index.js             # Routes : /, /login, /register, /verify-email, /app/*
├── i18n/                       # Traductions FR/EN
└── assets/
    └── style.css               # Styles globaux Tailwind (@layer components)
```

---

## Déploiement

### Production

Déploiement automatique via **GitHub Actions** sur push `main` :
1. Build Vite (`npm run build`) — variable `VITE_API_ENDPOINT_PROD` injectée depuis les secrets GitHub
2. Transfert FTP du dossier `dist/` vers `officedescoffres.creacube.be` (O2Switch, dossier `/front/`)

### Développement local

```bash
npm install
npm run dev       # Serveur dev Vite sur http://localhost:5001 (port fixé dans vite.config.js)
```

Variables d'environnement à configurer dans `.env` (voir `.env.example`) :
```
VITE_API_ENDPOINT_DEV=
VITE_API_ENDPOINT_PROD=
```

---

## Modules

| Module | Route | État |
|---|---|---|
| Accueil | `/app/` | Fonctionnel — intègre la "Chronique de l'Office" (`whatsNew.json`), entrées publiques et privées (connecté) |
| Sécurité — Guet | `/app/secu/guet` | Fonctionnel (liste "d'hier" pré-remplie via cookie comfort) |
| Économie — Bilan des mines | `/app/eco/mines` (`/app/eco` redirige) | Fonctionnel — colle le texte "mines" du jeu, bilan hebdo ou mise en forme du jour, export BBcode, mémorisation "confort", aide contextuelle. ⚠️ Sélecteur de semaine à corriger : voir le bug bloquant « dates du jeu » dans `roadmap.md` |
| Animation | `/app/anim` | En développement |
| Compagnie | `/app/company` | En développement |
| Vérification email | `/verify-email` | Fonctionnel — connexion auto après clic sur le lien reçu |
| Créer un personnage | `/app/character/new` | Fonctionnel — sélecteur royaume→province→ville en cascade |
| Profil | `/app/profil` | Fonctionnel — liste des personnages du compte, statut individuel, choix du personnage actif, FR/EN |

Un compte s'inscrit désormais avec seulement email + mot de passe ; la création de personnage
(pseudo + ville) se fait ensuite via `/app/character/new`, un compte pouvant avoir plusieurs
personnages.

---

## Tests

```bash
npm test              # Tous les tests, one-shot (alias de `vitest run`)
npm run test:auth     # Un domaine ciblé — voir docs/TESTS.md pour la liste complète
```

199 tests verts au 08/08/2026, répartis par domaine dans `tests/{auth,cookies,eco,security,
common,fixtures}` (structure et scripts détaillés dans `docs/TESTS.md`).

Fixtures réelles dans `tests/fixtures/` :
- `Bug_ExportSorties.txt` — données anonymisées, non-régression du parsing des sorties (Guet)
- `mines-2025-11-10.json` — relevé hebdomadaire réel (6 mines, jour par jour) : vérifie que
  l'imputation entretien/salaires par ressource reproduit exactement les balances du classeur
  Excel de référence

Toute vue utilisant `useI18n()` doit recevoir un plugin `createI18n({ legacy: false, ... })`
dans `global.plugins` du test.

---

## Conventions

- Toujours prévoir les traductions FR **et** EN pour toute nouvelle vue ou composant, y compris l'existant dès qu'on le touche
- **Exports BBcode : les trois régimes sont volontairement différents, ne pas les uniformiser.**
  `EconomyMines::bilanToBBcode()` (bilan hebdo) suit la langue de l'UI — le forum du jeu a aussi
  des parties anglaises ; `EconomyMines::formatDayForForum()` et `SecurityGuet::to_export()`
  restent en français fixe. Décision explicite de Greg (08/08/2026)
- **Dates lues par un joueur : toujours l'année du jeu** (`gameCalendar.js`, 2026 → 1474) —
  interface comme export. Les dates réelles ne servent qu'en interne (bornes de semaine,
  filtrage, clés de cache)
- Toujours afficher la mention "outil non officiel"
- Cookies : catégories "session" (connexion) et "comfort" (thème/langue/préférences par module, optionnelle, dégradation gracieuse) uniquement — aucun cookie publicitaire ni traçage
- Tests Vitest obligatoires pour chaque nouvelle fonctionnalité, avant commit
- Branches : `feat/<nom>`, `fix/<nom>`, `chore/<nom>` — jamais directement sur `main`
- Commits et push uniquement à la demande explicite
