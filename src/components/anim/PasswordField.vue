<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { passwordStrength, MIN_PASSWORD_LENGTH } from '@/modules/passwordStrength'

  /*
    Mot de passe d'un organisateur sans compte (Décode le code, D10, D28) : saisie, ressaisie OBLIGATOIRE (sans récupération
    autonome, une faute de frappe coûte l'activité), bouton « afficher », et barre de force INDICATIVE à 4 niveaux. ⚠️ La barre
    n'interdit rien et ne porte aucune règle de sécurité : le serveur impose 10 caractères et « ni le slug ni le pseudo ». Le
    mot de passe ne quitte ce composant que par `v-model` : jamais mémorisé, jamais placé dans une adresse (D4).
  */
  const props = defineProps({
    modelValue: { type: String, default: '' },
    confirmation: { type: String, default: '' },
    slug: { type: String, default: '' },
    pseudo: { type: String, default: '' },
    error: { type: String, default: '' }, // refus du serveur, dans la langue de l'interface
    idPrefix: { type: String, default: 'pw' },
  })
  const emit = defineEmits(['update:modelValue', 'update:confirmation'])

  const { t } = useI18n()
  const shown = ref(false)

  const strength = computed(() => passwordStrength(props.modelValue, { slug: props.slug, pseudo: props.pseudo }))
  const mismatch = computed(() => props.confirmation !== '' && props.confirmation !== props.modelValue)
  // Quatre segments, remplis jusqu'au niveau atteint (le niveau 0 n'en remplit aucun) ; la couleur ne porte JAMAIS seule le sens :
  // le niveau est aussi écrit en toutes lettres, et annoncé (role="status").
  const COLORS = ['#b91c1c', '#c2410c', '#4d7c0f', '#15803d'] // rouge · orange · vert olive · vert : la progression se lit d'un coup d'œil
  // Le conseil sous le niveau : tant que le mot de passe n'est pas solide, on dit quoi faire (jamais une règle : le serveur juge).
  const tip = computed(() => {
    if (!props.modelValue) return ''
    const { level, reasons } = strength.value
    if (reasons.includes('too_short')) {
      const missing = MIN_PASSWORD_LENGTH - props.modelValue.length
      return t('Animation.Password.TipShort', { n: missing }, missing)
    }
    if (reasons.includes('same_as_slug') || reasons.includes('same_as_pseudo')) return t('Animation.Password.TipSame')
    return level < 3 ? t('Animation.Password.Tip') : ''
  })
  const filled = computed(() => (props.modelValue ? strength.value.level + 1 : 0))
</script>

<template>
  <div class="space-y-3">
    <div>
      <label :for="`${idPrefix}-password`" class="block text-sm font-bold">{{ t('Animation.Password.Label') }}<span class="text-red-700 dark:text-red-700" aria-hidden="true"> *</span></label>
      <div class="flex gap-2">
        <input
          :id="`${idPrefix}-password`"
          :value="modelValue"
          :type="shown ? 'text' : 'password'"
          autocomplete="new-password"
          maxlength="200"
          required
          class="form-field w-full"
          :aria-describedby="`${idPrefix}-help`"
          :data-testid="`${idPrefix}-password`"
          @input="emit('update:modelValue', $event.target.value)"
        />
        <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate shrink-0" :aria-pressed="shown" :data-testid="`${idPrefix}-toggle`" @click="shown = !shown">
          <v-icon :name="shown ? 'fa-eye-slash' : 'fa-eye'" aria-hidden="true" />{{ shown ? t('Animation.Password.Hide') : t('Animation.Password.Show') }}
        </button>
      </div>
      <p :id="`${idPrefix}-help`" class="text-xs text-slate-600 dark:text-slate-600">{{ t('Animation.Password.Help', { min: MIN_PASSWORD_LENGTH }) }}</p>

      <!-- Barre de force : 4 segments + le niveau écrit. Indicative. -->
      <div class="mt-1" :data-testid="`${idPrefix}-strength`" :data-level="modelValue ? strength.level : ''">
        <div class="flex gap-1" aria-hidden="true">
          <span v-for="n in 4" :key="n" class="h-2 flex-1 rounded" :style="{ background: n <= filled ? COLORS[strength.level] : '#cbd5e1' }"></span>
        </div>
        <p v-if="modelValue" role="status" class="text-sm font-semibold text-slate-800 dark:text-slate-800" :data-testid="`${idPrefix}-strength-label`">
          {{ t(`Animation.Password.Level${strength.level}`) }}
          <span v-if="strength.reasons.includes('common') || strength.reasons.includes('sequence') || strength.reasons.includes('repeated')" class="font-normal">— {{ t('Animation.Password.TooGuessable') }}</span>
        </p>
        <p v-if="tip" class="text-xs italic text-slate-600 dark:text-slate-600" :data-testid="`${idPrefix}-tip`">{{ tip }}</p>
      </div>
    </div>

    <div>
      <label :for="`${idPrefix}-confirmation`" class="block text-sm font-bold">{{ t('Animation.Password.Confirm') }}<span class="text-red-700 dark:text-red-700" aria-hidden="true"> *</span></label>
      <input
        :id="`${idPrefix}-confirmation`"
        :value="confirmation"
        :type="shown ? 'text' : 'password'"
        autocomplete="new-password"
        maxlength="200"
        required
        class="form-field w-full"
        :data-testid="`${idPrefix}-confirmation`"
        @input="emit('update:confirmation', $event.target.value)"
      />
      <p v-if="mismatch" role="alert" class="text-sm text-red-700 dark:text-red-700" :data-testid="`${idPrefix}-mismatch`">{{ t('Animation.Password.Mismatch') }}</p>
    </div>

    <p v-if="error" role="alert" class="text-sm text-red-700 dark:text-red-700" :data-testid="`${idPrefix}-error`">{{ error }}</p>
  </div>
</template>
