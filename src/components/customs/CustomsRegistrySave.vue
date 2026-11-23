<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import HelpModal from '@/components/HelpModal.vue'

  /*
    Plaque d'inscription au Registre de douane — MÊME CONCEPTION que la plaque du Bilan des mines (MineRegistrySave, Greg, 23/11/2026) :
    l'inscription n'est jamais automatique, c'est un acte explicite ; la plaque dit la VILLE et le JOUR avant l'envoi, aide « i » en coin, puis le
    parchemin scellé une fois fait. Au VERT du bouton « Confier au scribe » (Greg, 23/11/2026). Aucune règle ici : droits, villes et jours
    viennent de `customs-access` ; le parent envoie, la plaque ne fait que dire et demander.
  */
  const props = defineProps({
    cityName: { type: String, required: true },
    dayLabel: { type: String, required: true },
    saving: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }, // rien à inscrire (ou pas de droit) : le bouton est inactif
    sealed: { type: Object, default: null }, // { city, date } une fois inscrit
  })
  defineEmits(['save'])

  const { t } = useI18n()
  const showHelp = ref(false)
  const helpSteps = computed(() => [1, 2, 3, 4].map(n => t(`SecurityCustoms.Registry.HelpStep${n}`)))
  const busy = computed(() => props.saving)
</script>

<template>
  <!-- Horizontale, à droite du bouton « Confier au scribe » (Greg, 23/11/2026) : icône, ville et jour dits AVANT l'envoi, bouton, aide « i ». -->
  <section class="registry-plate relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl px-3 py-1.5" aria-labelledby="customs-registry-title" data-testid="guet-save-box">
    <span class="odc-dot odc-dot--md odc--green shrink-0" aria-hidden="true">
      <v-icon name="gi-scroll-unfurled" />
    </span>
    <div class="min-w-0 text-left leading-tight" data-testid="guet-save-target">
      <h3 id="customs-registry-title" class="!m-0">
        <span class="plate-kicker block text-xs font-normal">{{ t('SecurityCustoms.Registry.Title') }}</span>{{ ' ' }}
        <span class="plate-title block break-words text-base font-bold">{{ cityName }}</span>
      </h3>
      <p class="plate-note !m-0 text-xs italic">{{ t('SecurityCustoms.Registry.ReportOf', { date: dayLabel }) }}</p>
    </div>

    <button type="button" class="odc-btn odc-btn--soft odc--green" :disabled="busy || disabled" :aria-busy="busy" data-testid="guet-save" @click="$emit('save')">
      <v-icon :name="busy ? 'gi-tied-scroll' : 'gi-quill'" aria-hidden="true" />
      {{ busy ? t('SecurityCustoms.Registry.Sealing') : t('SecurityCustoms.Registry.Save') }}
    </button>

    <!-- Résultat : le parchemin noué se pose, la coche confirme. Annonce unique (role=status) ; le toast reste. -->
    <div v-if="sealed" class="flex items-center gap-2 text-left" role="status" data-testid="guet-sealed">
      <v-icon name="gi-tied-scroll" scale="1.6" class="sealed-in plate-kicker" aria-hidden="true" />
      <p class="plate-title !m-0 text-sm">
        <span class="block font-bold">{{ t('SecurityCustoms.Registry.Sealed') }}</span>
        <span class="plate-note block text-xs">{{ t('SecurityCustoms.Registry.Saved', { date: sealed.date, city: sealed.city }) }}</span>
      </p>
      <v-icon name="fa-check-circle" class="sealed-tick" aria-hidden="true" />
    </div>

    <button type="button" class="plate-help" :aria-label="t('SecurityCustoms.Registry.HelpButton')"
            :title="t('SecurityCustoms.Registry.HelpButton')" data-testid="guet-save-help" @click="showHelp = true">
      <v-icon name="fa-info-circle" scale="0.9" />
    </button>

  </section>
  <HelpModal
    :show="showHelp"
    :title="t('SecurityCustoms.Registry.HelpTitle')"
    :purpose="t('SecurityCustoms.Registry.HelpPurpose')"
    :overview="t('SecurityCustoms.Registry.HelpOverview')"
    :steps="helpSteps"
    @close="showHelp = false"
  />
</template>

<style scoped>
  /* Plaque verte, comme le bouton « Confier au scribe » qui la précède. */
  .registry-plate {
    background: linear-gradient(160deg, #14532d 0%, #052e16 100%);
    border: 1px solid #86efac;
    box-shadow: inset 0 1px 0 rgb(187 247 208 / 0.2), 0 6px 16px -8px rgb(5 46 22 / 0.6);
  }
  .plate-kicker { color: #bbf7d0; }
  .plate-title { color: #f0fdf4; }
  .plate-note { color: #dcfce7; }
  .sealed-in { animation: sealed-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 1 both; }
  .sealed-tick { color: #86efac; animation: sealed-tick 0.3s ease 0.5s 1 both; }
  @keyframes sealed-in { from { transform: scale(1.6) rotate(-10deg); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes sealed-tick { from { opacity: 0; } to { opacity: 1; } }
  .plate-help { color: #fde047; line-height: 0; }
  .plate-help:hover { color: #fef08a; }
</style>
