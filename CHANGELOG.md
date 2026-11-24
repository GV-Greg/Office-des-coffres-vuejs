# Changelog — Office des Coffres (frontend)

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Une entrée par PR
mergée sur `main` (ou merge direct pour les deux entrées antérieures aux PR GitHub). Pas de
versionnage sémantique — chaque merge sur `main` déclenche un déploiement, la date de merge fait
foi. L'historique détaillé (raisonnement, incidents, décisions) vit dans `admin/suivi/*.md` et
`admin/archives/` à la racine du workspace ; ce fichier n'en retient que le résumé daté.

## [2026-11-24] — PR #163 (Relevé de guet : « un relevé existe déjà », retrait d'une section, groupes sans en-tête)

### Added
- **Bandeau « Un relevé du JJ/MM existe déjà pour cette ville. »** (`ExistingReportNotice.vue`, fil `admin/echanges/module-securite/22` et `23`) : sur la ligne de la ville, devant elle, fond orange et texte blanc ; lecture seule (`GET customs-reports`), rien sans droit de lecture ni sans relevé, ni détail ni auteur.
- **Une case vidée retire sa section** du relevé existant : le Relevé envoie `remove_sections` pour les visions et les armées/groupes laissés vides ET inscrits dans le relevé du jour (jamais le guet) ; le bouton reste actif quand il n'y a que des sections à retirer. Backend : `back #111`.

### Fixed
- **Un collage de groupes sans en-tête** (« Groupes présents ici : ») était ignoré en entier : il se lit maintenant comme une liste de groupes. Avec un en-tête, rien ne change.

### Deploy notes
- **PR empilée sur `front #161`** (Table des douanes) : mergée dans sa branche, elle part en production avec #161. Frontend seul ; la règle serveur est `back #111` (mergée le 24/11/2026).

## [2026-11-23] — PR #160 (Salle des gardes : le Relevé de guet devient l'export, le Registre de douane se lit)

### Changed
- **Relevé de guet** (fil `admin/echanges/module-securite/19`, retours de Greg en séance le 23/11/2026) : « Confier au scribe » **EST l'export** — il fabrique le message BBCode pour le forum et le copie (« Relevé de défense de la nuit du … au … - Ville : … ») ; le bilan n'est plus affiché dans le Relevé, il se relit dans le Registre. Titre `h1` rose avec le badge « Mode douanier » (pour qui peut inscrire), libellés et phrases d'aide par zone, ville par défaut = celle du personnage, plus de phrase d'introduction ni de note « sans titre ».
- **Inscription au registre** : une **plaque** (`CustomsRegistrySave`) à droite du bouton, même conception que celle du Bilan des mines (ville et jour dits avant l'envoi, aide « i », parchemin scellé), toujours explicite ; bouton inactif sans rien à inscrire. Un collage « retrouvé » s'inscrit tel quel.
- **Registre de douane** : titre sans la province (province, ville, jour dans une carte), plus de bouton « Saisir un relevé » ni d'export ; **passe de design** : ligne de synthèse en badges colorés, trois colonnes de cartes teintées (Habitants et Visions | Entrées et sorties | Groupes, Armées, Contrôle de la zone), groupes repliés au-delà de trois, section non inscrite = carte grisée « Non inscrit. » ; « aucun membre de la sécurité connu » passe en infobulle « i » (`InfoTip`). Menu de la Salle des gardes : un « i » par page ouvrant une modale d'aide.
- **Le détail d'un groupe** (« Fermé », « Admission libre »…) n'est ni gardé, ni exporté, ni affiché.

### Fixed
- **Rechargement du Relevé** : la liste d'aujourd'hui, déjà gardée, revenait comme « liste d'hier » et écrasait celle d'hier. Les listes sont désormais gardées **par jour du jeu** (`guet_lists`, aujourd'hui et hier seulement, la plus ancienne effacée) ; visions et armées sont gardées avec leur jour, et reviennent dans leur case le même jour. **Texte légal** (cookies §3, « Vos données ») mis à jour dans la même PR : non substantiel (navigateur seulement), sans `policy:notify`.
- **Visions copiées sans ligne de date** (le journal du jeu sépare la date) : comptées pour le jour du relevé au lieu d'être ignorées.

### Added
- `InfoTip.vue`, `ReportCard.vue`, `ReportGroupList.vue`, `CustomsRegistrySave.vue`, `modules/customsLists.js`, `modules/customsCity.js` ; tests `customsLists.unit.test.js` et compléments (Relevé, Registre, parseurs, export) ; 1644 tests.

### Removed
- `CustomsExport.vue` (l'export vit dans le Relevé), la note « sans titre », la clé `guet_last_list`.

### Deploy notes
- Frontend seul : aucune migration, route, `config/*.php` ni paquet ; backend inchangé. Les bilans déjà inscrits restent lisibles (le détail des groupes qu'ils portent n'est plus montré).

## [2026-11-23] — PR #159 (Texte légal : les pseudos du Relevé de guet partent au serveur, sans être enregistrés)

### Changed
- **« Vos données »** (fil `admin/echanges/module-securite/15` à `17`, option B de Greg, non substantiel, sans `policy:notify`) : avec un titre de sécurité reconnu, les pseudos collés sont envoyés au serveur pour afficher les marques des listes rouge et verte ; ils ne sont pas enregistrés. Dit dans l'entrée du Relevé de guet (`Watch.Stored`) et dans celle de La Salle des gardes (`Security.Stored`), en FR et en EN. `Watch.Audience` n'affirme plus que ces données « ne quittent pas votre navigateur » sans réserve.
- **« ni journalisés » volontairement absent** : les journaux de l'hébergeur ne sont pas vérifiés ; le garde-fou de test l'interdit tant que ce n'est pas fait.

### Added
- Tests `privacyWatch.unit.test.js` (+2) ; 1609 tests.

### Deploy notes
- Frontend seul : aucune migration, route, `config/*.php` ni paquet ; backend inchangé.

## [2026-11-23] — PR #158 (Fix : le bilan hebdomadaire d'un mandat renouvelé reprend les jours déjà couverts)

### Fixed
- **Registre des mines, mandat renouvelé** (fil `admin/echanges/bilans-passes-mines/04` et `05`, signalé par Greg le 23/11/2026) : le jour où un nouveau mandat entre en fonction, le bilan de la semaine affichait « Aucun jour couvert sur 0 » alors que les relevés de la semaine existent (écrits sous l'ancien mandat, déjà servis par le serveur dans la fenêtre « prédécesseurs »). `weeklyBilan` garde désormais, dans la semaine, les jours antérieurs à l'entrée en fonction qui ont des données. R4 est intacte : les bilans de mi-mandat et de fin se calculent toujours depuis l'entrée en fonction.
- **Sans aucun jour à compter**, l'écran dit « Premier bilan disponible demain » (FR et EN) au lieu d'un tableau de zéros, pour la semaine comme pour la période en cours.

### Added
- Tests `minePrices.unit.test.js` (+3) et `EconomyRegistry.test.js` (+2) ; 1607 tests.

### Deploy notes
- Frontend seul : aucune migration, route, `config/*.php` ni paquet ; aucun changement backend ni de texte légal.

## [2026-11-23] — PR #156 (Export BBCode des bilans de mi-mandat et de fin de mandat)

### Added
- **Un bouton « Confier au scribe » sur chaque bilan de mandat prêt** du Registre des mines (demande de Greg, 22/11/2026) : même gabarit que l'export d'une semaine (`bilanToBBcode`, un seul pour le forum du jeu), période en dates du jeu (« Bilan de fin de mandat, du 1 mars 1474 au 29 avril 1474 »). Valable aussi pour un mandat passé (front #154).
- **Exporté partiel, mais dit partiel** : option `coverage` de `bilanToBBcode` — une ligne « Bilan partiel : N jours couverts sur M » ; un bilan complet n'en porte pas. Contrairement à une semaine (règle Q10), un bilan de mandat s'exporte partiel (il l'est presque toujours). Pas de bouton avant la date (« dans N jours ») ni sans aucun jour couvert.
- Tests `EconomyRegistryPast` (+4) ; 1602 tests.

### Deploy notes
- Frontend seul : aucune migration, route, `config/*.php` ni paquet.

## [2026-11-22] — PR #155 (Fix : le niveau du mandat renouvelé n'est plus proposé en radios désactivées)

### Fixed
- **Modal « Renouveler le mandat »** (fil `admin/echanges/mandats-lot3/09-bug-radios-renouvellement.md`, signalé par Greg le 22/11/2026) : les deux radios « Maire » / « Conseil comtal » ne réagissaient pas au clic — par conception, le niveau d'un renouvellement est celui du mandat renouvelé et ne se choisit pas, mais des radios désactivées, sans rien de visiblement coché, ressemblaient à un bug. Le niveau est maintenant **dit en texte** (« Niveau : Conseil comtal »), comme le lieu juste dessous ; plus de radios en renouvellement. Une **demande** de poste garde ses radios, cliquables.

### Added
- Tests dans `CharacterMandates.test.js` (niveau dit en texte, en anglais, radios d'une demande restées actives) ; 1598 tests.

### Deploy notes
- Frontend seul : aucune migration, route, `config/*.php` ni paquet.

## [2026-11-22] — PR #154 (Fix : bilans de mandat passés du Registre des mines, sélecteur de mandat et lecture seule)

### Fixed
- **Un ancien titulaire peut relire ses bilans** (brief `admin/modules/economie/brief-bilans-passes-mines.md`, fil `admin/echanges/bilans-passes-mines/`) : le bilan de la dernière semaine d'un mandat n'était consultable qu'après sa fin, sans plus aucun accès au registre. Backend : back #109 ; texte légal : front #153.

### Added
- **Sélecteur de mandat** dans le Registre des mines (le mandat en cours par défaut, puis les mandats passés : poste, province, période en année du jeu), dès qu'il existe un mandat passé (`past_mandates`). Un mandat passé se lit via `GET …/mine-registry/mandates/{id}`.
- **Mandat terminé = lecture seule** : bandeau « Bilan du mandat terminé le … — lecture seule » ; sa **dernière semaine** s'ouvre par défaut ; les bilans de mi-mandat et de fin sont toujours lisibles (jamais « dans N jours ») ; plus de bilan « en cours », d'âge du dernier relevé ni de liens vers les prix ; la dernière semaine, partielle, dit pourquoi elle est incomplète. Aucune règle côté site (le serveur fenêtre les relevés).
- Le **menu et l'accueil d'Économie** montrent le Registre des mines aussi à un ancien titulaire. Dates `mine_mandate_from` / `mine_mandate_until` (année du jeu). Tests `EconomyRegistryPast` (+14).

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. Le backend (back #109, `route:cache` fait le 22/11/2026) et le texte légal (front #153) sont déjà en ligne.

## [2026-11-22] — PR #153 (Texte légal : les anciens titulaires relisent les relevés de leur mandat, Registre des mines)

### Changed
- **Politique §6 et « Vos données » → Registre des mines** (FR et EN ; fil `admin/echanges/bilans-passes-mines/` 01 et 02, validé par Greg et Cowork le 22/11/2026, **non substantiel**, pas de `policy:notify`) : les anciens titulaires des postes qui consultent le registre peuvent relire, **en lecture seule**, les relevés de la période de **leur** mandat, sans limite de durée, tant que ces relevés existent. Jamais ceux de leurs successeurs.

### Added
- Garde-fou `tests/legal/privacyMineRegistry.unit.test.js` (la phrase borne à « la période de leur mandat »).

### Deploy notes
- Frontend seul, aucun code applicatif. Le texte **précède** le fix `fix/mine-past-balances` (backend puis frontend) : l'accès ne s'ouvre qu'après sa mise en ligne.

## [2026-11-22] — PR #151 (Module Sécurité, PR 3-2 : le Relevé de guet, point de collage unique)

### Changed
- **Le Relevé de guet colle les cinq types** (guet d'hier et d'aujourd'hui, visions, armées/groupes/contrôle de la zone) : même écran, même parseur (frontend), même mise en forme pour tous (fil `admin/echanges/module-securite/` 12 à 14, texte légal : front #150). `modules/customsLocalReport.js` (pur) fabrique un bilan local dans la forme du serveur ; `CustomsReportView` et `CustomsExport` l'affichent tels quels.
- **Sans compte** : rien ne quitte le navigateur, aucune couleur ; différentiel du guet à la liste d'hier collée. Avec le consentement « Préférences », le **dernier collage de chaque type** est gardé (`guet_last_list`, `guet_last_visions`, `guet_last_armies_groups`), jamais d'historique ; un collage retrouvé n'est jamais inscrit au Registre tant qu'il n'est pas modifié.
- **Avec un titre de sécurité** : appel `customs-preview` (des pseudos seulement) → couleurs des listes rouge/verte et guet du dernier bilan de la ville, qui prime sur la liste d'hier ; « Inscrire au registre » avec ville et jour dits avant l'envoi. Un échec de l'appel de couleurs ne bloque pas le relevé.
- **La saisie quitte le Registre de douane** (`CustomsReportForm` supprimé) : il garde la lecture, les listes et un lien « Saisir un relevé ». Entrées et sorties avec lien vers la fiche du personnage.
- Route du Relevé **chargée à la demande** (elle portait les parseurs dans le bundle principal).

### Added
- Exports : le dépliant « Bilan de défense en BBCode » (ville facultative, « comparé à la liste d'hier ») à côté du « Confier au scribe » historique ; tests `SecurityGuet`, `customsLocalReport`, `customsBBcode`.

### Deploy notes
- Frontend seul. **Après back #108** (`customs-preview`, `route:cache` fait par Greg le 22/11/2026, routes `customs-*` sondées : 401 sans jeton).

## [2026-11-22] — PR #152 (La validation des douaniers devient un onglet de Mon bureau)

### Changed
- **Onglet « Douaniers » de Mon bureau** (`/app/mon-bureau/douaniers`) : la validation des demandes de douanier quitte la Salle des gardes. L'onglet n'existe que si le serveur donne un rôle de validation (`GET characters/{id}/customs` → `decider`) ; sinon l'adresse retombe sur « Ma province ». Aucune règle côté site.
- **Restructuré** : un seul titre « Valider les douaniers de {province} », demandes en attente et douaniers en vigueur à gauche, durée d'inactivité à droite ; l'introduction redondante est retirée.
- **`/app/secu/douaniers`** redirige vers l'onglet ; la route `security-officers` et le lien du menu Sécurité disparaissent. `SecurityOfficers.vue` devient `components/customs/OfficerValidationSection.vue`.

### Added
- Tests `MonBureauOfficers` (onglet visible ou non, ordre, repli, anglais, redirection) ; `OfficerValidation` reprend les tests de la page.

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. Indépendant de la PR 3-2 (front #151, back #108).

## [2026-11-22] — PR #149 (Module Sécurité, PR 3-1 : Registre de douane, écran des douaniers, Profil en pleine largeur)

### Added
- **Registre de douane** (`/app/secu/douane`, `security-customs` ; lien de menu seulement pour qui le serveur connaît un rôle de sécurité) : bilans d'une ville jour par jour, pseudos colorés (sens porté par le texte, jamais la couleur seule), différentiel du guet, visions, armées, groupes (seul « Groupe à surveiller » alerte), contrôle de la zone ; saisie par collage (ville et jour dits avant l'envoi) ; listes rouge et verte en modale ; **export BBCode « Confier au scribe »**. **Parseurs au frontend seulement** (`customsParsers.js`, `customsPaste.js`) : le serveur reçoit l'analyse et le brut gardé. Fixtures : dix collages réels.
- **Douaniers** : le rôle se **demande** dans la modale « Demander un poste » du Profil (choix « Douanier », ville de rattachement seule) et se **valide** dans la Salle des gardes (`/app/secu/douaniers`, lien réservé à qui valide). Carte de poste dans le Profil avec infobulle « i » sur la cascade de validation. Icône `fa-user-shield`.
- Garde-fous : `tests/security/*`, `tests/mandates/MandateRequestCustoms.test.js`.

### Changed
- **Page Profil** : titre « Mon personnage / Mes personnages », « Ajouter un personnage » sur la ligne du titre, pleine largeur (1600 px max), personnages côte à côte dès 1500 px.
- Parseur du guet : en-tête anglais « Presently in town (N) » lu, virgule de tête retirée de la noblesse.
- « La Salle des gardes » n'est plus « à venir » dans « Vos données ».

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. **Le backend (back #107) est mergé avant** ; tant que `migrate` + `route:cache` n'ont pas été lancés en SSH, l'API `customs-access` répond 404 et le lien du Registre reste caché (sans danger).

## [2026-11-22] — PR #150 (Texte légal du Relevé unique : ce que le navigateur garde)

### Changed
- **Politique cookies §3 et « Vos données » → Relevé de guet** (FR et EN ; fil `admin/echanges/module-securite/` 12 à 14, `admin/content/policy-cookies-releve-draft.md`, validé par Greg le 22/11/2026, **non substantiel**) : le navigateur garde, avec le consentement « Préférences », le dernier collage de chaque type (liste des villageois, visions, armées, groupes, contrôle de la zone), remplacé à chaque nouveau collage, sans historique ; ces textes peuvent citer des pseudos de tiers. Sans compte, rien n'est enregistré sur nos serveurs ; avec un compte et un rôle reconnu, le relevé peut être inscrit au Registre de douane (renvoi vers « La Salle des gardes »).
- Rubrique « Audience » du Relevé complétée (écart voulu au brouillon : elle contredisait sinon le « Stockage »).

### Added
- Garde-fou `tests/legal/privacyWatch.unit.test.js` ; ligne du tableau de `admin/strategies/cookies.md`.

### Deploy notes
- Frontend seul, aucun code applicatif. **Pas d'entrée `policy:notify`** (non substantiel). Le texte précède le code du Relevé unique (PR 3-2), à venir après la PR 3-1 (back #107, front #149).

## [2026-11-22] — PR #148 (Texte légal de La Salle des gardes — PR 3-0 ; `bcrypt` retiré de la politique)

### Added
- **Politique de confidentialité et « Vos données »** pour le module Sécurité (fil `admin/echanges/module-securite/`, `admin/content/policy-securite-draft-v2.md`, validé par Greg le 22/11/2026) : §3 (statut de douanier, listes rouge et verte, bilans de défense, texte collé conservé tel quel — liste des villageois sans préambule, armées, groupes, contrôle de la zone, lignes des visions du jour), §4 (bases légales), §5 (conservation **sans limite**, « le lien est supprimé »), §6 (le trio = prévôt + connétable + capitaine, maire, douaniers, juge, procureur, dirigeant), §7 (personnes citées : le recours relève du jeu, **aucune procédure de retrait annoncée**). Section « La Salle des gardes » de « Vos données » marquée **« à venir »** (à retirer avec la PR 3-1). Rien n'est exporté de ces listes ni de ces bilans, seulement une trace d'activité sans contenu.
- Titres anglais relevés en jeu : Constable (prévôt des maréchaux), Sergeant (connétable), Captain, Public Prosecutor ; « The Guardroom ».

### Changed
- **`bcrypt` retiré** de la politique (§3 et §8), FR et EN : le procédé de hachage n'est plus révélé (demande de Greg).
- « Le Guet » devient « Relevé de guet » dans la politique, les cookies et « Vos données » ; l'intro du §3 ne range plus « Douane » parmi les modules à venir. Dates « dernière modification » au 22/11/2026.

### Deploy notes
- Frontend seul. **À déployer avec back #105** : le texte promet un garde-fou (`SecurityNotConsultableTest`) qu'il apporte. Ensuite, `php artisan policy:notify` (une entrée par jour) **une fois le texte en ligne** ; la PR 3-1 (écriture des listes et des bilans) ne se merge pas avant.

## [2026-11-21] — PR #147 (Module Sécurité, PR 1 : Relevé de guet, « La Salle des gardes », plume sur « Confier au scribe »)

### Added
- **Parseur du guet** `src/modules/guetParser.js` (`parseGuet`, `diffGuet`), logique pure (brief `admin/content/brief-module-securite.md`, fil `admin/echanges/module-securite/`) : pseudo = premier mot du champ, noblesse, réputation `nPR`. Le collage réel (`Bug_ExportSorties.txt`) place la noblesse après un **espace** (« Brennos de Lapin ») : la forme « Pseudo, Titre » du brief n'y existe pas, elle reste tolérée en repli.
- **Alerte de collage tronqué** : quand « Liste des villageois (N) » (français seulement) ne colle pas aux lignes lues, un message orange non bloquant le dit sous les résultats.

### Changed
- Libellés : titre « La Salle des gardes » / « The Guardroom », outil « Relevé de guet » / « Watch Report » (le menu circulaire garde « Sécurité »). Bouton « Exporter » → « Confier au scribe ».
- **Icône plume** (`gi-quill`) sur tous les boutons « Confier au scribe » : Relevé de guet, Bilan des stocks, Balance, Registre des stocks, Bilan et Registre des mines, Grille des lots. « Copier pour le forum », « Exporter les règles/résultats » de Décode et les copies de réglages gardent `fa-copy`.

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. Un test de la Grille des lots (`RewardsGridViews`, récapitulatif) a échoué une fois sous charge dans la suite complète, sans rapport avec le changement ; il passe seul.

## [2026-11-21] — PR #146 (Registre des stocks : prise de poste, bilans de mandat, jours sans inscription, exports BBCode — PR 3b)

### Added
- **Registre des stocks, lectures du mandat** (fil `admin/echanges/registre-stocks/`, réponses de Cowork Q1 à Q6), sous l'inscription ouverte et tirées des dates du serveur (`mandate`, back #103) — aucune règle de durée côté site : **Prise de poste** (l'inventaire hérité, et les inscriptions d'autres dans les 30 jours avant l'entrée en fonction, dates cliquables, personne n'est nommé) ; **Bilans de votre mandat** (mi-mandat et fin : évolution entre l'inventaire hérité et la dernière inscription strictement avant la date, moteur de la Balance ; avant la date « disponible le JJ/MM, dans N jours », jamais un bilan partiel ; « pas assez d'inscriptions » dit laquelle manque) ; **Jours sans inscription** (périodes depuis l'entrée en fonction jusqu'à hier, sans seuil ni couleur).
- **Exports BBCode « Confier au scribe »** (français fixe, catégories du niveau, options d'export du joueur, rien d'enregistré) : une inscription (« Inventaire du {date} — {lieu} »), un bilan (« Bilan de mi-mandat, du … au … »), la comparaison libre.
- **Annonce à la chronique** : « Le Registre des stocks garde la mémoire des inventaires de votre ville ou de votre province » (rubrique Chroniques, comptes connectés ; Discord au merge).

### Changed
- Page du Registre en **trois colonnes** au large : l'inscription ouverte, la comparaison, et les inscriptions dans une petite colonne tout à droite ; deux colonnes sur laptop, une en dessous. Tableau d'évolution partagé entre la comparaison et les bilans.
- Accueil de la Salle des comptes : une carte seule occupe une colonne, un groupe de plusieurs en occupe deux.

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. Suppose back #103 (bloc `mandate`), déjà mergée ; sans elle, les trois lectures n'apparaissent pas.

## [2026-11-21] — PR #145 (Registre des stocks : date d'inscription choisie, toasts par la droite)

### Added
- **Date d'inscription** (brief `10-brief-date-inventaire`, demande de Greg) : dans le Bilan des stocks, un champ date à gauche de la phrase « Cet inventaire sera inscrit au registre : {lieu}, le {date} » — le jour du jeu en cours par défaut, de **14 jours du jeu avant l'entrée en fonction** à aujourd'hui (bornes dites par le serveur), saisi en année du jeu ; lien « Aujourd'hui ». Pour inscrire l'inventaire hérité du prédécesseur.
- **Avant la prise de fonction**, une inscription déjà en place à la date choisie ne se remplace pas : le message du serveur seul, avec « Fermer », jamais « Remplacer » (le rédacteur n'est pas nommé).
- « Vos données » : le texte dit que la date peut être choisie, et sa borne.

### Changed
- **Toasts** : ils entrent et sortent par la **droite** (animations Notivue personnalisées) au lieu de tomber du haut — **tous** les toasts de l'Office ; mouvement réduit honoré.
- « Déjà inscrit, rien à changer » : toast d'information (bleu).

### Removed
- « Rouvrir une inscription » du Bilan des stocks (le Registre montre le passé ; l'export d'un ancien inventaire viendra avec la PR 3b).

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. Suppose back #102 (champ `date`, `today`, `backdate_min`), déjà mergée.

## [2026-11-21] — PR #144 (Registre des stocks : inscription, page de lecture, menu — PR 3a)

### Added
- **Registre des stocks** (`/app/eco/registre-stocks`, connecté ; menu et carte d'accueil sous Inventaires, seulement pour le maire, le commissaire au commerce et le dirigeant — le serveur le dit) : l'historique des inventaires inscrits d'une ville ou d'une province, au gabarit du Registre des mines (titre et filet, « Dernière inscription : il y a N jours, le JJ/MM. » — orange gras dès 2 jours —, deux colonnes). À gauche l'inscription ouverte (chevrons avant et après le titre, articles en colonnes compactes) ; à droite la **comparaison de deux inscriptions** (moteur de la Balance ; Article / Avant / Après / Écart) au-dessus des inscriptions repliables. Aide « i » dans le menu. Rien n'est stocké dans le navigateur.
- **« Vos données »** : section « Registre des stocks » (texte de Cowork ; durée et destinataires renvoyés à la politique §5 et §6).

### Changed
- **Bilan des stocks** : aux niveaux ville et province, bloc « Registre des stocks » à droite — le lieu est dit avant l'envoi, bouton « Inscrire au registre » (plume), « Rouvrir une inscription (n) ». Un autre texte le même jour : l'écran nomme le rédacteur de l'inscription à remplacer et demande confirmation (`confirm_replace`). Boutons d'action sous le champ de collage, décompte sur la ligne du libellé.
- **Accès** : cadenas fermé (`AccessDenied`) sans poste de lecture, y compris pour un 403 du Registre des mines (plus de « Réessayer » pour un refus) ; la Balance des stocks réserve la place du sélecteur de niveau pendant l'attente du droit.
- Carte d'accueil « Balance des stocks » sans « La ».
- Politique de confidentialité : l'auteur d'une inscription en vigueur n'est jamais nommé ; seul le rédacteur d'une inscription remplacée l'est.

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. Suppose back #100 déployée (`migrate` + `route:cache` en SSH) et back #101 (`today`, âge de la dernière inscription).

## [2026-11-20] — PR #143 (Politique §3 et §5 : Registre des stocks)

### Changed
- **Texte légal** (FR/EN, texte de Cowork validé par Greg, fil `admin/echanges/registre-stocks/`) : `Legal.Privacy.Section3.InventoryFields[3]` (inventaire municipal : « un seul exemplaire du dernier collage » ; l'inventaire peut aussi être enregistré, **à l'initiative du maire**, comme un **instantané daté** — Registre des stocks — dont l'historique est conservé et transmis au successeur), `[4]` (inventaire comtal : instantanés datés aussi) et `InventoryNote` (le **pseudo du rédacteur précédent reste visible** dans l'historique quand un inventaire est remplacé).
- **§5 (durée)** : l'historique des inventaires **d'une province ou d'une ville** est conservé sans limite de durée (mémoire de gestion du poste).
- Garde-fous dans `privacyInventory.unit.test.js` : ni historique personnel (reporté) ni accès du bailli promis ; §5 ville ; distinction « dernier collage » / registre.

### Deploy notes
- Frontend seul : aucune migration, route backend, `config/*.php` ni paquet. Entrée de journal de politique : back #99 ; `policy:notify` à la main, **seulement une fois ce texte en ligne**. L'écriture du registre (back #100) ne se merge qu'après.

## [2026-11-20] — PR #142 (Salle des comptes : Bilan des stocks, groupes Mines / Inventaires, loaders globaux violets)

### Changed
- **Renommage cosmétique** « Gestion des stocks » → **« Bilan des stocks »** (EN « Stock Report ») : pages, aides, `/legal/data`, politique de confidentialité et page cookies. Route (`/app/eco/inventaire`), fichiers, namespace `EconomyInventory` et cookies inchangés.
- **Salle des comptes** : étiquettes de groupe **Mines** / **Inventaires** dans le menu ; accueil en deux colonnes de groupes, cartes empilées dans chacun (`ModuleHomeCards`, prop `layout="single"`), pour accueillir un troisième ensemble. Clés `EconomyMenu.*`.
- **Balance des stocks** : carte et intro — « Posez votre nouvel inventaire sur les balances : l'Office pèse ce qui a gagné, perdu ou disparu par rapport à un ancien inventaire. »
- **Loaders globaux** : violets (couleur de Mon bureau) hors salles de module, page de maintenance comprise — l'ambre était trop proche de l'or d'Économie. Les loaders de module gardent leur couleur.

### Fixed
- **Welcome → Accueil** : « Vous entrez dans l'Office » de bout en bout (contexte `entry`) ; avant, « la salle » pendant le passage par `/login`, puis « l'Office » après la redirection d'un connecté.
- **Portail `/`** : plus de loader « Vous entrez dans l'Office » avant même d'être entré ; la sonde de maintenance tourne sans recouvrir (`cover: false`), la page de maintenance s'affiche si l'API est fermée.

### Deploy notes
- Frontend seul : aucune migration, aucune route backend, aucun `config/*.php`, aucun paquet ; rien à lancer en SSH.
- Première PR du brief `brief-registre-et-reorganisation-sdc` (fil `admin/echanges/registre-stocks/`).

## [2026-11-20] — PR #140 (La Balance des stocks : menu, phrase de reprise, boutons de niveau)

### Changed
- **Menu** : le lien s'écrit « Balance des stocks » (EN « Stock Balance »), comme « Bilan des mines » et « Gestion des stocks ». La carte de la Salle des comptes et le titre de la page gardent « La Balance… ».
- **Phrase de reprise** : « Reprenez votre dernier inventaire de la Gestion des stocks. », sous « Récupérer » ; textes en couleur fixe, la carte restant claire dans les deux thèmes. Au niveau province, une ligne précise qu'il s'agit du dernier inventaire inscrit à l'historique.
- **Boutons de niveau** (Personnel / Ville / Province), au-dessus des deux champs comme dans la Gestion des stocks : le niveau actif reste en or avec une **coche**, les autres passent de l'ardoise au **violet**, plus voyant. Un seul niveau : aucun groupe. Aide du module (étape 4) alignée. 6 tests (1299 Vitest au total).

### Deploy notes
- Frontend seul : aucune migration, aucune route backend, aucun `config/*.php`, aucun paquet ; rien à lancer en SSH.

## [2026-11-19] — PR #139 (La Balance des stocks : comparaison de deux inventaires)

### Added
- **La Balance des stocks**, 4ᵉ module de la Salle des comptes (`/app/eco/balance`, public, `EconomyInventoryBalance.vue`) : on colle un ancien inventaire et l'inventaire actuel, la comparaison s'affiche d'elle-même — hausse `▲ +3`, baisse `▼ -2`, items **nouveaux** (badge « Nouveau » à l'écran seulement), items **disparus** (section séparée, lignes barrées), écart du trésor. Une quantité identique n'affiche **rien** (pas de tiret, décision de Greg). Tableau groupé par les catégories de la Gestion des stocks.
- **« Récupérer »** : relit, en lecture pure (`inventoryStore.readLastPaste`), le dernier inventaire retenu par la Gestion des stocks pour le niveau choisi (personnel, ville, province = plus récent exemplaire de l'historique). Désactivé sans compte ni consentement « Préférences », sans ouvrir la bannière.
- **« Confier au scribe »** exporte le BBCode annoté (`▲` vert, `▼` rouge, disparus en section finale, options d'export de la Gestion des stocks) et **n'enregistre rien**. 🔴 Le module **ne stocke rien** (ni cookie, ni stockage local, ni serveur) : gardé par des tests avec espions et contrôle positif.
- **Texte légal** : section `Legal.Data.InventoryBalance` (FR/EN) dans « Vos données, outil par outil » (source unique `dataPageSections.js`, reprise par la politique §3). Pas de `policy:notify` (aucun traitement nouveau). Nom anglais : « The Stock Balance ».
- Entrée `whatsNew.json` (Chroniques) : « Dans la Salle des comptes, faites maintenant votre balance des stocks. » 38 tests (1293 Vitest au total).

### Deploy notes
- Frontend seul : aucune migration, aucune route backend, aucun `config/*.php`, aucun paquet ; rien à lancer en SSH. Le déploiement annonce l'entrée `whatsNew` sur Discord.

## [2026-11-19] — PR #137 (Accès administrateur depuis la page de maintenance)

### Added
- **Lien « Accès administrateur »** (FR/EN) sur la page de maintenance, qui ouvre un champ masqué : l'administrateur n'a plus besoin de retenir l'adresse `/maintenance/<secret>` (le secret avait été perdu pendant la mise en ligne de Laravel 13).
- **Le secret saisi est essayé avant d'être gardé** (`maintenanceProbe.tryBypass` : `auth/me` sans jeton, secret dans l'en-tête de contournement) : refusé = « Secret refusé. » et rien n'est mémorisé ; accepté = accès ouvert (onglet seulement) puis rechargement ; réseau coupé = « Vérification impossible, réessayez ».
- `api.js` : un en-tête de contournement explicite l'emporte sur un ancien secret mémorisé.
- 🔴 Le secret n'est écrit nulle part dans le site (ni `.env` du frontend : tout ce qui s'y trouve est copié dans le bundle public) ; garde-fou de test. 9 tests (1255 Vitest au total).

### Deploy notes
- Frontend seul : aucune commande SSH, peut se déployer sans fermer l'Office. Pendant du lien de la page 503 du panneau (back #95).

## [2026-11-18] — PR #134 (Annonces du site : bandeau « Oyez, Oyez ! » défilant sur l'accueil)

### Added
- **Bandeau d'annonce** en tête de l'accueil de l'application (`AnnouncementBanner` + `use/useAnnouncement.js`) : lit `GET announcements/current` (publique) et fait **défiler le message de droite à gauche**, dans la langue de l'interface (repli sur l'autre). Aucune règle côté site : le serveur choisit l'annonce, rédige la date (« cette semaine »…) et fixe la fin de visibilité. Une panne de l'API n'affiche rien.
- **Mouvement (WCAG 2.2.2, charte §8)** : 3 passes puis le texte reste à plat, en entier ; bouton pause / relance ; mouvement réduit = à plat d'emblée ; copie `sr-only` pour les lecteurs d'écran.
- **Plaque « Oyez, Oyez ! »** (« Hear ye, hear ye! ») : champ d'azur cerclé de laiton, médaillon de laiton avec le cor, texte crème en empattements du système (aucune police chargée), fondu aux deux bords ; contrastes mesurés.
- Textes `Announcement.*` FR/EN, 11 tests (1246 Vitest au total), `docs/ARCHITECTURE.md`, README.

### Deploy notes
- Dépend du backend (PR back #91, déjà mergée) : tant que `php artisan migrate` et `php artisan route:cache` n'ont pas été lancés en SSH, l'API répond 404 et le bandeau reste **absent**, sans erreur. Frontend seul : aucune commande SSH.

## [2026-11-18] — PR #127 (Mode maintenance : sonde de démarrage et loader global)

### Added
- **Sonde de démarrage** (`use/maintenanceProbe.js`, lancée par `main.js` avant le montage) : `GET auth/me` sans jeton — 503 « maintenance » → page de maintenance, sinon le site s'ouvre ; attente bornée à 2,5 s, jamais bloquante. Plus de site visible pendant une seconde avant la page de maintenance.
- **Loader global** (`LoadingOverlay`) pendant la vérification, avec le texte « Vous entrez dans l'Office… » (`Common.LoadingOffice`, FR et EN) et le **halo orange** de l'application — jamais la couleur du module d'arrivée, comme la page de maintenance qui lui succède. 7 tests ; 1235 Vitest au total.

### Deploy notes
- Frontend seul, rien à lancer en SSH. ⚠️ **Une requête de plus par visite** : le loader s'affiche le temps d'un aller-retour à chaque chargement du site, même hors maintenance. Aucune donnée du joueur n'y voyage ; le texte de « Vos données » (outils publics « tout reste dans le navigateur ») est à faire relire par Cowork ou Greg.

## [2026-11-18] — PR #126 (Mode maintenance : page embarquée et bypass administrateur)

### Added
- **Page de maintenance** (`components/MaintenanceNotice.vue`, monté dans `App.vue`), affichée quand l'API répond 503 `message: "maintenance"` : logo vertical, porte, message, introduction de l'accueil mise **au futur**, descriptif non officiel ; FR et EN ; **embarquée** (aucun appel API), sans lien ni navigation, défilable sur petit écran. Une sonde toutes les 30 s recharge la page dès que l'API rouvre.
- **Bypass administrateur** : `/maintenance/<secret>` retient le secret pour l'**onglet** (`sessionStorage`, liste blanche de `tests/enforcement/storage-usage`) ; `api.js` le présente dans `X-Maintenance-Bypass` ; liseré jaune avec « Quitter cet accès ». Permet d'essayer une mise à jour avant de rouvrir l'Office.
- `use/useMaintenance.js`, route `maintenance-bypass`, textes `Maintenance.*`. 14 tests (`tests/common/maintenance.test.js`) — 1228 Vitest au total.

### Deploy notes
- Backend associé : back #89 et #90 (mode maintenance au déploiement), déjà en prod. Rien à lancer en SSH. La page n'apparaît qu'au premier appel API (l'accueil et `/login` n'en font aucun au chargement).

## [2026-11-16] — PR #116 (Gestion des stocks : icônes des items dans l'export BBCode, phase 2)

### Added
- **Interrupteur « Sans illustration / Avec illustration »** dans « Consignes au scribe » (à droite de la dernière liste déroulante) : ajoute `[img]…[/img]` devant chaque item de l'export BBCode. **Réservé aux joueurs connectés** (option b de Greg, 14/11/2026) : sans compte, l'interrupteur n'existe pas et rien n'est demandé au serveur, ce qui garde la promesse « tout reste dans votre navigateur » — aucun texte légal modifié. Aucune image n'est chargée dans l'interface (l'IP du joueur n'est pas transmise au CDN de Celsius).
- `modules/itemIcons.js` (URL du CDN, découpe en lots de 200 noms et 6 000 caractères d'URL, ID entiers positifs seulement) et `use/itemIconsApi.js` (`GET item-icons` au moment d'exporter, pour les seuls items exportés ; réponse gardée pour la durée de la page). Une panne du serveur n'empêche pas l'export : il part sans icônes, avec un avertissement.
- Réglage personnel `exportShowIcons` dans le document de réglages du personnage (`inventoryStore`), sans clé de confort dans le navigateur.
- Entrée « improvement » (privée) au registre des réparations et des améliorations : `inventory-export-item-icons`.
- Garde-fous : l'adresse du CDN n'existe que dans `modules/itemIcons.js` et aucune vue ne pose d'image d'item (contrôle positif vérifié). 1214 tests Vitest.

### Changed
- La pastille « Nombre devant » se lit « Nbre dvt (596 art.) ».

### Prod
- Aucune route ni config ajoutée côté site. S'appuie sur back #86 (clé `exportShowIcons`, mergée le 16/11/2026) et back #85 (`GET item-icons`, en prod).

## [2026-11-13] — PR #115 (Lint : les 9 erreurs eslint du frontend)

### Fixed
- **eslint** : `eslint .` ne signale plus rien (9 erreurs préexistantes, 0 avertissement). `MonBureauView.vue` : `catch` vide de `loadPrices` commenté (échec volontairement silencieux) ; imports inutilisés retirés de `DataExport.test.js` et `accountSelfService.test.js` ; `eslint.config.js` : globales Node pour `tests/**/*.mjs` (`process` dans `textContrast.mjs`). Aucun changement de comportement.

## [2026-11-11] — PR #114 (Texte légal de la Gestion des stocks ; le module est renommé)

### Added
- **Politique de confidentialité** : la « Gestion des stocks » entre aux §3 (réglages ; texte collé chiffré ; inventaire personnel, municipal, comtal avec son historique ; phrase d'accès de l'éditeur selon `donnees-utilisateur.md` §5bis), §5 (durées) et §6 (qui lit : vous seul, le maire de la ville, le commissaire au commerce et le dirigeant de la province en lecture seule, aucune interface d'administration). **« Vos données »** : une section (sans compte requis, ce qui part avec le personnage, export art. 20). **Cookies** : la finalité et les données des Préférences nomment la Gestion des stocks. Texte de Cowork, validé par Greg le 11/11/2026 (fil `admin/echanges/inventaire-scopes/`, adaptations dans `03-mise-en-oeuvre-cc.md`).
- Garde-fou `tests/legal/privacyInventory.unit.test.js` (15 cas).

### Changed
- **Le module des inventaires s'appelle « Gestion des stocks » / « Stock Management »** (menu d'Économie, carte, titre de page, aide). « La Salle des comptes » reste le titre de l'accueil d'Économie, qui regroupe ses trois modules (Bilan des mines, Registre des mines, Gestion des stocks).

### Prod
- Aucune route, aucune dépendance. À mettre en ligne avec back `feat/inventory-legal` (entrée du journal de la politique), puis `php artisan policy:notify` par Greg (un seul email). 16 tests ajoutés (README : 1181).

## [2026-11-11] — PR #113 (Registre des réparations et des améliorations)

### Added
- **Nouveau type d'entrée « amélioration »** (`type: "improvement"` dans `src/data/whatsNew.json`) : annoncer ce qu'on améliore dans une salle ou un module déjà présenté dans les chroniques, sans créer une chronique pour chaque petite amélioration. Les entrées `fix` et `improvement` cohabitent dans **une liste unique** de l'accueil, triée de la plus récente à la plus ancienne, chacune avec un **badge** dont le texte porte le sens : « Réparation » (bleu) ou « Amélioration » (teal), la pastille de la ligne reprenant la couleur de son badge en plus foncé (violet pour une entrée réservée aux membres). Les entrées `scope: "private"` n'apparaissent toujours que connecté.
- **Annonce Discord** : une amélioration part avec le registre (même salon que les corrections, un fil par entrée), avec l'emoji ✨ (`scripts/whatsNewAnnounce.mjs`).

### Changed
- Le titre de la section devient « **Registre des réparations et des améliorations** » / « Repairs and improvements registry » (`Home.RegistryTitle`, qui remplace `Home.Fixes` ; `Home.TagFix` et `Home.TagImprovement` ajoutées, FR + EN).
- Aucune interface d'administration (le brief n'en veut pas) : Greg publie une entrée comme aujourd'hui, en choisissant `"type": "improvement"`. Brief : `admin/content/brief-registre-ameliorations.md`.

### Prod
- Aucune route, aucune dépendance. 5 tests ajoutés (README : 1165).

## [2026-11-11] — PR #112 (Fix : le poste demandé s'affiche tant que la demande est en attente)

### Fixed
- Sur la carte d'un mandat (Profil), une demande de **conseiller** en attente de vérification affichait « Conseil comtal de … — **sans poste** » au lieu du poste demandé (le maire s'affichait correctement). La carte lisait le poste **détenu**, vide tant que rien n'est validé ; elle lit désormais le poste **demandé** que l'API envoie dès l'inscription (`pending_office_label`) pendant que le statut est « en attente ». Un mandat validé garde le poste détenu, sa déclaration de poste en attente garde sa mention propre, une demande inscrite sans titre reste « sans poste ». Aucun changement backend. Signalement : `admin/content/fix-affichage-poste-demande.md`.

### Prod
- Aucune route, aucune dépendance. 4 tests ajoutés (README : 1160).

## [2026-11-11] — PR #111 (Inventaires en base pour les joueurs connectés : réglages aux trois niveaux, inventaire collé, historique de la province)

### Added
- **Avec un compte, les réglages d'inventaire passent du navigateur au serveur**, par personnage : catégories, assignations objet → catégorie, ordre, couleur d'export, options d'export, lignes masquées, et le **dernier inventaire collé** (enregistré chiffré). On les retrouve sur n'importe quel appareil. **Sans compte, rien ne change** : tout reste dans le navigateur (mêmes clés de confort qu'avant, enregistrées seulement si les préférences sont acceptées).
- **Reprise à la première connexion** : si le personnage actif n'a encore rien en base, les réglages et le collage du navigateur y sont enregistrés, puis effacés d'ici — seulement après la réussite de la sauvegarde ; un échec laisse tout intact. Un message l'annonce.
- **Trois niveaux d'inventaire** (`stores/inventoryStore.js`, `use/inventoryApi.js`) : personnel ; **ville** (le maire en fonction) ; **province** (le commissaire au commerce écrit, le dirigeant lit seulement). Ce que le personnage peut ouvrir est dit par le serveur (`inventory-scopes`) : le site ne recalcule aucun droit.
- **Salle des comptes** : un sélecteur de niveau, visible seulement pour qui a un poste ; un niveau en lecture seule est annoncé et n'offre ni correction ni inscription. Une correction de catégorie est enregistrée tout de suite (groupée, 800 ms) et se retrouve dans Mon bureau.
- **Province** : l'historique des inventaires s'**inscrit à la main** (bouton « Inscrire à l'historique de la province », jamais automatiquement) ; un second inventaire du jour remplace le premier, un texte identique ne change rien ; un sélecteur recharge un inventaire passé (dates en année du jeu, `inventory_snapshot_date`).
- **Mon bureau — Catégories d'inventaire** : un accordéon par inventaire géré (`InventoryLevelsAccordion.vue`), le personnel ouvert ; en mode ville/province, titre nommant le lieu. **Copie** des réglages personnels vers un autre personnage du même compte : un bouton « Copier vers un autre personnage » à droite du choix des couleurs ouvre une **modale** (`CopySettingsModal.vue`) pour choisir le personnage, avec confirmation si la cible en a déjà ; le texte de l'inventaire n'est jamais copié.
- **Écritures à version** : un conflit (un autre appareil a écrit entre-temps) remplace l'état local par celui du serveur et le dit.

### Changed
- « **Effacer** » vide le champ de collage et l'état d'affichage des lignes — plus ni l'inventaire enregistré ni les catégories assignées (ce sont des réglages).
- `InventoryCategoryPanel` ne lit plus le cookieStore : il reçoit `itemCategories` et `readonly` en propriétés ; `InventoryItemsModal` accepte `readonly`.
- `cookieStore.removeComfortData(key)`.
- **Retouches visuelles** : flèches de l'ordre des catégories en violet (couleur de Mon bureau) ; boutons de masquage des catégories de la Salle des comptes en or (couleur d'Économie, ceux des objets inchangés) ; l'aide de l'ordre fondue dans le titre (« Ordre des catégories (modifier l'ordre pour votre inventaire) ») ; colonne de collage un peu plus étroite (5/11).
- Textes FR + EN : `EconomyInventory.{Level*,ReadOnlyScope,Province*,SaveError}`, `MonBureau.{CatCityPanel,CatProvincePanel,LoadingSettings,SettingsLoadError,ImportedFromBrowser,Copy*}`.

### Prod
- **Dépend de back #83** (quatre migrations, routes ajoutées : `migrate` puis `route:cache`), mergée le 11/11/2026 : à faire **avant** que les joueurs ouvrent la Salle des comptes.
- 🔴 **Rien ne se met en ligne avant le texte légal** (fil `admin/echanges/inventaire-scopes`, Cowork) : politique, « Vos données », registre des traitements.
- 43 tests ajoutés (store, accordéons et modale de copie, Salle des comptes avec compte) ; décompte du README : 1156.

## [2026-11-11] — PR #110 (Mon bureau en sections, une à la fois ; héros violet ; catégories en deux colonnes)

### Changed
- **Mon bureau** n'empile plus trois panneaux : un **menu de sections** (Ma province · Prix des mines · Catégories d'inventaire) n'en affiche **qu'une à la fois**, chacune avec son adresse (`/app/mon-bureau/categories`…). « Prix des mines » n'existe que pour qui gère les prix d'une province. L'entrée courante est annoncée aux lecteurs d'écran.
- **Héros** comme l'accueil d'Animation, aux couleurs de Mon bureau (violet) : grand titre, filet orné d'une plume et sous-titre sur une seule ligne.
- **Liens directs** : « Gérer mes catégories » (Salle des comptes) ouvre l'onglet des catégories ; le lien de gestion des prix du Registre ouvre l'onglet des prix.
- **Place gagnée** : espace réduit au-dessus du titre, bandeaux colorés pleins remplacés par des titres compacts, formulaire d'ajout de catégorie sur une ligne (champs de largeur utile), mention « Cliquez sur une catégorie… » sous la ligne séparatrice, un espace garanti sous la carte avant le menu circulaire. Chaque section prend la place de son contenu (prix en carte compacte, province en colonne bornée).
- **Catégories d'inventaire** : un **accordéon par inventaire** (« Catégories d'inventaire — Personnel » aujourd'hui, ouvert par défaut, bandeau jaune foncé : d'autres viendront, ville, province…). Deux colonnes dès `laptop` : **gestion à gauche (3/4** : couleur des titres, ajout, puis prédéfinies | personnalisées | masquées) et **ordre d'export à droite (1/4)**, toujours visible, liste compacte (boutons ↑ ↓ de 26 px), sans phrase d'explication des flèches (leur libellé accessible reste). Les titres des blocs sont dans la couleur du module (`yellow-700`, 4,9:1).
- Les panneaux repliables de la page et leur état mémorisé (`mon_bureau_panels`) disparaissent ; deux clés de langue inutilisées retirées, cinq ajoutées (FR + EN).
- `docs/ARCHITECTURE.md` décrit enfin `MonBureauView` (la doc parlait encore de `ProvinceView`).

### Prod
- Aucune route serveur, aucune dépendance. Dépend de la PR front #109 (ordre des catégories), mergée et déployée le 11/11/2026.

## [2026-11-11] — PR #109 (Inventaire : ordre des catégories et encart « Consignes au scribe »)

### Added
- **Ordre des catégories** : dans Mon bureau, une section « Ordre des catégories » liste les catégories visibles avec des flèches ↑ ↓ (adaptées au mobile et au clavier, annonce lecteur d'écran, première/dernière désactivées). L'ordre choisi (`inventory_cat_config.order`) vaut pour **le tableau d'inventaire et pour le BBCode exporté** ; une catégorie créée ou restaurée ensuite se place à la fin, une catégorie supprimée ou masquée est ignorée. Sans ordre choisi : l'ordre par défaut. Fonction pure `orderCategoryKeys()`.

### Changed
- **Encart d'export** : « Options d'export » devient **« Consignes au scribe »** (EN : « Instructions for the scribe ») et le bouton **« Confier au scribe »** y passe, à droite des options, en action principale de l'encart ; il quitte la rangée d'actions du haut.
- `docs/ARCHITECTURE.md` documente enfin l'inventaire, et dit ce qui n'existe pas : **aucun stockage serveur** des inventaires ni des catégories (vérifié dans le backend), catégories par scope de mandat non construites.

### Prod
- Aucune route, aucune dépendance. Cinq clés de langue ajoutées (FR + EN) et le titre de l'encart d'export renommé, sans changement de politique : l'ordre vit dans le même réglage de confort que les catégories.

## [2026-11-11] — PR #108 (Bilan des mines : « Confier au scribe » et listes du rapport du jour compactes)

### Changed
- Le bouton **« Mise en forme du jour »** du Bilan des mines devient **« Confier au scribe »**, en **vert** (même libellé et même couleur que les autres exports vers le forum) ; l'aide du coffre le cite sous son nouveau nom.
- **Rapport du jour (BBCode)** : `[list]` est collé au premier `[*]` et `[/list]` au dernier élément — le forum rendait chaque retour à la ligne en ligne vide. Même principe que le bilan hebdomadaire (06/10/2026), qui n'est pas modifié.

### Prod
- Aucune route, aucune dépendance, aucune clé de langue ajoutée.

## [2026-11-11] — PR #106 (Grille des lots, 2ᵉ activité du module Animation ; chapitre « Animation » de la politique)

### Added
- Activité **« Grille des lots »** (`rewards`) : une grille N×M de cases numérotées, des lots à inscrire, un tirage au sort, l'attribution des cases réclamées, la clôture. Deux modes comme Décode le code : **privé** (« Ma grille », lié au personnage) et **sans compte** (créer, retrouver sa grille, réinitialiser le mot de passe, confirmer l'email). Page publique `/public/activite/grille/:slug` (visible dès le tirage), export BBCode en liste `[list][*]` (règles et résultats).
- Le **tirage fait passer la grille directement à « tirée »** (décision de Greg, 10/11/2026) : plus d'étape « confirmer » ; la page publique s'ouvre au tirage.
- **Écrans communs à toutes les activités d'Animation** (`modules/animKinds.js`, `use/animApi.js`, `use/useAnimKind.js`, `AnimCreateForm`, `AnimStartPanel`, `AnimPublicShell`, `Anim{CreateAnonymous,Manage,Reset,ConfirmEmail}View`) : Décode le code et la grille en sont deux déclarations ; les vues `Decode*` ne sont plus que des enveloppes. Aucun changement de comportement pour Décode.
- **Textes légaux** (analysés par Cowork, validés par Greg le 11/11/2026, `admin/content/policy-animation.md`) : **un seul chapitre « Animation »** aux §3, §5 et §6 de la politique de confidentialité (les engagements de Décode conservés mot pour mot, une ligne par activité), cookies Préférences (adresse mémorisée « de chaque type »), **une seule entrée « Animation »** de « Vos données » ; `privacyAnimDecode` devient `privacyAnimation`.
- Garde-fou `tests/enforcement/anim-i18n-keys` : toute clé de texte littérale du module Animation existe en français et en anglais.
- Entrée `rewards-grid-activity` de la Chronique (`whatsNew.json`) : annonce Discord au déploiement. ⚠️ Le type `rewards` naît inactif côté serveur : l'entrée est visible dès le déploiement, **l'activer** (`/anim`) juste après.
- 100+ tests (`tests/anim/Rewards*`, `useRewardsGrid`, `rewardsBBcode`).

- **Ajout des lots** : une **quantité** (3 × « 50 écus » = trois lots, donc trois cases) à côté du nom ; « Ajouter une liste » (un lot par ligne, virgule ou tabulation, sans quantité ; un nombre collé au nom reçoit une espace, un nombre seul + tabulation est recollé au nom). Tout passe par **un seul appel** (`names` sur `POST …/lots`, tout ou rien) : 100 lots ne dépassent plus la limite de 60 requêtes par minute.
- **Écran de l'organisateur** : « Ma grille de lots « … » », liste des lots à gauche, plateau au milieu, explicatif et exports à droite ; l'attribution d'une case dans une **modale** (charte §6.7) ; plateau aux cases carrées (sceau ardoise / coffre ouvert doré) dont la taille est bornée pour que toute la grille tienne à l'écran ; liste des lots défilant dans son cadre ; explicatif qui évolue (comment remplir, puis le tirage).
- **Création** : formulaire pleine largeur, aperçu vivant de la grille, nom et adresse sur une ligne, royaume / province / ville sur une ligne (`CityCascadeSelect` : option `one-line`).
- **Page publique** : même structure (liste, grille, légende « case libre / case dévoilée »), sans cadres blancs.
- **Exports BBCode** : « Confier les règles / les résultats au scribe » copient directement dans le presse-papier ; les résultats **ne dévoilent jamais une case non réclamée** ; plus d'icône dans le titre.

### Fixed
- Grille sans compte : l'adresse email n'était **jamais envoyée au serveur** (clé `organizer_email` au lieu de `email`) — ni lien de confirmation ni réinitialisation par email.
- Une grille sans compte **pas encore tirée** n'était pas retrouvée à l'entrée (sa page publique répond 404) : la reprise est proposée.
- Plateau : défile dans son cadre et rétrécit ses cases au lieu de déborder à 375 px ; `role="grid"` invalide remplacé par un groupe de boutons ; « Case » n'est plus en dur ; bouton « × » de retrait nommé ; statut de la grille remis à jour après un retrait de lot ; clés `TakenEmpty` manquantes ; couleurs hors thème (`sky`) ; refus `dimensions` du serveur désormais affiché.
- Textes de la grille alignés sur le serveur : l'adresse confirmée sert au lien de confirmation, à la réinitialisation du mot de passe et à l'avis de changement de mot de passe ; une grille sans action depuis 30 jours est close.

### Prod
- Dépend de back #82 (`feat/rewards-grid`) (migrations `anim_rewards_*`, routes : `migrate` + `route:cache`). ⚠️ **Rien ne se déploie avant le texte légal** (politique, cookies, « Vos données », registre des traitements).

## [2026-11-11] — PR #107 (footer : « Outil non officiel » aussi dans l'application)

### Changed
- La mention **« Outil non officiel »** du footer s'affiche désormais **sur toutes les pages qui portent le footer**, y compris dans l'application (`/app/*`) ; elle n'apparaissait que sur les pages publiques (légales, connexion…). « Gérer mes préférences » reste réservé aux pages publiques (déjà dans la barre de navigation). Seule la page d'accueil, qui a son propre disclaimer, n'est pas concernée.

### Prod
- Aucune route, aucune dépendance, aucune clé de langue ajoutée.

## [2026-10-29] — PR #102 (accueil : la chronique défile dans son cadre)

### Fixed
- Accueil : la zone de contenu n'avait aucune hauteur plafonnée, donc chaque entrée de la chronique allongeait la carte et repoussait le footer sous la ligne de flottaison. Chaque liste (Chroniques, Registre des Réparations) défile maintenant dans un cadre plafonné, atteignable au clavier et nommé par son titre, avec un fondu en bas et une barre fine. ⚠️ Le contraste de la barre (2,45:1) est sous les 3:1 de WCAG 1.4.11 : voulu par Greg.

## [2026-10-28] — PR #101 (Décode le code : interface de la première activité du module Animation)

### Added
- Activité **« Décode le code »** (Mastermind à 5 chiffres) dans la Salle des Jeux, en deux modes : **privé** (« Ma salle », lié au personnage) et **sans compte** (créer, retrouver sa salle, réinitialiser son mot de passe, confirmer son adresse). Pages sous `/app/anim/decode/…` ; page à partager `/public/activite/decode/:slug`, sans NavBar ni footer commun (ligne « site non officiel »).
- Blocs partagés `DecodeHero`, `DecodeAttemptsTable`, `DecodeOpenedChests`, `DecodeRankingCard`, `DecodeCodeVisual`, `DecodeStartPanel`, `DecodeActivityCard` ; le coffre en cours reste scellé (cinq cases « ? »), personne n'en connaît la combinaison. Textes FR et EN, aucune règle côté site.
- **Texte légal** : trois insertions dans la politique de confidentialité (§3, §5, §6, dont « administrateur du site » au §6) et l'énumération des Préférences de la politique des cookies ; garde-fou `tests/legal/privacyAnimDecode`. Dates `LAST_UPDATED` au 28/10/2026.
- Entrée `decode-activity` de la Chronique (`whatsNew.json`) : annonce Discord au déploiement.

### Prod
- Dépend de back #72 (déployée, `migrate` et `route:cache` faits le 28/10/2026). ⚠️ `policy:notify 2026-10-28-decode-le-code` à lancer à la main une fois cette PR en ligne.

## [2026-10-21] — PR #100 (Registre : le tableau de bilan ne déborde plus à 375 px)

### Fixed
- Registre des mines : à 375 px le tableau de bilan élargissait toute la page (la grille des deux colonnes n'avait pas de colonne définie sur mobile) ; `grid-cols-1` la borne, le tableau défile dans son conteneur. Inchangé sur ordinateur.

## [2026-10-21] — PR #99 (colonne des modules en mobile, cadenas « accès refusé »)

### Fixed
- Économie, Sécurité (Guet) et Animation : à 375 px la colonne de gauche (1/6 de la largeur) recouvrait le contenu ; sous 1024 px elle passe au-dessus, en pleine largeur. Inchangé au-delà.

### Added
- `AccessDenied` : le refus de l'historique des prix s'affiche avec un cadenas fermé et le message du serveur, sans « Réessayer ».

## [2026-10-20] — PR #98 (export BBcode : « écus » partout)

### Changed
- Export BBcode du bilan des mines (Bilan et Registre) : « écus » après la valeur de la production, les salaires et l'entretien, dans chaque mine et dans le total.

## [2026-10-19] — PR #97 (chargements internes : coffre, portique, parchemin)

### Added
- `ChestLoader` : le coffre du logo s'ouvre dans la carte pendant le chargement d'une page (Registre, historique des prix, Ma province) ; prêt,
  la lueur jaillit, le coffre s'efface, puis le contenu apparaît. Échec ou > 10 s : coffre refermé, message, « Réessayer ».
- `AccessLoader` (cadenas en ligne, zone des prix du Bilan), `useSharedResource` / `useMineAccess` (une requête d'accès partagée).
- Garde-fou `motion` : refuse aussi toute animation CSS `infinite` (styles de vues et `.css`).

### Changed
- Overlay global : portique aux torches (navigation, couleur du module) et parchemin déroulé (envoi) ; l'icône restait brun foncé en thème sombre.
- `MineRegistrySave` : « Le greffe scelle le parchemin… » puis « Parchemin scellé ».

### Fixed
- Ma province : le menu circulaire manquait depuis l'origine.

## [2026-10-17] — PR #96 (charte : fin des anciens boutons `btn-*`)

### Changed
- Dernières vues migrées vers `odc-*` : flèches de semaine (Bilan, Registre : carrés ardoise), exports BBcode (Bilan, Guet : vert, `fa-copy`),
  suppression de compte (rouge), « Se connecter » de l'accueil (orange), ajout de personnage (`DefaultSubmitButton` : vert, `fa-plus`).

### Removed
- `.btn`, `.btn-primary`, `.btn-grad-*` et les autres classes de boutons de `style.css` ; composants morts `PrimaryButton`, `DangerButton`,
  `SuccessButton` ; test `btn-grad-contrast` (plus rien à mesurer). Garde-fou `no-quiet-button` étendu aux anciennes classes.

## [2026-10-17] — PR #95 (charte : fin des boutons blancs, « Retour » en ardoise)

Passe de migration vers `CHARTE-GRAPHIQUE.md` §6.7, avec l'accord de Greg (17/10/2026).

### Changed
- Plus aucun `odc-btn--quiet` dans les vues : bannière cookies (« Gérer mes préférences » en standard ardoise), mandats du Profil (déclarer,
  changer de poste, renouveler : vert ; annuler la demande : rouge), renvoi du lien de connexion (ardoise), résidence du Profil (Annuler rouge à
  gauche, Enregistrer vert à droite, icône `fa-save`).
- « Retour » en ardoise avec `fa-reply` sur les quatre pages légales, `404.vue` et l'ajout de personnage (ex-`btn-grad-slate`).
- « Copier pour le forum » (Ma province) passe de `fa-reply` à `fa-copy` : `fa-reply` ne veut dire que « retour » (révision du bouton en roadmap).

### Added
- Garde-fou `tests/enforcement/no-quiet-button.unit.test.js`.

## [2026-10-16] — PR #94 (Politique : les prix des mines de la province)

Texte validé par Greg le 16/10/2026 (`admin/content/policy-prix-registre-draft.md`), posé avant l'entrée de journal côté back.

### Changed
- §3 : la ligne « Les prix et le taux horaire » du Registre dit que les prix viennent de la table de la province, plus d'une saisie du joueur.
- Page « Vos données », Registre des mines : les prix de la province (usage et contenu).

### Added
- §3 (ce que l'Office conserve pour les prix), §5 (sans limite de durée, correction jusqu'à 7 jours après la fin du mandat, une correction remplace la valeur,
  lien avec le compte supprimé), §6 (trois postes + dirigeant, email quotidien qui nomme l'auteur). Tests `privacyMineRegistry`, `PrivacyPolicyView`.

## [2026-10-16] — PR #93 (Registre des mines : textes de présentation, lot 3 des prix)

Lot 3 du brief `admin/content/brief-prix-registre.md` : les aides décrivent ce que le module permet de faire.

### Changed
- Aide du registre : neuf étapes — page en deux colonnes, bilan en cours remplaçable par une semaine (◀ ▶, prix jour par jour),
  historique des niveaux dépliable, relevés inscrits, **prix** (qui les fixe, « Gérer les prix », « Historique des prix », grâce de
  7 jours), **export** « Confier au scribe ».
- Aide de la plaque d'enregistrement : les prix viennent de la table de la province, plus à vérifier à la saisie.
- Aide du Bilan public : 5ᵉ étape, prix d'un gérant du registre en lecture seule.

### Added
- Garde-fou `mineModuleTexts` : une aide cite un bouton tel qu'il s'affiche ; `MainEconomy.test.js` pour les aides.

Hors lot : les textes légaux (politique, « Vos données ») ne disent encore rien de la table des prix — à décider.

## [2026-10-16] — PR #91 (politique : le commissaire au commerce consulte le Registre des mines)

### Changed
- Politique de confidentialité §6, page « Vos données » et aides du registre : le commissaire au
  commerce rejoint le dirigeant parmi ceux qui **consultent** le Registre des mines (lecture seule ;
  l'écriture reste au commissaire aux mines et au bailli). Décision de Greg, 15/10/2026.
- Dates de dernière modification de la politique et de la page : 16/10/2026.
- ⚠️ Aurait dû être déployé **avant** back #64 (le texte précède la règle) : l'ordre a été inversé par erreur
  le 15/10 (back #64 déployé à 21:57 UTC, ce texte seulement après). Ensuite : entrée de journal substantielle
  et `php artisan policy:notify` par Greg.

## [2026-10-15] — PR #92 (Registre des mines : prix par période, bilans hebdomadaires, export BBCode)

Brief `admin/content/brief-prix-registre.md`, décisions de Greg des 14 et 15/10/2026. Dépend de back #63.
⚠️ Déployé (21:53 UTC) **avant** back #63 (22:29 UTC) : pendant cette demi-heure, un relevé enregistré par un gérant
du registre est parti **sans prix** (le site n'en envoie plus, le serveur ne les figeait pas encore).

### Added
- Page `/app/eco/registre/prix` : historique en **frise de plaques** (jeu en vigueur aujourd'hui repéré, unités par
  minerai, écart avec le jeu précédent). Ajout et modification par la **même modale**, préremplie (à défaut, avec les
  derniers prix du Bilan en cookies). Accès par le bouton « Historique des prix » du registre, sans lien de menu.
- Registre : bilans **jour par jour** avec le jeu de prix en vigueur ce jour-là (repli sur les relevés), **un seul tableau**
  de bilan (mois ou semaine) avec ◀ ▶ pour parcourir les semaines du mandat, export BBCode « Confier au scribe »
  d'une semaine complète (gabarit `mineBBcode.js` partagé avec le Bilan), mise en page en deux colonnes sans défilement,
  historique des niveaux en accordéon.
- `ModalCloseButton` : la même croix ronde rouge ferme **toutes** les modales ; plus de bouton « Annuler » en modale
  (aide, prix, mandats, cookies, suppression de compte).
- Rappel des prix en vigueur sur la plaque d'enregistrement d'un relevé.

### Changed
- Bilan public : un gérant du registre voit les prix de sa province **sans pouvoir les modifier** ; les autres saisissent
  les leurs (cookies). L'enregistrement d'un relevé n'envoie plus de prix à un gérant : le serveur fige ceux de la table.
- Dates des prix en **année du jeu** (1474), champ date compris.

## [2026-10-11] — PR #90 (page « Vos données, outil par outil »)

### Added
- `/legal/data` (publique) : « Qui peut utiliser quoi », sommaire, une section par outil (compte,
  postes déclarés et Ma province, Bilan des mines, Registre des mines, Guet, carte) avec un badge
  d'accès au titre, les mêmes questions dans le même ordre, et sa date de dernière modification.
- Politique de confidentialité (§3) : une ligne par outil, liée à sa section. Version B (Greg,
  06/10/2026) : la politique ne perd aucune ligne ; Postes et Registre renvoient à elle pour la durée
  et les destinataires.
- Garde-fous : `dataPageSingleSource`, `badgeContrast`, `DataPageView`, route `/legal/data`.

### Changed
- Registre des mines : plus marqué « à venir » (ouvert le 08/10) ; son texte d'accès nomme le
  dirigeant, qui consulte (comme le §6 de la politique depuis front #85).
- Dates de dernière modification de la politique et de la page : 11/10/2026.

## [2026-10-11] — PR #89 (Registre : la plaque dit la date du relevé)

### Fixed
- Plaque d'inscription au registre : affiche « Relevé du JJ/MM », le **dernier jour présent dans le
  collage** — la date que le serveur inscrit désormais (back #61). Un ancien collage rattrape un jour
  manquant au lieu de remplacer le relevé du jour. Confirmation et aide alignées (FR/EN).

## [2026-10-10] — PR #88 (Registre des mines, PR 4b : la page de lecture)

Brief `admin/content/brief-registre-mines.md` §7 ; fil `admin/echanges/registre-mines` (R4). ⛔ Après back #60.

### Added
- **`/app/eco/registre`** (`EconomyRegistry`) : âge du dernier relevé, état du parc au dernier relevé en
  vigueur avec le constat de seuil, jours sans relevé depuis l'entrée en fonction du lecteur, relevés du
  prédécesseur dits comme des faits, historique remplacements compris. FR + EN. 7 tests, contrôle positif.
- **PR 4c, même PR** : historique des niveaux (+1 crédité ; −1 sans entretien après un seuil atteint =
  échec constaté, en gras ; autre −1 = choix assumé) et bilans de mi-mandat / fin de mandat calés sur le
  mandat du lecteur (« dans N jours » avant la date ; couverture affichée). `modules/mineRegistry.js` ;
  `computePeriodBilan` généralise le bilan hebdomadaire. 10 tests de plus, contrôle positif.
- **Mise en page arrêtée avec Greg (09-10/10)** : âge du dernier relevé à droite du titre, en italique,
  orange dès deux jours ; en tête, le **bilan en cours du mois de mandat** (provisoire, couverture dite),
  qui **remplace l'état des seuils** (jauges retirées du registre) ; deux colonnes mandat / mémoire ;
  **jours sans données** au lieu de jours sans relevé (un collage couvre 7 jours), en périodes « du … au … » ;
  aide « i » du registre dans le menu d'Économie ; `HelpModal` élargie (aussi pour le Bilan). Relevés
  inscrits avant back #58 : libellé et ressource repris de l'état de la mine (la valeur n'est plus nulle).

### Changed
- Menu d'Économie : le repère « Registre des mines — à venir » devient un **lien**, affiché seulement à qui
  peut lire le registre (commissaire aux mines, bailli, dirigeant). Clé `Economy.ComingSoon` retirée.

## [2026-10-08] — PR #87 (Bilan : la semaine en cours à l'arrivée, sauf le lundi)

### Changed
- La page du Bilan s'ouvre sur la **semaine en cours** — on y colle le relevé du jour —, sauf le **lundi**,
  où elle reste sur la semaine passée pour compléter les heures du dimanche (elles n'arrivent que dans
  le collage du lundi). `defaultWeek` remplace `lastCompletedWeek` et la règle « dernière semaine
  achevée » du brief §2.4 (Greg, 08/10/2026). La semaine en cours reste un bilan provisoire, non exportable.

## [2026-10-08] — PR #86 (Registre des mines, PR 2 : l'écran)

Brief `admin/content/brief-registre-mines.md` §2, §6 ; fil `admin/echanges/registre-mines` (R3).
⛔ Après back #58 (route d'accès, `route:cache` en SSH).

### Added
- `components/mines/MineRegistrySave.vue`, sous le collage du Bilan : « un collage, deux destinations ».
  Visible seulement pour le personnage actif que l'API dit commissaire aux mines ou bailli ; dit la
  province du **poste** et le personnage **avant** l'envoi ; 409 → confirmation qui nomme l'auteur en
  place, remplacement seulement sur « Remplacer » ; refus affichés tels que l'API les donne (FR/EN).
  Aucune règle recalculée côté site. 8 tests, contrôle positif fait.
- Mise en page arrêtée avec Greg : **plaque ardoise bordée d'ambre** (matière des plaques du menu,
  charte §3.1) dans la colonne des actions du jour, sous « Mise en forme du jour » ; la province en
  titre ; bouton or « Inscrire au registre » (or = couleur d'Économie) ; icône d'aide jaune et
  modale `HelpModal` qui explique l'inscription (FR/EN). Contrastes du texte de 9,85 à 13,14:1.

## [2026-10-08] — PR #85 (politique : le dirigeant consulte le Registre)

### Changed
- **`/legal/privacy` §6, Registre des mines** : le dirigeant de la province (comte, duc…) **consulte** le
  registre de sa province — décision de Greg du 08/10/2026 (« c'est le chef de la province »), qui
  remplace le « jamais le comte » du brief. L'écriture reste au commissaire aux mines et au bailli ;
  les autres conseillers, jamais. Corrigé **avant** l'envoi de la notification : un seul email couvre
  le texte final. `LAST_UPDATED` inchangé (08/10, même jour).

## [2026-10-08] — PR #84 (politique : le Registre des mines)

Fil `admin/echanges/registre-mines` (07, ordre des PR) ; texte validé par Greg le 06/10
(`admin/content/policy-registre-mines-draft.md`).

### Added
- **`/legal/privacy`** : trois insertions pour le Registre des mines, FR + EN — §3 ce qui est conservé
  (texte collé tel quel, relevé analysé, prix et taux, province du poste), §5 « sans limite de
  durée », « le lien avec votre compte est supprimé », « aucun relevé ne peut être effacé », §6 le
  commissaire aux mines et le bailli, jamais le comte (placé avant « Personne d'autre »).
  Termes anglais du jeu relevés par Greg (*Management of the mines*, *deterioration threshold*,
  *Mines Superintendent*, *Sheriff*). Garde-fou `privacyMineRegistry` (contrôle positif fait).
- ⚠️ **Modification substantielle** : `LAST_UPDATED` à la date de mise en ligne au merge, puis entrée
  de journal backend + `policy:notify`. L'écriture du Registre (PR 1b) n'ouvre qu'après.

## [2026-10-07] — PR #83 (le Bilan lit l'écran anglais)

Brief `admin/content/brief-bilan-mines.md` §5 bis, fil `admin/echanges/bilan-mines/08`.

### Fixed
- L'aide anglaise (front #82) envoyait le joueur sur « Management of the mines », mais
  `mineParser.js` ne lisait que l'écran français : un collage anglais était refusé. Le parseur
  reconnaît désormais les deux (titres de section, « Node », ressources, *Level*, *Deterioration
  threshold*, *Normal maintenance*…), d'après le collage réel de Greg. **Aucune conversion
  d'unité** ; point décimal lu comme la virgule. Test jumeau FR/EN, écrit rouge avant le correctif.

## [2026-10-07] — PR #82 (Bilan des mines : un bilan juste)

Brief `admin/content/brief-bilan-mines.md`, fil `admin/echanges/bilan-mines`.

### Fixed
- **Décalage d'un jour** du relevé (`mineParser.js`) : pour le jour D, production[D], consommation[D]
  et **heures[D+1]** ; un jour dont une moitié manque est écarté, une semaine n'est complète qu'avec
  les heures du lundi suivant.
- La synthèse par ressource, qui imputait tout le salaire à l'or et inversait la lecture (l'or
  « gouffre », le fer « rente »), est **supprimée** : salaire = heures × taux, **par mine**.
- Fusion de deux collages clavetée sur le **nœud** de la mine (`mineKey`), plus sur « Mine N » qui
  glisse quand une mine ouvre ou ferme. `todayIso()` donne la date de Paris.

### Changed
- **Une table par mine** (production avec son unité, valeur, heures, salaire, entretien, solde) et
  une ligne Total ; convention de valorisation écrite à l'écran.
- Semaine proposée par défaut : la **dernière achevée** ; une semaine incomplète s'affiche
  « Bilan provisoire » et **ne s'exporte pas**.
- Prix et taux horaire **mémorisés avec chaque semaine** (confort, avec consentement).
- BBcode du bilan refait avec Greg : un seul `[quote]`, une liste par mine, soldes et net signés en
  vert/rouge, net en grand à gauche.
- Termes anglais du jeu relevés par Greg : *Management of the mines*, *deterioration threshold*,
  unités *tons* / *ounces* / *bars* (mêmes nombres, autre nom).

### Added
- **Alerte de seuil** à l'écran seulement (jamais dans un export) : atteint dès l'égalité, prévention
  à 2 unités ou moins, datée du jour du collage.

### Removed
- `tests/fixtures/mines-2025-11-10.json` (semaine sans heures, incalculable ; ses tests figeaient le
  défaut) — dans l'historique, commit `b220edb`.

## [2026-10-05] — PR #81 (confirmer l'email depuis le site des joueurs)

### Changed
- Le lien de confirmation d'email pointe vers `/verify-email` de ce site (back #53) : `VerifyEmailView`
  lit `id`/`hash`/`expires`/`signature` et rappelle l'API en JSON (`authStore.confirmEmail`).
  `?token`/`?error` restent pour les liens envoyés avant.

## [2026-10-05] — PR #80 (logo des emails servi par le site des joueurs)

### Added
- `public/images/email/logo-horizontal.png` : logo des emails du backend, servi par
  `officedescoffres.creacube.be` au lieu du domaine de l'administration (un domaine « admin » dans
  un email de joueur ressemble à de l'hameçonnage). Garde-fou `email-logo.unit.test.js`.

## [2026-10-04] — PR #79 (politique de confidentialité : 1 an, comptes non confirmés)

Étape 5 du brief `admin/content/brief-politique-promesses.md` — pendant de back #45 à #50.

### Changed
- **`/legal/privacy` §5** : compte inactif supprimé après **1 an** sans connexion (au lieu de 2), et
  nouvelle ligne « Compte non confirmé » (30 jours, au plus tôt une semaine après un rappel), FR + EN,
  chaînes validées par Greg. Dernière modification au 04/10/2026. `privacyPromises.unit.test.js`
  fige les chaînes au mot près. Modification substantielle : notifiée par `policy:notify` (back).

## [2026-10-04] — PR #78 (sélecteur de personnage)

### Changed
- **Sélecteur de personnage** (`SelectorCharacter.vue`) : liste dessinée par le site, au motif
  listbox de l'APG W3C, au lieu de la liste native du système, impossible à habiller (étroite,
  grise, sans rapport avec le bouton). Clavier complet, focus visible sur l'option active
  (liseré ≥ 3:1), coche du personnage de la session, étoile du personnage par défaut. 6 tests.
## [2026-10-04] — PR #77 (mandats : postes dans le Profil, « Ma province »)

Pendant frontend de back #44 (déployée le 04/10).

#### « Ma province » et historique

### Added
- **Page « Ma province »** (`/app/province`, 6ᵉ bouton du menu, tour sous bannière, violet
  provisoire) : historique des postes de la province de résidence du personnage actif, export
  forum en BBcode français, dates en année du jeu.
- `modules/playerDates.js` : l'année affichée de chaque champ de date, déclarée en un seul endroit.
- Test jumeau du calendrier du jeu (`tests/common/gameCalendarTwin.unit.test.js`).
- Chronique « demandes de postes municipaux ou comtaux » (`whatsNew.json`, connecté).

### Changed
- **Politique de confidentialité** §5-§6 : l'historique des postes survit à la suppression d'un
  compte (pseudonyme, plus aucun lien vers la personne) et est visible des joueurs de la province.
  Retirés : « aucune anonymisation partielle, aucune archive » (devenu faux) et l'outil
  « calendrier » (inexistant) ; « Personne d'autre en dehors de ce qui précède ».

#### Lot 2 — bloc « Postes » du Profil

### Added
- **Bloc « Postes » dans le Profil** (`components/mandates/`, `stores/mandateStore.js` ;
  `admin/content/brief-mandats.md`, arbitrages `admin/echanges/mandats-lot2/`) : demander un
  poste de maire ou de conseiller comtal, suivre son statut, annuler une demande, renouveler un
  mandat, déclarer son poste au conseil (avertissement en trois temps), historique des postes.
  Aucune règle ni aucun libellé recodé côté frontend : `requestable`, `renewable`, titres, motifs,
  causes et messages d'erreur viennent de l'API, en FR et EN.
- `CityCascadeSelect` sait s'arrêter à la province ; modales au focus piégé et fermées par Échap
  (`use/useDialogFocus.js`).
- **Politique de confidentialité** : les postes déclarés en §3, §4, §5 (conservés tant que le
  compte existe) et §6 (vérification par l'éditeur), FR et EN ; dernière modification au 03/10.
- 16 tests (`tests/mandates/`).

## [2026-10-02] — PR #76

### Security
- **Le fallback SPA ne répond plus 200 à un chemin d'API** (`public/.htaccess`). Tout chemin
  contenant `/api/` reçoit un 404, alors que `/access/api/v1/system/ping` renvoyait `index.html`
  (journaux d'accès du 02/10). L'API vit sur `odc-admin.creacube.be`, jamais sur ce domaine.
  Règle étroite : une page inconnue sans `/api/` sert toujours `index.html`, pour que la vue 404
  s'affiche (front #45). Vérifié sur un Apache jetable avec une copie du `.htaccess` : `/api/`
  en 404, les routes de l'application, une page inconnue et `/legal/cookies` en 200, les
  exclusions `/assets/` et `/.well-known/` intactes. En prod, le 404 garde le corps
  d'`index.html` (`ErrorDocument` du vhost O2Switch, comme les deux autres exclusions) : seul le
  statut change. Gardé par
  `tests/enforcement/htaccess-spa-fallback.unit.test.js` (exclusions, fallback maintenu,
  conditions jamais en `[OR]`).

## [2026-10-01] — PR #75

### Fixed
- **Un écran d'attente pendant les envois à l'API** (`useNavigationLoading.trackApiCall`). La
  connexion envoyait sa requête avant toute navigation : l'écran « Ouverture de l'office… », piloté
  par le routeur seul, n'apparaissait pas, et rien ne bougeait pendant l'attente. Il couvre
  désormais la connexion, du clic à l'arrivée sur `/app/`. Les autres envois (inscription, renvoi
  du lien, ajout de personnage, résidence, suppression de compte, déconnexion) ont le même écran
  avec une autre phrase : « Le greffe traite votre demande… ». La connexion ignore aussi un second
  clic pendant l'attente, chaque tentative comptant pour le limiteur (5/min).

## [2026-10-01] — PR #71

### Fixed
- **Un seul `auth/me` par navigation** : Welcome → `/app/` (via le garde de `/login`) envoyait
  deux `auth/me` et deux préflights, soit ~1,9 s d'allers-retours en prod (mesure du 28/09/2026 ;
  le 01/10, préflights supprimés par back #28, les deux `auth/me` coûtaient encore 0,72 + 1,13 s
  contre 0,37 s pour un seul). Le premier garde qui crée le store doublait l'hydratation de démarrage.
  `checkAuth()` rend désormais la requête déjà en vol aux appels concurrents (même token) ; la
  vérification serveur à chaque garde est conservée. Garde-fou Vitest : deux appels concurrents
  = une seule requête HTTP.

## [2026-10-01] — PR #74

### Security
- **Redirection vers l'adresse unique rétablie, et passée en 301** (`public/.htaccess`). Le
  01/10/2026, le retrait de l'ancienne redirection de sous-domaine dans cPanel a réécrit le
  fichier sur le serveur sans la règle de #73 : les quatre variantes répondaient de nouveau 200,
  dont deux en clair. Un redéploiement à l'identique ne la remettait pas, l'envoi FTP ne
  transférant que les fichiers modifiés. Cette modification renvoie le fichier, cette fois en
  **301** : la règle avait été vérifiée en prod en 302 du 29/09 au 01/10.

## [2026-09-29] — PR #73

### Security
- **Une seule adresse pour le site** (`public/.htaccess`). Les quatre variantes (`http`/`https`,
  avec ou sans `www`) servaient toutes l'application, deux d'entre elles en clair. Elles redirigent
  désormais vers `https://officedescoffres.creacube.be`, chemin et paramètres conservés, en
  **302** le temps de vérifier la règle en prod (301 ensuite). Préalable à la restriction CORS de
  l'API, qui ne peut autoriser qu'une origine. Vérifié à chaque déploiement (`deploy.yml`) et par
  `tests/enforcement/htaccess-canonical-origin.unit.test.js`. Pas de HSTS : décision séparée.

## [2026-09-29] — PR #72

### Fixed
- **Délai d'attente de 20 s sur toute requête d'API** (`src/api.js`). axios n'en pose aucun par
  défaut : une requête que le serveur ne rend jamais laissait un bouton tourner sans fin. Cas réel
  constaté le 29/09/2026 : en prod, la couche d'hébergement retient les réponses 429 du limiteur
  Laravel (les 404/405/401 et une rafale de 401 répondent normalement, seul le 429 reste sans
  réponse). Au-delà du délai, l'appelant affiche son message réseau habituel. Préalable au merge
  de la limitation de débit backend (#29). Garde-fou `tests/common/api.unit.test.js`.
- **Un délai dépassé ne déconnecte plus** (`src/stores/authStore.js`). Seul un refus explicite du
  serveur (400/401 sur `auth/refresh` ou `auth/me`) purge désormais la session ; sans réponse, elle
  est gardée et la requête suivante retente. Sans cette distinction, le délai d'attente aurait
  transformé un incident réseau passager en déconnexion — l'intercepteur 401 et `checkAuth()`
  purgeaient sur n'importe quelle erreur.

## [2026-09-27] — PR #70

### Fixed
- Pages légales (cookies, confidentialité, mentions) : `min-h-screen` retiré, comme sur la 404
  (#67). `App.vue` occupe déjà l'écran et pousse le footer en bas ; la hauteur minimale en double
  ajoutait le footer sous un écran plein. Sans effet visible aujourd'hui (texte plus long qu'un
  écran), mais une page légale courte aurait défilé pour rien.

## [2026-09-27] — PR #69

### Changed
- **`base.css` aligné sur la charte graphique** (`CHARTE-GRAPHIQUE.md` §12, arbitré par Greg) :
  35 variables `--odc-*` sans usage supprimées (bleu primaire, couleurs d'état, espacements,
  z-index), ainsi que le fond et le texte du `body`, recouverts par `style.css`. Focus clavier par
  défaut **à deux tons** (or `#fde68a` + brun `#451a03`) au lieu du bleu : visible sur les cartes
  claires comme sur le fond sombre — l'or seul tombait à 1,2:1 sur fond clair. Sélection de texte
  en or. Référence de contraste inchangée.

## [2026-09-27] — PR #68

### Fixed
- **Vérification d'email bloquée sur « Vérification en cours… »** : sans paramètre dans l'URL
  (lien tronqué, accès direct) ou avec un jeton refusé par le serveur (expiré, révoqué), la page
  attendait indéfiniment — seul `?error` menait à l'écran d'erreur. Tout échec y mène désormais,
  avec le formulaire de renvoi. Deux tests reproduisent les deux cas.

## [2026-09-27] — PR #67

### Changed
- **Boutons `odc-*` sur les pages publiques** :
  - bannière cookies : « Refuser » et « Accepter » au même niveau et dans le même style (CNIL :
    refus aussi visible que l'acceptation ; l'ancien rouge « danger » le présentait comme une
    faute), boutons sur une ligne, titre lisible en thème sombre ;
  - modale cookies : « Annuler » discret, « Enregistrer » vert ;
  - vérification d'email : même structure que la connexion (logo, carte claire, bouton bleu) ;
    « Vérification en cours… » lisible en thème clair (il était blanc sur fond clair) ;
  - 404 : logo à la place du coffre, plus de code « 404 », un seul bouton « Retour à l'Office »
    qui revient à la page précédente du navigateur (accueil en onglet neuf), plus de défilement
    inutile (hauteur minimale en double retirée).
- Icône `fa-sliders-h` sur les boutons « Gérer mes préférences » (NavBar, bannière).
- **Page Profil restructurée** : deux colonnes à partir de laptop (tient sans défilement sur
  ordinateur), email en sous-titre, « Ajouter un personnage » en tête de liste, cartes remises en
  ordre (statut en badge à côté du pseudo, explication dessous, actions groupées), suppression du
  compte repliée dans un dépliant, bouton « Gérer mes préférences » retiré (déjà dans la NavBar).
- Référence de contraste : les deux « 404 » grisés sous le seuil disparaissent (11 → 9).

### Fixed
- `SwitchButton` : `type="button"`, `role="switch"`, `aria-checked`, relié à son libellé, rail
  éteint visible (≥ 3:1).

### Removed
- Clés i18n `NotFound.Code`, `NotFound.BackPrevious`.

## [2026-09-27] — PR #66

### Changed
- **Connexion et inscription restructurées** : une colonne, logo horizontal à la place du titre
  texte, carte claire dans les deux thèmes (elle s'inversait avec le thème, libellés sous 4,5:1).
  Connexion : « Entrez sans compte » en tête mais en bouton de la charte (dégradé orange-rouge
  lisible, au lieu du grand bloc à 2,26:1), alerte « email non vérifié » dans la carte
  (`role="alert"`) au lieu d'une colonne à part, case « Rester connecté » dessinée et alignée,
  « Se connecter » en bleu. Inscription : même carte, « S'enregistrer » en bleu, lien « Vous avez
  déjà un compte ? Connectez-vous » à la place du bouton « Retour ».
- Référence de contraste : **15 défauts corrigés** (26 → 11 sous le seuil) et 4 titres non
  mesurables retirés (16 → 12), aucun ajout — diff relu.

### Added
- Clés i18n `Login.Or`, `Register.HasAccount`, `Register.LoginLink` (FR + EN) ;
  `Register.BackLink` retirée (plus d'usage).

## [2026-09-27] — PR #65

### Changed
- Référence de contraste (`tests/browser/textContrast.baseline.json`) : retrait des deux titres
  en dégradé « Office des coffres » de Welcome (sombre et clair), non mesurables — remplacés par
  le logo en #62. Diff relu : 2 lignes retirées, aucune ajoutée ; 26 textes sous le seuil
  inchangés, 18 → 16 non mesurables. Les nouveaux boutons `odc-*` des pages publiques (thème,
  langue) passent.

## [2026-09-27] — PR #64

### Changed
- **Menu circulaire : variante X3, mix M1 + D2** (brief `admin/content/brief-menu-d2.md`) —
  anneau laiton lumineux et états de D2 (halo de survol, page courante enfoncée et cerclée d'or,
  plaque dorée), biseau fin et icône gravée de M1, plaque ardoise bordée d'ambre, icône recentrée
  optiquement. Couleurs sorties dans `components/navMenuPalette.js` (teintes repos/survol/page
  courante, plaques par état). ADR dans `docs/DECISIONS.md`.

### Added
- Garde-fou `navmenu-plate-contrast` : texte des plaques ≥ 4,5:1 sur chaque arrêt du dégradé.
- Tests `NavMenu` : 5 entrées, Profil masqué hors connexion et visible une fois connecté.

## [2026-09-27] — PR #63

### Docs
- Suite de #58, prévue au merge : `docs/ARCHITECTURE.md` décrit la règle globale de mouvement
  réduit (`base.css`), l'animation finie `bounce-hint` et le budget 3 s / plafond 5 s ;
  `docs/TESTS.md` ajoute le garde-fou `motion` et les tests de survol de `WelcomeView`.

## [2026-09-27] — PR #62

### Added
- **Identité visuelle arrêtée le 27/09/2026** (sources hors dépôt dans `ODC/logo/`, brief
  `admin/content/brief-identite-visuelle.md`) :
  - favicon « écu seul » (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`) ;
  - logo horizontal dans la `NavBar` (écu seul sous `tablet`), visible accueil compris ; logo
    vertical à la place du titre texte de `WelcomeView` ;
  - menu circulaire M1 « relief 3D » dans `NavMenu` (88 px, 72 sur mobile), page courante
    signalée (`aria-current`), libellés en toutes lettres (Économie, Sécurité, Animation) ;
  - boutons `odc-*` (`assets/odc-buttons.css`) en trois niveaux — signature (laiton, menu M1
    seul), standard `--soft`, discret `--quiet` — sur la `NavBar`, les pastilles de la
    chronique, `ProfilView` et les boutons de génération d'Économie et de Sécurité.
- `ProfilView` : badge plat « Personnage actif à la connexion » avec étoile, au lieu d'une
  mention en petites capitales.
- Chronique de l'Office : entrée « L'Office fait peau neuve » (`whatsNew.json`, annoncée sur
  Discord au déploiement).
- Garde-fou `odc-buttons-contrast` : texte ≥ 4,5:1 sur chaque face et chaque niveau, et aucun
  éclaircissement au survol d'un bouton texte.

### Changed
- Veto « `NavMenu` exempté de la charte » levé par Greg (ADR du 27/09 dans `docs/DECISIONS.md`,
  l'ancienne entrée est conservée). Couleurs du menu en variables CSS : **safelist Tailwind
  supprimé**, garde-fou `tailwind-safelist` réécrit pour l'état inverse.
- `.htaccess` : les icônes à nom fixe (favicon, icône iOS) en cache une semaine, au lieu
  d'« immutable » un an via la règle `svg`.

### Removed
- Classes plates `.btn-blue`/`.btn-yellow`/`.btn-rose`/`.btn-teal`/`.btn-slate`/
  `.btn-menu-rounded`, sans consommateur.
- Dossier `static/` : `index.html` pointait vers `/static/favicon.ico`, jamais déployé (seul
  `dist/` part en FTP) — l'URL répondait 404 en prod. Rien à supprimer côté serveur.
## [2026-09-27] — PR #58

### Fixed
- **Mouvement réduit enfin honoré, et fin de la boucle infinie de l'accueil (WCAG 2.2.2, A).**
  L'invite « cliquez » bondissait à l'infini (`animate-bounce`), dès le chargement, et ignorait
  `prefers-reduced-motion` — le cadenas aussi (animation au survol d'oh-vue-icons). La préférence
  n'était qu'annoncée : même un audit « en mouvement réduit » voyait la page bouger, et deux
  captures du même code différaient.
  - L'invite rebondit **3 × 1 s = 3 s** — budget de conception, que le test fait respecter —
    loin du plafond réglementaire de 5 s (2.2.2 vise ce qui dure *plus* de 5 s), nommé à côté
    comme ce qu'on n'approche jamais ; puis **s'arrête en haut du mouvement** ; seulement
    derrière `motion-safe:`.
  - **Règle globale** `@media (prefers-reduced-motion: reduce)` dans `base.css` : animations et
    transitions ramenées à **0,01 ms, une itération** — pas `none`, pour que
    `transitionend`/`animationend` partent toujours. Vérifié : aucune animation en `reduce`, cinq
    captures successives de l'accueil identiques ; bannière cookies, modale de préférences, toast
    et overlay de navigation se retirent tous, avec et sans mouvement réduit.

### Added
- Au survol du cadenas, l'invite **rejoue un rebond plus vif pendant 3 s** (6 × 0,5 s), puis
  s'arrête en haut ; pas de relance en cours de rebond ; rien en mouvement réduit.
- `tests/enforcement/motion.unit.test.js` — animations maison finies, ≤ budget de 3 s et
  strictement sous le plafond de 5 s, aucune animation
  Tailwind infinie (`animate-bounce/spin/ping/pulse`) dans les vues, règle globale de mouvement
  réduit présente. Échoue sur les 3 points avec le code d'origine. Tests du survol dans
  `tests/common/WelcomeView.test.js`.

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
