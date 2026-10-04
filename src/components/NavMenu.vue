<script setup>
/*
  imports
*/
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore } from '@/stores/authStore'
  import { PALETTE, PLATES } from '@/components/navMenuPalette'

/*
  User data
*/
  const authUser = useAuthStore()
  const { t } = useI18n()

/*
  Couleurs du menu (variante X3, navMenuPalette.js) passées en variables CSS, et non en classes
  construites : le JIT Tailwind ne verrait pas `btn-${color}`. Plus aucune classe dynamique ici —
  ne pas en réintroduire (voir tests/enforcement/tailwind-safelist.unit.test.js).
  --c1…--c3 : disque au repos · --h1…--h3 : survol · --k1…--k3 : page courante · --icon.
*/
  const paletteVars = (color) => {
    const { rest: [c1, c2, c3], hover: [h1, h2, h3], current: [k1, k2, k3], icon } = PALETTE[color]
    return {
      '--c1': c1, '--c2': c2, '--c3': c3,
      '--h1': h1, '--h2': h2, '--h3': h3,
      '--k1': k1, '--k2': k2, '--k3': k3,
      '--icon': icon,
    }
  }

  const gradient = (stops) => `linear-gradient(180deg, ${stops.join(', ')})`
  const plateVars = Object.fromEntries(Object.entries(PLATES).flatMap(([state, { stops, border, text }]) => [
    [`--plate-${state}-bg`, gradient(stops)],
    [`--plate-${state}-bd`, border],
    [`--plate-${state}-fg`, text],
  ]))

/*
  Menu items
  `exact` : « /app/ » est le préfixe de toutes les pages de l'application — sans correspondance
  exacte, Accueil serait marqué « page courante » partout.
*/
  const pages = computed(() => [
    { name: t('NavMenu.Home'), link: "/app/", icon:"gi-medieval-pavilion", color: "blue", status: "public", exact: true },
    { name: t('NavMenu.Economy'), link: "/app/eco", icon:"gi-crown-coin", color: "yellow", status: "public"},
    { name: t('NavMenu.Security'), link: "/app/secu/guet", icon:"gi-swords-emblem", color: "rose", status: "public"},
    { name: t('NavMenu.Animation'), link: "/app/anim", icon:"gi-rolling-dice-cup", color: "teal", status: "public"},
    { name: t('NavMenu.Province'), link: "/app/province", icon: "gi-tower-flag", color: "violet", status: "private" },
    { name: t('NavMenu.Profile'), link: "/app/profil", icon:"gi-barbute", color: "slate", status: "private"},
  ])
</script>

<template>
  <nav class="flex flex-wrap justify-center gap-x-4 gap-y-3 laptop:gap-x-10" :style="plateVars">
    <RouterLink
      v-for="(page, index) in pages"
      :key="index"
      v-show="page.status === 'public' || (page.status === 'private' && authUser.isLoggedIn)"
      :to="page.link"
      custom
      v-slot="{ href, navigate, isActive, isExactActive }"
    >
      <a
        :href="href"
        class="menu-btn"
        :class="{ 'menu-btn--current': page.exact ? isExactActive : isActive }"
        :aria-current="(page.exact ? isExactActive : isActive) ? 'page' : undefined"
        :style="paletteVars(page.color)"
        @click="navigate"
      >
        <span class="menu-ring" aria-hidden="true">
          <span class="menu-disc">
            <v-icon :name="page.icon" />
          </span>
        </span>
        <span class="menu-plate">{{ page.name }}</span>
      </a>
    </RouterLink>
  </nav>
</template>

<style scoped>
/*
  Menu circulaire — variante X3 « équilibre » M1 + D2 (Greg, 27/09/2026 ; comparaison hors dépôt
  dans logo/menu-circulaire/mix/). De D2 : l'anneau laiton lumineux, le disque plein, les états
  (halo de survol, page courante enfoncée et cerclée d'or, plaque dorée). De M1 : le biseau fin
  (bordure du disque, pas une couche de plus) et l'icône gravée. Plaque ardoise de M1, bord ambre.
  Sans tranche bronze ni liseré foncé extérieur (retouches de Greg).
  5 éléments sous le lien : anneau, disque, reflet (::before), icône, plaque.
  Toutes les cotes sont en --u = 1 px de la référence D2 (116 px), sauf les bords de 2 px.
*/
.menu-btn {
  --s: 72px;                               /* mobile : 5 boutons en flex-wrap, cible ≫ 44 px */
  --u: calc(var(--s) / 116);
  --lift: 0px;
  --d1: var(--c1); --d2: var(--c2); --d3: var(--c3); --dy: 28%; --shine: .5;
  --ring-bg: linear-gradient(160deg, #fef3c7 0%, #fbbf24 22%, #b45309 55%, #78350f 80%, #f59e0b 100%);
  --glow: 0 0 0 0 transparent;
  --plate-bg: var(--plate-rest-bg); --plate-bd: var(--plate-rest-bd); --plate-fg: var(--plate-rest-fg);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: calc(var(--u) * 128);
  text-decoration: none;
  border-radius: 9999px;
  -webkit-tap-highlight-color: transparent;
}
@media (min-width: 640px) {
  .menu-btn { --s: 88px; }
}

.menu-ring {
  position: relative;
  width: var(--s);
  height: var(--s);
  border-radius: 50%;
  padding: calc(var(--u) * 7);
  background: var(--ring-bg);
  box-shadow: 0 calc(var(--u) * 9) calc(var(--u) * 14) rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.7), inset 0 -2px 0 rgba(0,0,0,.35), var(--glow);
  transform: translateY(var(--lift));
  transition: transform .15s ease, box-shadow .15s ease;
}

/* Disque + biseau fin de M1 : bordure transparente sur laquelle se peint le dégradé du biseau. */
.menu-disc {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: calc(var(--u) * 3) solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% var(--dy), var(--d1) 0%, var(--d2) 55%, var(--d3) 100%) padding-box,
    linear-gradient(180deg, #78350f 0%, #b45309 45%, #fde68a 100%) border-box;
  box-shadow: 0 0 0 1.5px #451a03, inset 0 calc(var(--u) * -9) calc(var(--u) * 14) rgba(0,0,0,.45), inset 0 3px 0 rgba(255,255,255,.3);
}
.menu-disc::before {
  content: "";
  position: absolute;
  top: 7%;
  left: 20%;
  width: 60%;
  height: 34%;
  border-radius: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,var(--shine)), rgba(255,255,255,0));
}
/* Icône gravée (M1) : arête claire au-dessus, ombre dessous. Géométriquement centrée, elle
   paraissait basse — l'ombre ajoute de la masse sous l'icône et le reflet éclaire le haut du
   disque. Remontée optique de 3 unités (Greg, 27/09/2026). */
.menu-disc > svg {
  position: relative;
  width: calc(var(--u) * 56);
  height: calc(var(--u) * 56);
  color: var(--icon);
  transform: translateY(calc(var(--u) * -3));
  filter: drop-shadow(0 -1px 0 rgba(255,255,255,.5)) drop-shadow(0 3px 0 rgba(0,0,0,.5)) drop-shadow(0 5px 4px rgba(0,0,0,.35));
}

/* Plaque du nom : couleurs par état dans navMenuPalette.js (PLATES), contraste gardé par test. */
.menu-plate {
  margin-top: calc(var(--u) * -14);
  position: relative;
  padding: 3px 10px 4px;
  border-radius: 7px;
  background: var(--plate-bg);
  border: 2px solid var(--plate-bd);
  box-shadow: 0 3px 6px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.15);
  color: var(--plate-fg);
  font-weight: 800;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: .3px;
  white-space: nowrap;
}

/* ---------- États ---------- */

/* Survol et focus clavier : l'anneau s'éclaire, halo doré, le bouton monte, disque d'un cran plus
   clair (teintes `hover` de la palette — pas de filter: brightness, qui éclaircirait aussi
   l'anneau et la plaque). */
.menu-btn:hover,
.menu-btn:focus-visible {
  --lift: calc(var(--u) * -3);
  --d1: var(--h1); --d2: var(--h2); --d3: var(--h3); --shine: .6;
  --ring-bg: linear-gradient(160deg, #fff 0%, #fde68a 22%, #d97706 55%, #92400e 80%, #fbbf24 100%);
  --glow: 0 0 0 3px rgba(251,191,36,.45), 0 0 26px rgba(251,146,60,.75);
  --plate-bg: var(--plate-hover-bg); --plate-bd: var(--plate-hover-bd); --plate-fg: var(--plate-hover-fg);
}

/* Page courante : enfoncée, cerclée d'or, disque plus sombre et sans reflet, plaque dorée. */
.menu-btn--current,
.menu-btn--current:hover,
.menu-btn--current:focus-visible {
  --lift: calc(var(--u) * 3);
  --d1: var(--k1); --d2: var(--k2); --d3: var(--k3); --dy: 36%; --shine: 0;
  --plate-bg: var(--plate-current-bg); --plate-bd: var(--plate-current-bd); --plate-fg: var(--plate-current-fg);
}
.menu-btn--current .menu-ring {
  box-shadow: 0 0 0 4px #fbbf24, 0 4px 8px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.7), var(--glow);
}
.menu-btn--current .menu-disc {
  box-shadow: 0 0 0 1.5px #451a03, inset 0 calc(var(--u) * 8) calc(var(--u) * 14) rgba(0,0,0,.5);
}

.menu-btn[aria-disabled="true"] {
  filter: grayscale(1);
  opacity: .45;
  pointer-events: none;
}

.menu-btn:focus-visible { outline: none; }
.menu-btn:focus-visible .menu-ring { outline: 3px solid #fde68a; outline-offset: 5px; }

/* Mouvement réduit : pas de translation au survol (le halo suffit). L'enfoncement de la page
   courante reste : c'est un état fixe, pas un mouvement. Durées neutralisées globalement
   (base.css, #58). */
@media (prefers-reduced-motion: reduce) {
  .menu-btn:hover,
  .menu-btn:focus-visible { --lift: 0px; }
  .menu-btn--current:hover,
  .menu-btn--current:focus-visible { --lift: calc(var(--u) * 3); }
  .menu-ring { transition: none; }
}
</style>
