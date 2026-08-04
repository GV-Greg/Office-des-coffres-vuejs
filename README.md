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
│   │   ├── AddCharacterView.vue # Route /app/character/new — création de personnage (royaume→province→ville)
│   │   └── ProfilView.vue       # Liste des personnages du compte, statut individuel
│   └── modules/
│       ├── security/           # Module Guet (export BBcode)
│       ├── economy/            # Module Économie (en développement)
│       ├── animation/          # Module Animation (en développement)
│       └── company/            # Module Compagnie (en développement)
├── stores/
│   ├── authStore.js            # Authentification (Pinia)
│   └── cookieStore.js          # Consentement cookies (Pinia)
├── api.js                       # Client HTTP Axios (baseURL VITE_API_ENDPOINT_*)
├── services/
│   └── anim.service.js         # Appels API animation (utilise api.js)
├── components/
│   ├── NavBar.vue              # Barre de navigation (routes /app/*)
│   ├── NavMenu.vue             # Menu circulaire des modules
│   ├── CookiesBanner.vue       # Bannière RGPD
│   └── CookiesModal.vue        # Gestion détaillée des cookies
├── router/index.js             # Routes : /, /login, /register, /app/*
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
| Accueil | `/app/` | Fonctionnel |
| Sécurité — Guet | `/app/secu/guet` | Fonctionnel (liste "d'hier" pré-remplie via cookie comfort) |
| Économie | `/app/eco` | En développement |
| Animation | `/app/anim` | En développement |
| Compagnie | `/app/company` | En développement |
| Vérification email | `/verify-email` | Fonctionnel — connexion auto après clic sur le lien reçu |
| Créer un personnage | `/app/character/new` | Fonctionnel — sélecteur royaume→province→ville en cascade |
| Profil | `/app/profil` | Fonctionnel — liste des personnages du compte, statut individuel, FR/EN |

Un compte s'inscrit désormais avec seulement email + mot de passe ; la création de personnage
(pseudo + ville) se fait ensuite via `/app/character/new`, un compte pouvant avoir plusieurs
personnages.

---

## Tests

```bash
npx vitest run                                        # Tous les tests (Vitest)
npx vitest run tests/stores/authStore.test.js         # Store auth uniquement
```

⚠️ `npm run test` lance Vitest en mode **watch** — ne pas l'utiliser tel quel en CI ou pour une
vérification ponctuelle, préférer `npx vitest run`.

86 tests verts au 03/08/2026, répartis dans `tests/{components,modules,router,stores,views}`
(dont `VerifyEmailView`, `AddCharacterView`, `RegisterView`, `ProfilView`) + fixtures réelles
dans `tests/fixtures/` (données anonymisées pour le bug export sorties). Toute vue utilisant
`useI18n()` doit recevoir un plugin `createI18n({ legacy: false, ... })` dans
`global.plugins` du test.

---

## Conventions

- Toujours prévoir les traductions FR **et** EN pour toute nouvelle vue ou composant, y compris l'existant dès qu'on le touche
- Toujours afficher la mention "outil non officiel"
- Cookies : catégories "session" (connexion) et "comfort" (thème/langue/préférences par module, optionnelle, dégradation gracieuse) uniquement — aucun cookie publicitaire ni traçage
- Tests Vitest obligatoires pour chaque nouvelle fonctionnalité, avant commit
- Branches : `feat/<nom>`, `fix/<nom>`, `chore/<nom>` — jamais directement sur `main`
- Commits et push uniquement à la demande explicite
