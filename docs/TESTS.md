# Tests — Office des Coffres (frontend)

Référence structurelle chargée à la demande (voir `_IA/ODC/ODC-strategie-tests.md` pour le
raisonnement complet). Décompte à jour dans `README.md`, ne pas dupliquer ici.

## Principe : adapter la portée du test au périmètre du changement

Pendant le développement, ne lancer que les tests du domaine concerné. La suite complète est
réservée à la fin d'une tâche cohérente ou juste avant un push.

## Structure de `tests/`

**Dossier = domaine métier**, aligné sur `src/views/modules/*` :

| Domaine | Dossier | Script | Contenu |
|---|---|---|---|
| Auth | `tests/auth/` | `npm run test:auth` | `authStore`, `LoginView`, `RegisterView`, `ProfilView`, `AddCharacterView`, `VerifyEmailView`, guards de route |
| Cookies | `tests/cookies/` | `npm run test:cookies` | `cookieStore`, `CookiesBanner`, `CookiesModal` |
| Économie | `tests/eco/` | `npm run test:eco` | `mineParser` (logique pure), `EconomyMines` |
| Sécurité | `tests/security/` | `npm run test:security` | `SecurityGuet` |
| Commun | `tests/common/` | `npm run test:common` | `NavBar`, `NavMenu`, `HomeView`, `HelpModal`, `Validators`, `kingdomTranslations`, `whatsNewAnnounce`, `gameCalendar` (transverse — utilisé par Économie et à terme le Guet/la Douane, pas propre à un domaine) |
| Légal | `tests/legal/` | `npm run test:legal` | `CookiesPolicyView`/`PrivacyPolicyView`, routes `/legal/cookies` et `/legal/privacy` |
| Enforcement | `tests/enforcement/` | `npm run test:enforcement` | `storage-usage` (logique pure) — garde-fou admin/strategies/cookies.md §9 : `localStorage`/`sessionStorage`/`document.cookie` interdits hors `cookieStore.js` (whitelist `authStore.js`) |
| — | `tests/fixtures/` | — | Données réelles anonymisées, partagées entre domaines |

**Suffixe `.unit.test.js` = logique pure sans DOM** (parseurs, calculs, helpers) — rapide, pas de
jsdom à monter. Pas de suffixe = integration/jsdom (composants, vues, stores).

Ajouter un test dans le bon dossier suffit — aucun script `package.json` à mettre à jour, les
scripts pointent sur le dossier entier (`vitest run tests/<domaine>`).

## Scripts

| Script | Ce qu'il fait |
|---|---|
| `npm test` / `npm run test:run` | Suite complète, one-shot |
| `npm run test:watch` | Mode watch (dev interactif uniquement) |
| `npm run test:changed` | Seulement les tests impactés par le diff git |
| `npm run test:logic` | Tests `.unit.test.js` uniquement (voir piège ci-dessous) |
| `npm run test:<domaine>` | Un domaine ciblé (table ci-dessus) |
| `npm run test:coverage` | Suite complète + rapport de couverture |

### ⚠️ Piège : un glob ne fonctionne pas en argument positionnel Vitest

`vitest run '**/*.unit.test.js'` échoue (`No test files found`) — l'argument positionnel de
`vitest run` est un **filtre substring** appliqué sur le chemin résolu de chaque fichier de test
matché par `include` (config), pas un glob qui remplace `include`. `test:logic` utilise donc un
filtre substring sur la convention de nommage : `vitest run unit.test`, qui matche tout fichier
dont le chemin contient `unit.test` — fonctionne car c'est exactement notre convention de suffixe.

## Temps de référence (mesurés le 08/08/2026, machine de dev)

| Suite | Fichiers | Tests | Durée |
|---|---|---|---|
| `test:logic` (fichiers `.unit.test.js`) | 5 | 79 | ~6 s |
| `test:auth` (le plus gros domaine) | 8 | 46 | ~29 s |
| Suite complète (`npx vitest run`) | 22 | 199 | ~45 s |

Si un chiffre dérape de plus de 50 % lors d'une prochaine mesure, investiguer (jsdom qui traîne,
mock manquant qui fait un vrai appel réseau, etc.).

### D'où vient le coût d'un run

Ce n'est **pas** le nombre de tests qui coûte — l'exécution proprement dite prend moins de 2 s
pour toute la suite. Le coût vient du nombre de **fichiers** qui montent un jsdom (~11 s pièce
sur `/mnt/d` en WSL2) et du démarrage de Vite (~20 s, incompressible une fois par run). D'où
l'intérêt réel de `.unit.test.js` : pas de découpage arbitraire, juste éviter de payer un jsdom
quand le test n'en a pas besoin. En développement, le mode watch (`npm run test:watch`) ne paie
le démarrage qu'une fois — chaque sauvegarde ne relance que les fichiers concernés, en moins
d'une seconde.

## CI

`tests.yml` : `on: pull_request` + `on: workflow_call` (appelé par `deploy.yml`, qui bloque le
déploiement si la suite échoue — voir `_IA/ODC/ODC-strategie-git.md` §6bis pour le contexte).
Une étape d'enforcement précède `npx vitest run` : échoue si un `*.test.js` traîne à la racine
de `tests/` plutôt que dans un dossier de domaine (garantit que la structure ci-dessus reste
respectée sans dépendre de la vigilance humaine). Une seconde étape,
`scripts/docs-sync-check.sh` (Docs #10 de `admin/strategies/docs.md`), tourne juste après le
checkout (`fetch-depth: 0`, nécessaire au calcul de fraîcheur) : échoue si plusieurs chiffres de
tests différents apparaissent dans les `.md` du repo, ou si `docs/ARCHITECTURE.md` annonce une
date de mise à jour de plus de 30 jours antérieure au dernier commit dans `src/`.
