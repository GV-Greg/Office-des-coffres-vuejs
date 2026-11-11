/*
  Les types d'activité du module Animation, déclarés UNE fois : tout ce qui distingue « Décode le code » de « Grille des lots »
  dans les écrans qu'ils partagent (entrée, création, retrouver, réinitialiser, confirmer l'email). Ajouter un type d'activité = une
  entrée ici (voir admin/strategies/animation.md), pas une copie des vues.

    - `api`    : noms des routes (`anim/{key}-manage`, `anim/{key}-slug`, collection privée) et clés de la réponse JSON.
    - `ns`     : espace de textes propre au type. Une clé absente de `Animation.{ns}` retombe sur `Animation.*` (textes communs de
                 Décode) : un type ne redéfinit que ce qu'il dit autrement. Voir `use/useAnimKind.js`.
    - `routes` : noms de routes du type (create, manage, mine, public).
    - `autoClose` : l'écran peut-il promettre la clôture automatique après 30 jours sans action ?
    (L'encadré sombre propre à chaque type vit dans `components/anim/animHeroes.js` : ce fichier ne dépend d'aucun composant.)
*/
export const ANIM_KINDS = {
  decode: {
    key: 'decode',
    api: { collection: 'decode-activities', item: 'activity', items: 'activities' },
    slugKey: 'anim_decode_slug',
    statusNs: 'Animation.Status',
    ns: 'Animation',
    typeName: 'Animation.Types.decode.Name',
    routes: { create: 'animation-create', manage: 'animation-manage', mine: 'animation-mine', public: 'animation-public' },
    publicPath: slug => `/public/activite/decode/${slug}`,
    autoClose: true, // 30 jours sans action : la clôture automatique est planifiée côté serveur (anim:close-inactive)
    titleClass: 'text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600',
    icons: { manage: 'gi-entry-door', create: 'gi-open-gate' },
  },
  rewards: {
    key: 'rewards',
    api: { collection: 'rewards-grids', item: 'grid', items: 'grids' },
    slugKey: 'anim_rewards_slug',
    statusNs: 'Animation.GridStatus',
    ns: 'Animation.Rewards',
    typeName: 'Animation.Types.rewards.Name',
    routes: { create: 'animation-rewards-create', manage: 'animation-rewards-manage', mine: 'animation-rewards-mine', public: 'animation-rewards-public' },
    publicPath: slug => `/public/activite/grille/${slug}`,
    autoClose: false, // ⚠️ anim:close-inactive ne couvre pas encore les grilles : ne rien promettre à l'écran (voir le rapport du 10/11)
    titleClass: 'text-transparent bg-clip-text bg-gradient-to-br from-teal-700 to-green-600',
    icons: { manage: 'gi-entry-door', create: 'gi-open-gate' },
  },
}

export const animKind = key => ANIM_KINDS[key]
