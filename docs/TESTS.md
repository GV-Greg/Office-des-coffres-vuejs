# Tests — Office des Coffres (frontend)

Référence structurelle chargée à la demande (voir `_IA/ODC/ODC-strategie-tests.md` pour le
raisonnement complet). 160 tests verts au 08/08/2026 (`npx vitest run`) — décompte à jour dans
`README.md`, ne pas dupliquer ici.

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
| Commun | `tests/common/` | `npm run test:common` | `NavBar`, `NavMenu`, `HomeView`, `Validators`, `kingdomTranslations`, `whatsNewAnnounce` |
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
| `test:logic` (4 fichiers `.unit.test.js`) | 4 | 50 | ~7 s |
| `test:auth` (le plus gros domaine) | 8 | 46 | ~29 s |
| Suite complète (`npx vitest run`) | 20 | 160 | ~50 s |

Si un chiffre dérape de plus de 50 % lors d'une prochaine mesure, investiguer (jsdom qui traîne,
mock manquant qui fait un vrai appel réseau, etc.).

## CI

`tests.yml` : `on: pull_request` + `on: workflow_call` (appelé par `deploy.yml`, qui bloque le
déploiement si la suite échoue — voir `_IA/ODC/ODC-strategie-git.md` §6bis pour le contexte).
Une étape d'enforcement précède `npx vitest run` : échoue si un `*.test.js` traîne à la racine
de `tests/` plutôt que dans un dossier de domaine (garantit que la structure ci-dessus reste
respectée sans dépendre de la vigilance humaine).
