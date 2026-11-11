<script setup>
  import { ref, watch, computed, onBeforeUnmount } from 'vue'
  import useAnimKind from '@/use/useAnimKind'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import useRewardsGrid from '@/use/useRewardsGrid'

  /*
    L'adresse d'une activité d'Animation. Proposée à partir du nom, modifiable, jamais modifiée en silence : l'utilisateur voit
    l'adresse définitive en direct et l'accepte avant de créer (écran de confirmation).
    ⚠️ AUCUNE règle de slug ici : l'aperçu, la validité et la disponibilité viennent du SERVEUR (`activity-type` choisit l'endpoint),
    seule source des règles — le site n'en recopie rien. Jamais de suffixe automatique : « déjà prise » s'affiche et l'utilisateur
    choisit. Tant qu'il n'a pas touché au champ, l'adresse suit le nom ; dès qu'il le corrige à la main, elle ne bouge plus.
    Les slugs de decode et de rewards sont indépendants (tables séparées, URLs distinctes) : le même slug peut exister pour les deux.
  */
  const props = defineProps({
    name: { type: String, default: '' },
    modelValue: { type: String, default: '' },
    delay: { type: Number, default: 300 }, // anti-rebond de la frappe ; 0 = immédiat (tests)
    idPrefix: { type: String, default: 'slug' },
    activityType: { type: String, default: 'decode', validator: v => ['decode', 'rewards'].includes(v) },
  })
  const emit = defineEmits(['update:modelValue', 'state'])

  const { kt } = useAnimKind(props.activityType)
  const decodeApi = useDecodeActivities()
  const rewardsApi = useRewardsGrid()
  const slugFn = computed(() => props.activityType === 'rewards' ? rewardsApi.slug : decodeApi.slug)

  const edited = ref(false) // l'utilisateur a corrigé l'adresse à la main
  const status = ref({ valid: false, taken: false, min: 3, max: 20, checked: false })
  const pending = ref(false)
  let timer = null
  let seq = 0

  const publish = () => emit('state', { valid: status.value.valid, taken: status.value.taken, checked: status.value.checked })

  async function ask(params, applyProposal) {
    const mine = ++seq
    pending.value = true
    try {
      const data = await slugFn.value(params)
      if (mine !== seq) return // une réponse plus récente a pris le relais
      status.value = { valid: data.valid, taken: data.taken, min: data.min, max: data.max, checked: true }
      if (applyProposal) emit('update:modelValue', data.proposal)
    } catch {
      if (mine === seq) status.value = { ...status.value, checked: false }
    } finally {
      if (mine === seq) { pending.value = false; publish() }
    }
  }

  function later(fn) {
    clearTimeout(timer)
    if (props.delay <= 0) fn()
    else timer = setTimeout(fn, props.delay)
  }
  onBeforeUnmount(() => clearTimeout(timer))

  // Le nom change et l'adresse n'a pas été corrigée à la main : le serveur en propose une.
  watch(() => props.name, (name) => {
    if (edited.value) return
    status.value = { ...status.value, checked: false }
    publish()
    later(() => ask({ name }, true))
  })

  function onInput(event) {
    edited.value = true
    emit('update:modelValue', event.target.value)
    status.value = { ...status.value, checked: false }
    publish()
    later(() => ask({ slug: event.target.value }, false))
  }
</script>

<template>
  <div>
    <div class="flex flex-wrap items-baseline gap-x-2">
      <label :for="`${idPrefix}-slug`" class="block text-sm font-bold">{{ kt('Slug.Label') }}<span class="text-red-700 dark:text-red-700" aria-hidden="true"> *</span></label>
      <!-- L'état est écrit (la couleur ne porte jamais seule le sens) et annoncé. -->
      <span class="text-xs text-slate-600 dark:text-slate-600" aria-hidden="true">—</span>
      <p :id="`${idPrefix}-status`" role="status" class="text-xs italic text-slate-700 dark:text-slate-700" :data-testid="`${idPrefix}-status`">
        <template v-if="!modelValue">{{ kt('Slug.Empty') }}</template>
        <template v-else-if="pending || !status.checked">{{ kt('Slug.Checking') }}</template>
        <span v-else-if="!status.valid" class="text-red-700 dark:text-red-700" data-state="invalid">{{ kt('Slug.Invalid', { min: status.min, max: status.max }) }}</span>
        <span v-else-if="status.taken" class="text-red-700 dark:text-red-700" data-state="taken">{{ kt('Slug.Taken') }}</span>
        <span v-else class="text-green-800 dark:text-green-800" data-state="free">{{ kt('Slug.Free') }}</span>
      </p>
    </div>
    <input
      :id="`${idPrefix}-slug`"
      :value="modelValue"
      type="text"
      maxlength="60"
      autocomplete="off"
      spellcheck="false"
      class="form-field w-full font-mono"
      :aria-describedby="`${idPrefix}-status`"
      :data-testid="`${idPrefix}-input`"
      @input="onInput"
    />
    <p class="text-xs text-slate-600 dark:text-slate-600">{{ kt('Slug.Help', { min: status.min, max: status.max }) }}</p>
  </div>
</template>
