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
│   ├── auth/                   # Login, Register, Profil
│   └── modules/
│       ├── security/           # Module Guet (export BBcode)
│       ├── economy/            # Module Économie (en développement)
│       ├── animation/          # Module Animation (en développement)
│       └── company/            # Module Compagnie (en développement)
├── stores/
│   ├── authStore.js            # Authentification (Pinia)
│   └── cookieStore.js          # Consentement cookies (Pinia)
├── services/
│   ├── auth.service.js         # Appels API auth
│   ├── anim.service.js         # Appels API animation
│   └── http-common.js          # Instance Axios configurée
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
npm run dev       # Serveur dev Vite sur http://localhost:5173
```

Variable d'environnement à configurer dans `.env` :
```
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Modules

| Module | Route | État |
|---|---|---|
| Accueil | `/app/` | Fonctionnel |
| Sécurité — Guet | `/app/secu/guet` | Fonctionnel (bug parsing sorties connu) |
| Économie | `/app/eco` | En développement |
| Animation | `/app/anim` | En développement |
| Compagnie | `/app/company` | En développement |
| Profil | `/app/profil` | Fonctionnel |

---

## Conventions

- Toujours prévoir les traductions FR **et** EN pour toute nouvelle vue ou composant
- Toujours afficher la mention "outil non officiel"
- Cookies : essentiels et session uniquement — aucun cookie publicitaire ni traçage
- Branches : `feat/<nom>`, `fix/<nom>`, `chore/<nom>` — jamais directement sur `main`
- Commits et push uniquement à la demande explicite
