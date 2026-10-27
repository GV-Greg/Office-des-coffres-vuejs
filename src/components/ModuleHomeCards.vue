<script setup>
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  /*
    Page d'accueil d'un MODULE (Animation d'abord, puis Économie, Sécurité…) : une carte par page du module, avec son nom et un descriptif.
    Le menu à gauche du module ne porte que les liens de ces mêmes pages. Composant GÉNÉRIQUE : le texte, l'icône et le lien viennent de
    l'appelant (aucun texte en dur ici), la couleur suit celle du module (charte §3.3).
      items : [{ key, title, description, to, icon?, action? }]
              `to` est un objet de route ; `icon` une icône game-icons (`gi-*`) ; `action` le libellé du lien (défaut « Découvrir »)
      slot  : `visual-<key>` — un visuel PROPRE à l'activité, sous le descriptif (décoratif : l'appelant le met en aria-hidden)

    Carte COMPACTE, pensée pour une dizaine d'activités : trois colonnes sur grand écran, deux sur tablette. L'icône vit dans le
    bouton (« Ouvrir le coffre »), le visuel propre à l'activité s'intègre à la ligne du titre, le descriptif est court, le filet de
    couleur du module ferme le haut. L'ombre se creuse au survol (la surface ne s'éclaircit jamais : elle porte du texte), le léger soulèvement ne joue
    qu'hors mouvement réduit. Contrastes : pastille 700 + icône blanche (≥ 3:1), texte slate-800 / slate-700 sur fond clair (≥ 4,5:1).
  */
  const props = defineProps({
    items: { type: Array, required: true },
    accent: { type: String, default: 'teal', validator: v => ['teal', 'gold', 'rose', 'violet', 'slate'].includes(v) },
    testid: { type: String, default: 'module-cards' },
  })

  const { t } = useI18n()

  // Les teintes 700 du module : assez sombres pour porter une icône blanche (≥ 3:1) et servir de filet.
  const ACCENTS = { teal: '#0f766e', gold: '#a16207', rose: '#be123c', violet: '#6d28d9', slate: '#334155' }
  const color = computed(() => ACCENTS[props.accent])
</script>

<template>
  <ul class="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3 list-none p-0 m-0" :data-testid="testid">
    <li v-for="item in items" :key="item.key">
      <article
        class="relative h-full flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-4 pt-5 shadow-sm motion-safe:transition-all motion-safe:duration-200 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
        :data-testid="`card-${item.key}`"
      >
        <span class="absolute inset-x-0 top-0 h-1" :style="{ background: color }" aria-hidden="true" :data-testid="`card-bar-${item.key}`"></span>
        <div class="flex items-center gap-3">
          <div v-if="$slots[`visual-${item.key}`]" class="shrink-0" :data-testid="`card-visual-${item.key}`">
            <slot :name="`visual-${item.key}`" :item="item" />
          </div>
          <h3 class="!m-0 min-w-0 text-lg font-extrabold leading-tight text-slate-800 dark:text-slate-800">{{ item.title }}</h3>
        </div>
        <p class="mt-3 flex-1 text-xs leading-relaxed text-justify hyphens-auto text-slate-700 dark:text-slate-700">{{ item.description }}</p>
        <RouterLink :to="item.to" class="mt-4 self-center odc-btn odc-btn--soft odc-btn--sm" :class="`odc--${accent}`" :data-testid="`card-link-${item.key}`">
          <v-icon v-if="item.icon" :name="item.icon" aria-hidden="true" :data-testid="`card-icon-${item.key}`" />{{ item.action ?? t('Common.Discover') }}
        </RouterLink>
      </article>
    </li>
  </ul>
</template>
