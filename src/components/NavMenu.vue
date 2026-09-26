<script setup>
/*
  imports
*/
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAuthStore } from '@/stores/authStore'

/*
  User data
*/
  const authUser = useAuthStore()
  const { t } = useI18n()

/*
  Couleurs du menu M1 (identité visuelle du 27/09/2026, logo/menu-circulaire/ hors dépôt).
  Passées en variables CSS depuis cette table, et non plus en classes construites
  (`btn-${color}`, `text-${color}-100`) : le JIT Tailwind ne voyait pas ces classes, d'où le
  safelist et son garde-fou. Plus aucune classe dynamique ici — ne pas en réintroduire (voir
  tests/enforcement/tailwind-safelist.unit.test.js).
  disc : dégradé du disque, clair → foncé · icon : teinte `<couleur>-100` de l'icône.
*/
  const PALETTE = {
    blue: { disc: ['#93c5fd', '#2563eb', '#1e3a8a'], icon: '#dbeafe' },
    yellow: { disc: ['#fde68a', '#d97706', '#78350f'], icon: '#fef9c3' },
    rose: { disc: ['#fda4af', '#e11d48', '#881337'], icon: '#ffe4e6' },
    teal: { disc: ['#99f6e4', '#0d9488', '#134e4a'], icon: '#ccfbf1' },
    slate: { disc: ['#cbd5e1', '#475569', '#1e293b'], icon: '#f1f5f9' },
  }

  const paletteVars = (color) => {
    const { disc: [c1, c2, c3], icon } = PALETTE[color]
    return { '--c1': c1, '--c2': c2, '--c3': c3, '--icon': icon }
  }

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
    { name: t('NavMenu.Profile'), link: "/app/profil", icon:"gi-barbute", color: "slate", status: "private"},
  ])
</script>

<template>
  <nav class="flex flex-wrap justify-center gap-x-4 gap-y-3 laptop:gap-x-10">
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
        class="m1"
        :class="{ 'm1--current': page.exact ? isExactActive : isActive }"
        :aria-current="(page.exact ? isExactActive : isActive) ? 'page' : undefined"
        :style="paletteVars(page.color)"
        @click="navigate"
      >
        <span class="m1-body" aria-hidden="true">
          <span class="m1-ground" />
          <span class="m1-ring" />
          <span class="m1-bevel" />
          <span class="m1-disc">
            <span class="m1-shine" />
            <span class="m1-bounce" />
            <v-icon :name="page.icon" />
          </span>
        </span>
        <span class="m1-plate">{{ page.name }}</span>
      </a>
    </RouterLink>
  </nav>
</template>

<style scoped>
/*
  Menu circulaire M1 « relief 3D » — reproduit logo/menu-circulaire/menu-m1-reference.html
  (hors dépôt), construit de l'arrière vers l'avant : ombre au sol, anneau laiton,
  biseau, disque de couleur enfoncé, reflets, icône en relief, plaque du nom.
  Toutes les cotes de la référence (bouton de 124 px) sont exprimées en fraction de --s, pour
  réduire le bouton sur mobile sans redessiner quoi que ce soit.
*/
.m1 {
  /* 124 px dans la référence : jugé trop gros à l'écran par Greg le 27/09/2026. 88 px reste
     proche de l'ancien menu (80 px), relief compris. Mobile : 5 boutons en flex-wrap, cible ≫ 44 px. */
  --s: 72px;
  --u: calc(var(--s) / 124);               /* 1 px de la référence */
  --lift: 0px;
  --glow: 0 0 0 0 transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: calc(var(--u) * 132);
  text-decoration: none;
  border-radius: 9999px;
  -webkit-tap-highlight-color: transparent;
}
@media (min-width: 640px) {
  .m1 { --s: 88px; }
}

.m1-body {
  position: relative;
  width: var(--s);
  height: calc(var(--u) * 140);
  transform: translateY(var(--lift));
  transition: transform .12s ease;
}
.m1-body > span { position: absolute; border-radius: 50%; }

.m1-ground {
  left: calc(var(--u) * 8);
  top: calc(var(--u) * 116);
  width: calc(var(--u) * 108);
  height: calc(var(--u) * 14);
  background: radial-gradient(closest-side, rgba(0,0,0,.55), rgba(0,0,0,0));
  /* l'ombre reste au sol quand le bouton monte ou s'enfonce */
  transform: translateY(calc(var(--lift) * -1));
  transition: transform .12s ease;
}
/* Pas de tranche bronze sous l'anneau (couche 2 de la référence) : retirée à la demande de Greg
   le 27/09/2026 — le halo de survol l'éclaircissait en une bande orange qui alourdissait le
   menu. Le relief tient à l'anneau, au biseau et à l'ombre au sol. */
.m1-ring {
  left: 0;
  top: 0;
  width: var(--s);
  height: var(--s);
  background: conic-gradient(from 210deg, #fff7d6, #fbbf24 12%, #b45309 26%, #78350f 38%, #d97706 50%, #fde68a 62%, #fbbf24 72%, #92400e 86%, #fff7d6);
  /* Sans le liseré foncé extérieur (#451a03, 2 px) de la référence : retiré par Greg le 27/09. */
  box-shadow: inset 0 3px 2px rgba(255,255,255,.75), inset 0 -4px 5px rgba(0,0,0,.5), var(--glow);
  transition: box-shadow .12s ease;
}
.m1-bevel {
  left: calc(var(--u) * 9);
  top: calc(var(--u) * 9);
  width: calc(var(--u) * 106);
  height: calc(var(--u) * 106);
  background: linear-gradient(180deg, #78350f 0%, #b45309 45%, #fde68a 100%);
  box-shadow: 0 0 0 1.5px #451a03;
}
.m1-disc {
  left: calc(var(--u) * 14);
  top: calc(var(--u) * 14);
  width: calc(var(--u) * 96);
  height: calc(var(--u) * 96);
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 30%, var(--c1) 0%, var(--c2) 55%, var(--c3) 100%);
  box-shadow: inset 0 calc(var(--u) * 7) calc(var(--u) * 12) rgba(0,0,0,.6), inset 0 calc(var(--u) * -4) calc(var(--u) * 8) rgba(255,255,255,.22);
}
.m1-shine,
.m1-bounce { position: absolute; border-radius: 50%; }
.m1-shine {
  left: 16.67%;
  top: 7.3%;
  width: 66.67%;
  height: 31.25%;
  background: linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,0));
}
.m1-bounce {
  left: 22.92%;
  bottom: 6.25%;
  width: 54.17%;
  height: 10.42%;
  background: radial-gradient(closest-side, rgba(255,255,255,.35), rgba(255,255,255,0));
}
/* icône gravée : arête claire au-dessus, ombre dessous */
.m1-disc > svg {
  position: relative;
  width: 60.4%;
  height: 60.4%;
  color: var(--icon);
  filter: drop-shadow(0 -1px 0 rgba(255,255,255,.5)) drop-shadow(0 3px 0 rgba(0,0,0,.5)) drop-shadow(0 5px 4px rgba(0,0,0,.35));
}

/* Plaque du nom : texte crème #fef3c7, au-dessus de 4,5:1 sur chaque arrêt du fond. */
.m1-plate {
  margin-top: calc(var(--u) * -18);
  position: relative;
  padding: 3px 10px 4px;
  border-radius: 7px;
  /* Fond de la page (gray-800), éclairci vers le haut (gray-600) — Greg, 27/09/2026, au lieu
     du quasi-noir de la référence. Crème sur gray-600, l'arrêt le plus clair : ≈ 7,2:1. */
  background: linear-gradient(180deg, #4b5563 0%, #374151 55%, #1f2937 100%);
  border: 2px solid #fbbf24;
  box-shadow: 0 4px 0 #78350f, 0 7px 8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.25);
  color: #fef3c7;
  font-weight: 800;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  text-shadow: 0 1px 0 #000;
}

/* ---------- États ---------- */

/* Survol : le bouton monte, halo doré. */
.m1:hover {
  --lift: -3px;
  --glow: 0 0 0 4px rgba(251,191,36,.35), 0 0 18px rgba(251,146,60,.6);
}

/* Page courante : anneau doré, bouton enfoncé, plaque dorée. Le texte passe en sombre sur
   l'or (#1c1917 sur #fbbf24 ≈ 10:1) : le crème de la plaque normale n'y serait plus lisible. */
.m1--current {
  --lift: 4px;
  --glow: 0 0 0 3px #fde68a, 0 0 14px rgba(251,191,36,.7);
}
.m1--current:hover { --lift: 4px; }
.m1--current .m1-plate {
  background: linear-gradient(180deg, #fde68a 0%, #fbbf24 55%, #d97706 100%);
  border-color: #fef3c7;
  color: #1c1917;
  text-shadow: 0 1px 0 rgba(255,255,255,.4);
}

.m1:focus-visible { outline: none; }
.m1:focus-visible .m1-ring { outline: 3px solid #fde68a; outline-offset: 5px; }

/* Mouvement réduit : pas de translation au survol (le halo suffit à signaler la cible).
   L'enfoncement de la page courante reste : c'est un état fixe, pas un mouvement. Les durées
   de transition sont par ailleurs neutralisées globalement (base.css, forme de la PR #58). */
@media (prefers-reduced-motion: reduce) {
  .m1:hover { --lift: 0px; }
  .m1--current:hover { --lift: 4px; }
  .m1-body, .m1-ground, .m1-ring { transition: none; }
}
</style>
