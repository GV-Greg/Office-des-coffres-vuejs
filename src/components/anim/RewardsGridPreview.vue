<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  /*
    L'aperçu de la grille pendant sa création : le plateau se redessine à mesure que l'organisateur change la largeur et la hauteur, avec le même
    dessin que le vrai (des sceaux ardoise numérotés) et le nombre de lots à inscrire. Décoratif : le décompte est lu par les lecteurs d'écran.
    `bare` : sans cadre ni titre (le parent les porte). ⚠️ Aucune borne ici (elles sont au serveur) ; le seul garde est technique : au-delà de 30 × 30, on ne dessine plus la mosaïque, seulement le décompte.
  */
  const props = defineProps({
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bare: { type: Boolean, default: false },
  })
  const { t } = useI18n()

  const DRAW_LIMIT = 30
  const valid = computed(() => Number.isInteger(props.width) && Number.isInteger(props.height) && props.width >= 1 && props.height >= 1)
  const count = computed(() => (valid.value ? props.width * props.height : 0))
  const drawable = computed(() => valid.value && props.width <= DRAW_LIMIT && props.height <= DRAW_LIMIT)
  const cells = computed(() => (drawable.value ? Array.from({ length: count.value }, (_, i) => i + 1) : []))
  // Un numéro n'a la place de s'écrire que sur de grosses cases.
  const numbered = computed(() => props.width <= 12)
</script>

<template>
  <section :class="bare ? '' : 'rounded-xl border border-slate-300 bg-white p-4'" data-testid="create-preview">
    <h3 v-if="!bare" class="!mt-0 mb-3 text-base font-bold text-slate-800 dark:text-slate-800">{{ t('Animation.Rewards.Create.PreviewTitle') }}</h3>

    <div v-if="drawable" class="mx-auto w-full max-w-[15rem]" aria-hidden="true">
      <div class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }" data-testid="preview-cells">
        <span
          v-for="n in cells"
          :key="n"
          class="flex aspect-square items-center justify-center rounded border border-slate-600 bg-slate-800 font-mono font-bold leading-none text-slate-200"
          :class="numbered ? 'text-[10px]' : 'text-[0px]'"
        >{{ n }}</span>
      </div>
    </div>

    <p class="!mb-0 mt-2 text-sm text-slate-700 dark:text-slate-700" data-testid="preview-caption" role="status">
      <template v-if="valid">{{ t('Animation.Rewards.Create.PreviewCaption', { count }, count) }}</template>
      <template v-else>{{ t('Animation.Rewards.Create.PreviewInvalid') }}</template>
    </p>
  </section>
</template>
