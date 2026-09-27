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
visuellement inchangé. *(27/09/2026 : les classes plates du menu sont supprimées, voir
« Identité visuelle : menu M1 et boutons `odc-*` ».)*

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

> ⚠️ **Remplacée le 27/09/2026** par « Identité visuelle : menu M1 et boutons `odc-*` » ci-dessous.
> Conservée pour l'historique.

**Contexte** — Le menu circulaire des modules (`NavMenu.vue`) utilise un système de couleurs
dynamique propre (`:class="'btn-${page.color}'"`, classes plates `.btn-slate`/`.btn-yellow`/
`.btn-rose`/`.btn-teal`), antérieur à la charte dégradée.

**Décision** — Veto explicite de Greg : ne jamais convertir `NavMenu` vers la palette dégradée,
même par cohérence. Design volontairement distinct, à préserver tel quel.

**Conséquences** — Deux systèmes de boutons coexistent dans le code (dégradé partout ailleurs,
plat pour `NavMenu`) — ce n'est pas une incohérence à corriger, c'est un choix design assumé.

## Identité visuelle : menu M1 et boutons `odc-*` (27/09/2026)

> ⚠️ **Partie « menu » remplacée le 27/09/2026** par « Menu circulaire : mix M1 + D2 (variante X3) »
> ci-dessous. La partie « boutons `odc-*` » reste valable.

**Contexte** — Greg a arrêté une identité visuelle (logo, favicon, menu circulaire M1, boutons
« relief 3D »), sources hors dépôt dans `ODC/logo/`, brief `admin/content/brief-identite-visuelle.md`.
Elle entre en conflit avec l'entrée précédente, « `NavMenu` exempté de la charte de boutons »,
dont le veto (« ne jamais convertir `NavMenu` vers la palette dégradée ») protégeait le design
plat d'origine.

**Décision** — Greg lève lui-même ce veto en validant le menu M1. Ce n'est pas une conversion
vers la palette `.btn-grad-*` : c'est un nouveau design propre au menu, en relief 3D, couleurs
passées en variables CSS. Les boutons `odc-*` (`assets/odc-buttons.css`) deviennent la cible de
toute action, et remplaceront `btn-primary`/`btn-grad-*` page par page. Retouches arbitrées à
l'écran le jour même (taille du menu, sans tranche ni liseré foncé extérieur, plaque sur le gris
du fond, survol sans éclaircissement des boutons texte), consignées dans les README de
`ODC/logo/` (« Retouches validées à l'intégration »), qui priment sur les fichiers sources.

**Conséquences** — Les classes plates `.btn-blue`/`.btn-yellow`/`.btn-rose`/`.btn-teal`/
`.btn-slate`/`.btn-menu-rounded` et le safelist Tailwind qui les protégeait sont supprimés : plus
aucune classe n'est construite à l'exécution (garde-fou `tailwind-safelist.unit.test.js`, réécrit
pour l'état inverse). Deux chartes coexistent le temps de la migration : `odc-*` (NavBar,
chronique, Profil) et `.btn-grad-*` (le reste). Tant que les deux existent, le contraste se garde
des deux côtés (`btn-grad-contrast`, `odc-buttons-contrast`).

## Menu circulaire : mix M1 + D2 (variante X3) (27/09/2026)

**Contexte** — Le menu M1, fusionné par #62, a été jugé à l'écran moins lumineux et moins lisible
que la planche D2. Brief `admin/content/brief-menu-d2.md` : revenir à D2, ou mélanger les deux
en gardant le relief de M1. Trois mélanges comparés hors dépôt
(`logo/menu-circulaire/mix/menu-mix-comparaison.html`, fond sombre et fond clair, 4 états).

**Décision** — Greg retient **X3 « équilibre »** : l'anneau laiton lumineux, le disque et les
états de D2 (halo de survol, page courante enfoncée et cerclée d'or, plaque dorée corrigée), le
biseau fin et l'icône gravée de M1. Deux retouches : l'icône remontée de 3 unités (géométriquement
centrée, elle paraissait basse à cause de son ombre gravée et du reflet), et la **plaque au fond
ardoise de M1** (bord ambre de D2). Pas de tranche bronze ni de liseré foncé extérieur,
conformément aux retouches précédentes. Elle remplace la partie « menu » de l'entrée
« Identité visuelle : menu M1 et boutons `odc-*` ».

**Conséquences** — Les couleurs vivent dans `components/navMenuPalette.js` : trois teintes de
disque par entrée (repos, survol, page courante — pas de `filter: brightness`, qui éclaircirait
aussi l'anneau et la plaque) et les plaques par état, passées en variables CSS au composant et
lues telles quelles par le garde-fou `navmenu-plate-contrast`. Toujours aucune classe construite
ni safelist. La plaque dorée finit à `#d97706`, jamais `#b45309` (3,82:1).

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

## Thème sombre par défaut, sans lecture de `prefers-color-scheme`

**Contexte** — Au premier chargement (`localStorage` vide), le thème part de
`DEFAULT_COMFORT_DATA.theme = 'dark'` (`src/stores/cookieStore.js`) : la préférence clair/sombre
du système n'est pas lue. Relevé le 24/09/2026 pendant l'audit d'accessibilité — un visiteur dont
l'OS est en clair arrive quand même en sombre. Sans décision écrite, ça se lit comme un oubli.

**Décision (Greg, 24/09/2026)** — Le sombre par défaut est **délibéré**, et on ne lit pas
`prefers-color-scheme`. Raisons :
- **L'identité visuelle** : le site est conçu sombre ; c'est le thème fini, celui dont le rendu a
  été travaillé et vérifié.
- **L'état du thème clair** : au 24/09/2026, la mesure au ratio (`tests/browser/textContrast.mjs`)
  relève **26 textes sous le seuil** sur les pages publiques, et le clair a porté un défaut
  bloquant (texte blanc sur blanc des pages légales, PR #54). Suivre le réglage système
  exposerait d'un coup à ce thème tous les visiteurs dont l'appareil est en clair.

**Condition de réouverture** — La bascule vers `prefers-color-scheme` redevient envisageable
**quand la mesure au ratio passe au vert sur les deux thèmes**. Pas avant, et pas sur un autre
critère.

**Remarque secondaire, bornée** — Un fond sombre consomme moins d'énergie à l'affichage, mais
surtout sur écran **OLED** ; sur un LCD le rétroéclairage reste allumé quel que soit le contenu,
et ce site s'utilise sur **ordinateur** (arbitrage du 20/09/2026 : pas de copier-coller depuis le
client de jeu mobile). Ce n'est donc pas une raison de la décision, tout au plus un effet de bord
favorable sur les écrans qui s'y prêtent.

**Conséquences** —
- **Ne pas « corriger » en lisant `prefers-color-scheme`** tant que la condition de réouverture
  n'est pas remplie.
- Le thème clair n'en est pas secondaire pour autant : tout audit (contraste, axe) couvre **les
  deux thèmes explicitement**, en constatant la bascule — le défaut sombre fait qu'un audit qui
  ne force rien ne mesure que le sombre.
