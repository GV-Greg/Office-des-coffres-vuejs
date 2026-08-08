# Décisions structurantes — Office des Coffres (frontend)

ADR minimalistes : titre, contexte, décision, conséquences. Une entrée par décision non triviale
qui aurait pu raisonnablement être prise autrement. But : que la raison derrière un choix
survive au contributeur qui l'a fait, sans avoir à fouiller `roadmap.md` ou l'historique git.

## Une seule catégorie de cookie "comfort" plutôt que fonctionnel/essentiel séparés

**Contexte** — Le modèle initial distinguait "fonctionnel" (connexion persistante) des
préférences hors-consentement (thème/langue, sans UI de consentement du tout). Deux traitements
différents pour des données qui ont la même finalité réelle : accélérer l'usage du site, jamais
de tracking.

**Décision** — Fusionner en une seule catégorie "comfort", un seul toggle dans la modale, une
seule finalité expliquée à l'utilisateur. Générique et réutilisable par tout module futur
(`cookieStore.getComfortData`/`setComfortData`).

**Conséquences** — UX plus simple (un seul choix à faire), dégradation gracieuse uniforme : sans
consentement, tout fonctionne quand même, juste sans mémorisation d'une visite à l'autre.

## Palette de boutons dégradée `.btn-grad-*` plutôt que `.btn-ghost`

**Contexte** — `.btn-ghost` (fond plat + teinte au survol) traitait certaines actions
(`ProfilView`, ex. "Modifier la résidence") comme secondaires alors qu'elles avaient le même
poids fonctionnel que les actions primaires (ex. "Ajouter un personnage").

**Décision** — Nouvelle palette dégradée `.btn-grad-{couleur}` (blue/slate/red/green/yellow/cyan/
purple/light/dark), même traitement visuel que `.btn-primary`, seule la teinte change selon la
sémantique (bleu = édition, slate = neutre, rouge = danger, vert = confirmation).

**Conséquences** — `.btn-ghost` n'a plus aucun usage mais reste dans `style.css`, pas supprimé
(pas de raison de le faire, aucun risque de régression). Les classes plates existantes
(`.btn-secondary`, `.btn-slate`, `.btn-yellow`, etc.) ne sont **jamais** retouchées : elles sont
consommées dynamiquement par `NavMenu.vue` (`:class="'btn-${page.color}'"`), qui doit rester
visuellement inchangé.

## Régime i18n différencié entre les trois exports BBcode

**Contexte** — `EconomyMines::bilanToBBcode()` suit la langue de l'UI (i18n), tandis que
`EconomyMines::formatDayForForum()` et `SecurityGuet::to_export()` restent en français fixe.
Écart repéré et signalé comme incohérence potentielle.

**Décision** — Ne rien uniformiser. Le forum du jeu a aussi des parties anglophones : l'i18n du
bilan hebdomadaire est un atout (basculer l'UI en anglais produit un bilan postable côté
anglophone), pas une dette. Les deux autres exports restent volontairement fixes.

**Conséquences** — Le régime dépend du contexte d'usage de chaque export, pas d'une règle
uniforme. Ne pas rouvrir ce sujet sans une raison nouvelle et explicite de Greg.

## `NavMenu` exempté de la charte de boutons

**Contexte** — Le menu circulaire des modules (`NavMenu.vue`) utilise un système de couleurs
dynamique propre (`:class="'btn-${page.color}'"`, classes plates `.btn-slate`/`.btn-yellow`/
`.btn-rose`/`.btn-teal`), antérieur à la charte dégradée.

**Décision** — Veto explicite de Greg : ne jamais convertir `NavMenu` vers la palette dégradée,
même par cohérence. Design volontairement distinct, à préserver tel quel.

**Conséquences** — Deux systèmes de boutons coexistent dans le code (dégradé partout ailleurs,
plat pour `NavMenu`) — ce n'est pas une incohérence à corriger, c'est un choix design assumé.

## Salon Discord Forum pour les correctifs, Texte pour les nouveautés

**Contexte** — Trois salons Discord distincts pour les annonces automatiques de déploiement :
admin (déploiement), nouveautés, correctifs.

**Décision** — Le salon correctifs est un salon **Forum** (pas Texte) — permet aux testeurs de
discuter/confirmer chaque correctif individuellement dans son propre thread, contrairement aux
nouveautés qui restent un flux groupé.

**Conséquences** — Contrainte technique en cascade : un salon Forum **exige** un `thread_name`
par appel webhook, impossible d'y poster un message "plat" — `whatsNewAnnounce.mjs` a donc deux
chemins de publication différents (`buildPayload()` groupé pour les nouveautés,
`buildForumPayloads()` un post par entrée pour les correctifs).

## `WelcomeView` exemptée du guard "déjà connecté"

**Contexte** — `redirectToHomeIfLoggedIn` redirige un compte déjà connecté qui tente d'aller sur
`/login` ou `/register` directement vers `/app/`. La question s'est posée de l'appliquer aussi à
`WelcomeView` (`/`).

**Décision explicite de Greg** — Non : "si on arrive sur welcome connecté, on fait rien".
`WelcomeView` reste accessible telle quelle, connecté ou non.

**Conséquences** — Le guard ne s'applique qu'à `/login` et `/register`, pas à la landing. Un
comportement volontairement asymétrique, pas un oubli.
