# Changelog — Office des Coffres (frontend)

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Une entrée par PR
mergée sur `main` (ou merge direct pour les deux entrées antérieures aux PR GitHub). Pas de
versionnage sémantique — chaque merge sur `main` déclenche un déploiement, la date de merge fait
foi. L'historique détaillé (raisonnement, incidents, décisions) vit dans `admin/suivi/*.md` et
`admin/archives/` à la racine du workspace ; ce fichier n'en retient que le résumé daté.

## [2026-09-25] — PR #61

### Docs
- `docs/TESTS.md` : dossier `tests/browser/` (mesure de contraste en navigateur, hors Vitest,
  référence figée), script `test:contrast`, garde-fous ajoutés le 24-25/09 (`i18n-parity`,
  `btn-grad-contrast` et sa portée limitée, `page-container-no-text-color`,
  `legalCardTextColor`, `i18nLocaleLoading`).
- `docs/ARCHITECTURE.md` : `.page-card`, repère `<main>` unique porté par `App.vue`,
  `.page-container` sans couleur de texte, règle de contraste de la charte `.btn-grad-*`.

## [2026-09-25] — PR #60

### Changed
- **Discipline de la référence de contraste, écrite là où elle s'applique** (en-tête de
  `textContrast.mjs`, note de `textContrast.baseline.json`, message « DISPARU ») : chaque
  correction fait échouer la mesure avec « DISPARU », et c'est voulu ; la mise à jour de la
  référence va **dans le même commit** que la correction ; c'est le **diff de la référence** qui
  se relit ; jamais de régénération en bloc pour faire passer. `--update-baseline` affiche
  désormais ce diff ligne par ligne avant d'écrire.

## [2026-09-25] — PR #59

### Added
- **Référence figée pour la mesure de contraste** (`tests/browser/textContrast.baseline.json`) :
  les 26 textes sous le seuil et les textes non mesurables connus. `textContrast.mjs` compare à
  cette référence et **échoue dès que l'ensemble change** — un nouveau défaut, ou un défaut
  corrigé sans mise à jour de la référence. `--update-baseline` pour la régénérer, diff à relire.
  Contrôlé dans les deux sens (ligne retirée → « NOUVEAU », ligne fictive → « DISPARU »).

### Changed
- `btn-grad-contrast.unit.test.js` dit ce qu'il ne regarde pas : il ne lit que `style.css`, pas
  les dégradés écrits dans les vues (« Entrez sans compte » lui a échappé) — la page rendue fait
  foi via `textContrast.mjs`. À retirer quand celui-ci passera en CI.

## [2026-09-25] — PR #57

### Docs
- **Thème sombre par défaut : décision écrite** (`docs/DECISIONS.md`) — délibéré (Greg,
  24/09/2026), et non un oubli de `prefers-color-scheme`. Raisons : identité visuelle (le sombre
  est le thème fini) et état du thème clair (26 textes sous le seuil de contraste). **Condition de
  réouverture** : la mesure au ratio au vert sur les deux thèmes. L'argument énergétique n'est
  gardé qu'en remarque secondaire, borné (surtout OLED, peu sur LCD, et le site s'utilise sur
  ordinateur). Commentaire posé sur `DEFAULT_COMFORT_DATA` dans `cookieStore.js`. Aucun
  changement de comportement.
- Date de l'entrée #56 corrigée : 25/09, et non 24/09 — merge à 00:00:06 (heure de Bruxelles).

## [2026-09-25] — PR #56

### Fixed
- **`.page-container` n'impose plus `text-white` à son contenu.** Cause racine du texte invisible
  des pages légales (#54 en était l'override d'urgence). Inventaire préalable en navigateur,
  **11 états × 2 thèmes** des quatre autres vues qui l'utilisent (Login, Register, VerifyEmail,
  AddCharacter — états d'erreur, « vérifiez votre boîte », renvoi, lien invalide compris) :
  **aucun texte n'en dépendait** (contrôle positif : 72 dépendances retrouvées sur l'ancienne page
  de confidentialité). Rendu vérifié identique au pixel sur 16 états × 2 thèmes.

### Added
- `tests/enforcement/page-container-no-text-color.unit.test.js` — `.page-container` ne déclare
  aucune couleur de texte.

## [2026-09-24] — PR #55

### Added
- `tests/browser/textContrast.mjs` (`npm run test:contrast -- <url> [chrome]`) — contraste de
  chaque texte contre son **fond résolu**, dans un vrai navigateur, sur les 7 pages publiques et
  les **deux thèmes** (la bascule est constatée sur `<html>`, sinon la mesure est refusée). Seuil
  4,5:1, ou 3:1 pour le grand texte. Fond résolu en composant les ancêtres semi-transparents ;
  fond en **dégradé mesuré contre chaque arrêt**, le pire décide ; texte en
  `background-clip: text` classé **non mesurable**, jamais estimé depuis sa `color` (qui vaut
  `rgba(0,0,0,0)`). Remplace la mesure « texte de la couleur de son fond » utilisée pour #54, qui
  annonçait 0 défaut alors que des textes restaient sous le seuil. **Pas encore branché en CI** :
  26 textes sous le seuil aujourd'hui, à traiter par le lot « contrastes de texte » avant que le
  garde-fou ne gate.
- `playwright-core` 1.63.0 en dépendance de développement (version exacte).

## [2026-09-24] — PR #54

### Fixed
- 🔴 **Pages légales illisibles en thème clair — mention obligatoire RGPD effacée.**
  `.page-container` impose `text-white` à tout son contenu ; les `<p>` ont leur propre couleur,
  mais les `<h3>`, `<li>` et `<strong>` héritaient du blanc, sur la carte blanche : 1:1,
  invisibles. Mesuré en navigateur sur `main` : **72** éléments de texte invisibles sur
  `/legal/privacy`, 45 sur `/legal/cookies`, 23 sur `/legal/mentions` — dont le **nom et
  l'adresse postale du responsable de traitement** (RGPD art. 13(1)(a)) ; seul l'email restait,
  parce que c'est un lien. La carte des trois pages déclare désormais sa couleur de texte par
  thème (`text-slate-800 dark:text-white`) : **0** élément invisible après correctif, thème
  sombre identique au pixel près. Exposition : le thème part d'un défaut sombre écrit en dur
  (pas de `prefers-color-scheme`) — la page cassée touchait qui passait en clair, et restait
  cassée à chaque visite si les préférences étaient acceptées.

### Added
- `tests/legal/legalCardTextColor.unit.test.js` — chaque carte de page légale déclare une
  couleur de texte foncée en clair et une couleur en sombre. Échoue sur les trois pages
  d'origine. Correctif d'urgence : le désamorçage de `text-white` dans `.page-container`
  (Login, Register, VerifyEmail, AddCharacter s'y appuient) fera l'objet d'une PR distincte.

## [2026-09-24] — PR #53

### Fixed
- **Contraste des boutons en dégradé (WCAG 1.4.3).** Le texte blanc passait sous 4,5:1 sur
  l'arrêt clair de tous les dégradés : `green-400` 1,74:1, `red-400` 2,77:1, orange du bouton
  principal 2,26:1… Décision de Greg (24/09) : on garde le texte blanc, on fonce les fonds.
  Chaque dégradé part désormais de l'arrêt le plus clair qui passe 4,5:1 — `slate-500`,
  `red-600`, `blue-600`, `purple-600`, `green-700`, `yellow-700`, `cyan-700`, `orange-700` —
  en gardant son écart de deux crans ; le survol ne fait qu'assombrir. Même traitement pour les
  dégradés orange → rouge hors charte (`.btn-primary`/`.btn-default`, `SelectorCharacter`,
  pastilles de `HelpModal`). Aucun libellé ne change. Mesuré sur le rendu réel (arrêts calculés
  par le navigateur, repos et survol, thèmes clair et sombre) : tous ≥ 4,76:1.

### Added
- `tests/enforcement/btn-grad-contrast.unit.test.js` — calcule le contraste du blanc sur
  **chaque arrêt** de chaque dégradé à texte blanc de `style.css`, survol compris. axe classe
  ces boutons « à vérifier » (fond en dégradé), jamais en violation : sans ce test, le futur
  garde-fou axe ne verrait pas une régression. Échoue sur 9 règles avec la charte d'origine.

## [2026-09-24] — PR #52

### Fixed
- **Le message d'échec de chargement de l'anglais était en français** — donc illisible pour qui
  a justement demandé l'anglais. Il se dit désormais dans la langue **demandée**. Une clé dans
  `en.json` ne pouvait pas convenir : elle ne s'afficherait que si `en.json` était chargé, soit
  le cas où le message ne sert pas. D'où une paire de littéraux FR + EN dans
  `src/i18n/index.js`, **exception documentée** à la règle « tout texte dans les JSON ». La clé
  `Common.Language.LoadFailed` (#51), morte côté anglais, est retirée des deux fichiers.
- **« Réessayez » était faux.** Vérifié en navigateur : un import dynamique raté reste en échec
  dans le registre de modules de Chrome, le second clic ne refait aucune requête. Le message
  demande donc de **recharger la page**, seule action qui retente le téléchargement.

### Added
- Test : la locale n'est **jamais** basculée, même transitoirement, quand l'anglais échoue
  (observateur synchrone sur la locale) — un état « posé avant la résolution du chargement puis
  rétabli » donnerait la bonne valeur finale et passerait inaperçu autrement.
- Tests de **persistance** : consentement accepté, un échec n'écrit pas la préférence « en » en
  `localStorage` (sinon le rechargement conseillé repartirait sur l'anglais en échec), avec un
  contrôle positif — une bascule réussie, elle, l'écrit. Vérifié aussi en navigateur : stockage
  inchangé après l'échec, rechargement propre en français, sans toast au démarrage.
- Commentaire « rechargez, jamais réessayez » à côté des littéraux, qui étend l'avertissement à
  **tout** `import()` dynamique — y compris les 13 routes découpées de `src/router/index.js`, dont
  l'échec de chargement est aujourd'hui silencieux (relevé en roadmap).

### Notes
- Annonce aux lecteurs d'écran vérifiée dans le DOM rendu : notivue insère le message dans une
  zone `role="alert"` + `aria-live="assertive"`. Limite connue : cette zone ne porte pas
  `lang="en"`, un lecteur d'écran réglé sur la page (`lang="fr"`) prononcera la phrase anglaise
  avec une voix française (écart WCAG 3.1.2). notivue 2.4.5 ne rend que du texte brut dans la
  zone annoncée, aucun `<span lang>` possible : limite consignée dans
  `admin/content/roadmap-a11y.md`, sans retouche du DOM après coup.

## [2026-09-24] — PR #51

### Fixed
- **Le bouton de langue ne répondait plus visiblement quand l'anglais ne se chargeait pas.** Le
  repli était correct (le site reste en français, la préférence n'est pas mémorisée), mais
  l'avertissement n'allait qu'en console : pour la personne, un bouton qui ne fait rien. Un toast
  d'erreur l'explique désormais, dans la langue restée active (`Common.Language.LoadFailed`,
  FR + EN). Testé dans `tests/common/i18nLocaleLoading.test.js` et vérifié en navigateur, chunk
  `en-*` bloqué.

## [2026-09-24] — PR #50

### Fixed
- **Le bouton cadenas de l'accueil n'avait aucun nom accessible.** C'est la porte d'entrée
  principale du site, et un lecteur d'écran n'annonçait qu'« bouton » : l'icône seule ne porte
  aucun texte. `aria-label` traduit FR + EN.
- **Aucune page n'avait de repère `<main>`** — le conteneur de `RouterView` était un `<div>`.
  C'est le repère qui permet d'atteindre le contenu directement, sans parcourir la navigation.
  ⚠️ Une règle CSS globale sur l'élément `main` (carte de contenu, `style.css`) habillait alors
  toute la page, et les six vues de `/app/*` qui s'en servaient créaient des `<main>` imbriqués.
  La règle devient la classe `.page-card`, les vues passent en `<div class="page-card">` : un
  seul repère `<main>` par page, porté par `App.vue`.

### Changed
- **Footers et carte de contenu, thème clair.** Les footers (`AppFooter`, accueil) n'ont plus de
  fond propre : ils partagent celui de la page, comme la barre de navigation. La carte des pages
  `/app/*` passe de `gray-200` — même luminosité que la page, autre teinte, les deux se
  confondaient — à `slate-50`, avec un filet plein au lieu du pointillé et une ombre diffuse
  teintée ardoise. Le fond de la carte en thème sombre est inchangé.
- **Les liens du footer étaient trop petits pour être visés** : `text-xs` sans remplissage donne
  environ 16 px de haut, contre les 24 px minimum du critère WCAG 2.2 (2.5.8). Portés à ~28 px
  sans changer la mise en page.
- **Aucune `meta description`** : les moteurs composaient l'extrait des résultats à partir du
  texte de la page. Elle mentionne l'essentiel et le caractère non officiel du site.

### Notes
- ⚠️ **Le défaut de contraste signalé sur la bannière cookies n'est pas corrigé ici, délibérément.**
  Enquête faite, il ne vient pas de la bannière mais de la charte `.btn-grad-*` entière : le texte
  blanc sur `green-400` donne **1,74:1**, sur `red-400` **2,77:1**, contre 4,5:1 requis. Les textes
  de la bannière, eux, passent largement (6,97:1 en clair, 14,48:1 en sombre). Corriger reviendrait
  à modifier l'apparence de tous les boutons du site — une décision de design, pas une correction
  technique. En attente d'arbitrage.

## [2026-09-24] — PR #49

### Changed
- **L'anglais est chargé à la demande**, le français reste embarqué. `fr.json` et `en.json`
  partaient tous deux dans le bundle d'entrée alors qu'un visiteur n'en lit qu'un. Le bundle
  principal passe de **323,0 à 215,4 Ko brut** (69,5 → 65,2 Ko brotli) et **repasse sous son
  budget de 300 Ko**, franchi depuis le 19/09. Total d'entrée d'un visiteur francophone :
  498,7 → 381,7 Ko brut ; un anglophone y ajoute le chunk `en-*` (37,3 Ko).
  Charger aussi le français à la demande gagnait ~40 Ko de plus, mais une requête de locale en
  échec (réseau coupé, chunk absent après un déploiement) faisait alors afficher à l'interface
  ses clés brutes (`Welcome.Intro`…) — constaté en navigateur. Embarqué, le français sert de
  repli : si l'anglais ne se charge pas, le site s'affiche en français, avec un avertissement
  lisible en console, et la préférence n'est pas mémorisée.
- **La langue mémorisée est appliquée avant le montage de l'application.** Elle l'était dans un
  `onMounted` de `SelectorLanguage`, donc après un premier rendu en français : un visiteur
  anglophone voyait la page s'afficher en français puis basculer. Ce flash existait déjà et
  disparaît ; le chargement à la demande en aurait introduit un plus long.

### Fixed
- **Les messages de validation et les toasts d'authentification ignoraient la langue choisie.**
  Deux instances i18n coexistaient — celle de `main.js` pour les composants, et une seconde dans
  `src/i18n/index.js` pour `Validators.js` et `authStore.js`, qui ne peuvent pas appeler
  `useI18n()`. Personne ne changeant jamais la locale de la seconde, tout ce qu'elle produisait
  restait en français : « Le champ est requis », les erreurs de longueur et d'email, les toasts
  de session. Une seule instance désormais, ce qui supprime la classe de bug entière.
- 4 `console.log` actifs en production retirés de `SelectorLanguage.vue`.

### Added
- `tests/enforcement/i18n-parity.unit.test.js` — échoue sur toute clé présente dans une locale et
  absente de l'autre, ou sur une valeur vide. `fallbackLocale: 'fr'` est conservé (le français
  étant toujours chargé, il ne coûte rien) : le test empêche l'oubli, le fallback en rattrape
  l'effet à l'écran.
- `tests/common/i18nLocaleLoading.test.js` — anglais indisponible : l'application reste en
  français, sans rejet ni clé brute, et `SelectorLanguage` ne mémorise pas la langue ratée ;
  anglais disponible : `Validators.js` suit la bascule (instance unique).

## [2026-09-20] — PR #46

### Added
- **Suppression de compte self-service** depuis le Profil (art. 17 RGPD) : zone dangereuse en bas
  de page, modale de confirmation en **deux étapes** — la première nomme ce qui va disparaître
  (email, personnages, préférences), la seconde redemande le mot de passe. Le jeton seul ne suffit
  pas pour une action irréversible : une session laissée ouverte sur un poste partagé ne doit pas
  pouvoir effacer le compte.
- `authStore.deleteAccount()` : appelle `DELETE auth/account`, puis purge la session locale et les
  comfort data liées au compte (`default_character_id`, devenu une référence morte, et
  `last_login_email`, une donnée personnelle). Le consentement cookies et le thème ne sont pas
  touchés — le visiteur reste sur le site, le resolliciter n'aurait pas de sens.
- Garde-fou de cohérence : un test lit les vraies locales et échoue si `/legal/privacy` §7
  présente encore la suppression comme « à venir ». La promesse et la fonctionnalité basculent
  ensemble.

### Changed
- `/legal/privacy` §7 (FR + EN) : la mention « fonctionnalité à venir — pour l'instant, passer par
  email » est remplacée par le renvoi vers le Profil, le canal email restant en secours. Reporté
  aussi dans `admin/content/policy-privacy-draft.md`, source de vérité admin.

### Fixed
- **L'encart de suppression ne suivait pas la vue.** Son fond était `bg-white dark:bg-slate-800`
  alors que le reste de `ProfilView` est à fond clair fixe et neutralise le mode sombre en
  répétant la même couleur en `dark:` : en thème sombre, l'encart formait un bloc noir isolé au
  milieu d'une page restée claire. Sa bordure rouge pleine introduisait par ailleurs un troisième
  motif dans une vue qui n'en a qu'un — carte `rounded-xl bg-white shadow-md` + liseré latéral
  coloré ; l'encart reprend ce motif, en rouge plus saturé que le `red-400` d'un personnage en
  attente pour que les deux ne se confondent pas.
- « Zone dangereuse » → « **Suppression du compte** » : le premier était un calque de la *Danger
  Zone* de GitHub, étranger au vocabulaire du site. Pas de titre roleplay pour autant — sur une
  action irréversible, la clarté prime sur le ton. L'icône était une croix (« fermer »), devenue
  un triangle d'alerte, et le texte disait l'irréversibilité trois fois dans la même phrase.
- L'item « préférences » de la modale annonçait « thème, langue, saisies mémorisées », alors que
  `deleteAccount()` ne purge que le personnage par défaut, l'email mémorisé et la préférence
  « rester connecté ». Reformulé pour décrire ce que le code fait réellement, plutôt que de
  promettre un effacement qui n'a pas lieu.
- **Un test rendait la suite instable** : `mountProfil()` installait un `createRouter` sans jamais
  attendre `router.isReady()`. Vue Router démarre sur `START_LOCATION` et résout sa route initiale
  de façon asynchrone ; la vue contenant des `RouterLink`, le rendu pouvait être incomplet au
  moment des assertions. Symptôme : suite verte isolément, rouge environ une fois sur cinq en
  exécution multi-fichiers. Comme `deploy.yml` dépend de `tests.yml`, cela produisait un
  déploiement qui échoue au hasard. Corrigé, 6 exécutions consécutives vertes.

## [2026-09-19] — PR #45

### Added
- **Page 404 complète** (route catch-all, désormais nommée `not-found`) : coffre, code, texte
  roleplay et deux sorties — « Retour à l'Office » (vers l'app si le visiteur est connecté, vers
  l'accueil public sinon) et « Page précédente » (`goBackOrWelcome`, qui retombe sur Welcome en
  arrivée directe). Traductions FR + EN sous `NotFound.*`.
- La vue porte son propre `SelectorMenu` (thème/langue) : cette route n'a pas de NavBar.

### Changed
- La route catch-all passe en `meta.public` — le footer légal y affiche à nouveau « Gérer mes
  préférences » et la mention « outil non officiel », comme sur les autres pages hors `/app/*`.

## [2026-09-13] — PR #44

### Fixed
- 12 classes qui ne produisaient **aucun CSS**, donc invisibles à l'écran depuis leur écriture :
  - `purple` (absent de `theme.colors`) → `violet` dans `HomeView.vue` : le badge « Membres » et
    le dégradé des entrées privées du **Registre des Réparations** n'avaient jamais leur couleur.
  - `amber` → `orange` dans `EconomyMines.vue` (avertissement de semaine incomplète), `salmon`
    (inexistant en Tailwind) → `rose` dans `MainSecurity.vue`, la couleur du module.
  - `flex-cols-2` (n'existe pas) retiré des trois shells de module : les deux colonnes viennent
    déjà des largeurs `w-1/6` / `w-5/6` des enfants.
  - `w-12/12` (Tailwind s'arrête à `w-11/12`) → `w-full` dans `LoginView.vue` et
    `AddCharacterView.vue`.
  - `max-w-screen-lg` → `max-w-screen-laptop` dans `AppFooter.vue` et `CookiesBanner.vue` : les
    breakpoints par défaut n'existent pas ici, `theme.screens` étant redéfini en
    `tablet`/`laptop`/`desktop`. **Seul changement visuel réel de la série** — le contenu de ces
    deux barres est désormais borné à 1024px et centré, comme le code le demandait.

### Added
- Garde-fou `tests/enforcement/tailwind-theme-usage.unit.test.js` : échoue si une classe utilise
  une couleur absente de `theme.colors`, ou un breakpoint par défaut de Tailwind (`sm:`, `md:`,
  `lg:`…) supprimé par `theme.screens`. Les deux familles de bugs ci-dessus deviennent visibles en
  CI au lieu d'attendre un œil sur le rendu.

## [2026-09-13] — PR #43

### Changed
- **CSS réduit de 92 %** (Performance #4) : **771,9 Ko brut / 48,8 Ko brotli → 59,1 Ko / 8,7 Ko**.
  Le safelist de `tailwind.config.js` générait 782 classes de base (`text|bg|border|ring|
  ring-offset` × 18 couleurs × 9 nuances), démultipliées par les variantes `hover`/`focus`/`dark`/
  `tablet`/`laptop`/`desktop` — soit des milliers de règles dont une poignée servait. Il ne couvre
  plus que les classes réellement **construites dynamiquement**, c'est-à-dire la seule source du
  projet : `NavMenu.vue` et les 5 couleurs de son menu circulaire, sous leurs deux formes
  (`btn-{couleur}` et `text-{couleur}-100`).

### Added
- Garde-fou `tests/enforcement/tailwind-safelist.unit.test.js` : échoue si une couleur du menu
  circulaire n'est plus couverte par le safelist (la pastille sortirait sans sa couleur en prod),
  et si le safelist se ré-élargit à des couleurs qu'aucun code ne construit.
- Budget bundle CSS resserré en conséquence : 500 Ko brut / 80 Ko brotli → **150 Ko / 25 Ko**.
  Les anciens seuils ne protégeaient plus de rien ; les nouveaux laissent ~2,5× la taille actuelle
  pour la croissance normale et attrapent immédiatement un retour du safelist générique.

### Removed
- Dépendance `@ipaat/vue3-tailwind3-cookie-comply` : enregistrée globalement dans `main.js` mais
  **utilisée dans aucun template** depuis la réécriture maison du consentement (PR #20). Elle
  était embarquée dans le bundle principal (**-9,5 Ko brut**) et son `dist` était scanné par
  Tailwind (**-9 Ko de CSS**). La clé de migration `'cookie-comply'` du `cookieStore` n'a rien à
  voir et reste en place.
- Couleurs `btn-*` du safelist ramenées de 18 à 5 : seules celles du menu circulaire sont
  construites dynamiquement. ⚠️ Le pattern lui-même reste **indispensable** malgré l'avertissement
  « doesn't match any Tailwind CSS classes » émis par Tailwind : une règle d'un `@layer
  components` est purgée si sa classe n'est détectée nulle part dans `content`, être définie dans
  `style.css` ne la protège pas.

## [2026-09-06] — PR #40

### Changed
- Tableau des modules du README complété avec les pages légales (`/legal/cookies`,
  `/legal/privacy`, `/legal/mentions`).

## [2026-09-06] — PR #39

### Fixed
- Références juridiques françaises remplacées par les belges (CNIL → APD, Autorité de Protection
  des Données) dans les politiques cookies et confidentialité — le site est édité depuis la
  Belgique.

## [2026-09-06] — PR #38

### Added
- Page `/legal/mentions` (mentions légales) et footer légal unique réutilisé sur toutes les pages,
  hors du cadre de contenu `/app/*`.
- Phrase de double périmètre (outil public / fonctions membres) sur `WelcomeView`, pitch des
  modules débloqués par un compte sur `RegisterView`.

### Fixed
- Listes i18n de `CookiesPolicyView`/`PrivacyPolicyView` qui affichaient du code compilé au lieu
  du texte (`tm()` sans `rt()`, présent depuis la PR #27).
- Email de contact non cliquable dans les pages légales (mailto + `@` réel).

## [2026-09-06] — PR #37

### Fixed
- Budget bundle JS : seul le brotli bloque le build, le brut se contente d'avertir — par cohérence
  avec le budget CSS, et parce que c'est le brotli que sert réellement LiteSpeed.

## [2026-09-06] — PR #36

### Changed
- Décompte de tests du README resynchronisé avec la suite réelle.

## [2026-09-06] — PR #35

### Fixed
- Bannière de cookies qui réapparaissait à tort après « Annuler » dans la modale de préférences
  alors qu'un choix avait déjà été fait.

### Added
- Toast de confirmation à l'enregistrement des préférences de cookies.

## [2026-09-06] — PR #34

### Added
- Budget bundle en plugin Vite (`scripts/vite-bundle-budget.mjs`, hook `writeBundle`, brotli
  calculé en mémoire) : le build échoue au-delà des seuils. Logique d'évaluation isolée et testée
  dans `scripts/checkBundleBudget.mjs`.

## [2026-09-06] — PR #31

### Removed
- `meta: { layout: "loggedIn" }` sur la route `welcome` — métadonnée jamais lue nulle part.

## [2026-09-06] — PR #30

### Changed
- Icône de l'écran de chargement : effet de bounce (trajectoire asymétrique gravité-like + squash/
  stretch) au lieu de la pulsation douce, jugée trop discrète.

## [2026-09-06] — PR #27

### Added
- Routes `/legal/cookies` et `/legal/privacy` — politique cookies et politique de confidentialité,
  FR + EN, clés partagées `Legal.Common.Contact.*`.

## [2026-08-12] — PR #33

### Fixed
- Smoke test des headers de cache : retry 6×5 s et `curl -sS` au lieu d'un `sleep 5` fixe avec
  erreurs avalées — un faux négatif au premier run réel avait déclenché une fausse alerte Discord
  d'échec de déploiement.

## [2026-08-12] — PR #32

### Added
- Vérification automatisée des headers de cache après déploiement (`deploy.yml`) : redécouvre
  l'asset JS hashé depuis l'`index.html` déployé, vérifie `immutable` sur l'asset et `no-cache`
  sur `index.html`.

## [2026-08-12] — PR #29

### Added
- Écran de chargement plein écran pendant la navigation (`LoadingOverlay.vue`,
  `use/useNavigationLoading.js`, hooks router, délai anti-flash 150 ms, `prefers-reduced-motion`) —
  icône et texte selon le contexte : pavillon pour la navigation générale, coffre pour les modules
  « Coffres X ».
- `public/.htaccess` : fallback SPA (`mod_rewrite`), `Cache-Control: public, max-age=31536000,
  immutable` sur `/assets/*.js|css`, `no-cache` sur `index.html`.

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
