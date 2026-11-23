<script setup>
  /*
    Carte d'une section d'un bilan de défense (Registre de douane, passe de design du 23/11/2026). Carte INTERNE claire sur la carte de page (charte §6.5) :
    elle reste claire dans les deux thèmes, d'où les couleurs de texte déclarées en `dark:` (piège `.dark p`). Le liseré de gauche porte l'information :
    la teinte reprend celle du badge de la synthèse (bleu habitants, sarcelle entrées et sorties, rose groupes et couleur du module), orange = quelque chose
    à surveiller, ardoise = rien d'inscrit pour cette section.
  */
  defineProps({
    title: { type: String, required: true },
    tone: { type: String, default: 'rose' }, // rose | blue | teal | violet | alert | muted
    testid: { type: String, default: '' },
  })
</script>

<template>
  <section
    class="rounded-xl border border-l-4 p-4 shadow-sm"
    :class="{
      'border-rose-200 border-l-rose-500 bg-rose-50': tone === 'rose',
      'border-blue-200 border-l-blue-500 bg-blue-50': tone === 'blue',
      'border-teal-200 border-l-teal-500 bg-teal-50': tone === 'teal',
      'border-violet-200 border-l-violet-500 bg-violet-50': tone === 'violet',
      'border-orange-300 border-l-orange-500 bg-orange-50': tone === 'alert',
      'border-slate-200 border-l-slate-300 bg-white': tone === 'muted',
    }"
    :data-tone="tone"
    :data-testid="testid || undefined"
  >
    <h3 class="!mb-2 !mr-0 flex flex-wrap items-center gap-x-2 text-base font-bold" :class="tone === 'muted' ? 'text-slate-600 dark:text-slate-600' : 'text-slate-800 dark:text-slate-800'">
      {{ title }}
    </h3>
    <slot />
  </section>
</template>
