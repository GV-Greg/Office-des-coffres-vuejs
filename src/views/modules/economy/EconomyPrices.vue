<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { push } from 'notivue'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { PRICED_RESOURCES, uncoveredWeeks, setFromComfort } from '@/modules/minePrices'
  import { useCookieStore } from '@/stores/cookieStore'
  import { formatFieldDate } from '@/modules/playerDates'
  import { todayIso } from '@/modules/mineParser'
  import useMinePrices from '@/use/useMinePrices'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { http } from '@/api.js'
  import MinePriceForm from '@/components/mines/MinePriceForm.vue'

  /*
    Historique des prix des mines (lot 2 des prix du Registre ; brief admin/content/brief-prix-registre.md).
    Un jeu de prix entre en vigueur à sa date d'effet et le reste jusqu'au suivant ; l'historique peut
    s'étendre sur des années. Pas de suppression : un prix faux se corrige. ⚠️ Aucune règle ici : qui peut
    ajouter vient de l'API (`access.prices.write`), qui peut corriger un jeu vient de son drapeau
    `editable` (poste tenu à sa date d'effet, 7 jours de grâce après la fin du poste).
  */
  const { t, locale } = useI18n()
  const authStore = useAuthStore()
  const api = useMinePrices()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const province = ref(null)      // { id, name }
  const canWrite = ref(false)
  const prices = ref([])
  const registry = ref(null)      // mandat du lecteur, pour l'alerte de semaines non couvertes (peut manquer)
  const loading = ref(false)
  const error = ref('')

  const adding = ref(false)
  const editingId = ref(null)
  const submitting = ref(false)
  const formError = ref('')

  async function load() {
    prices.value = []
    province.value = null
    canWrite.value = false
    registry.value = null
    error.value = ''
    adding.value = false
    editingId.value = null
    if (!character.value) return
    loading.value = true
    try {
      const access = await api.access(character.value.id)
      canWrite.value = !!access?.prices?.write
      province.value = access?.prices?.write ?? access?.prices?.read ?? null
      if (!province.value) { error.value = t('EconomyMines.RegistryPage.Prices.NotAllowed'); return }
      prices.value = await api.list(province.value.id)
      // L'alerte a besoin du mandat : seuls les lecteurs du registre l'ont (le commissaire au commerce non).
      try {
        const { data } = await http.get(`characters/${character.value.id}/mine-registry/reports`, { headers: { Authorization: `Bearer ${authStore.getToken}` } })
        registry.value = data
      } catch { registry.value = null }
    } catch (e) {
      error.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
    } finally {
      loading.value = false
    }
  }
  watch(() => character.value?.id, load, { immediate: true })

  // Valeurs de départ d'un nouveau jeu : le plus récent de la province, à défaut les derniers prix du Bilan
  // (confort). Le formulaire reste vide quand on n'a ni l'un ni l'autre.
  const addInitial = computed(() => prices.value[0] ?? setFromComfort(cookieStore.getComfortData('economy_mines_settings')))
  const addNote = computed(() => (!prices.value.length && addInitial.value ? t('EconomyMines.RegistryPage.Prices.FromCookies') : ''))

  const missing = computed(() => (registry.value?.mandate?.in_office_from
    ? uncoveredWeeks(prices.value, registry.value.mandate.in_office_from, registry.value.today)
    : []))

  const date = (field, value) => formatFieldDate(field, value, locale.value)
  const num = n => Number(n).toLocaleString(locale.value === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 2 })
  const byLine = set => (set.updated_by !== null && set.updated_at !== set.created_at
    ? t('EconomyMines.RegistryPage.Prices.ModifiedBy', { name: set.updated_by, date: date('price_updated_at', set.updated_at) })
    : t('EconomyMines.RegistryPage.Prices.CreatedBy', { name: set.created_by ?? t('EconomyMines.Registry.DeletedCharacter'), date: date('price_created_at', set.created_at) }))

  function save(body, existing) {
    submitting.value = true
    formError.value = ''
    const call = existing ? api.update(province.value.id, existing.id, body) : api.create(province.value.id, body)
    trackApiCall(call)
      .then(async () => {
        push.success(t('EconomyMines.RegistryPage.Prices.Saved'))
        adding.value = false
        editingId.value = null
        prices.value = await api.list(province.value.id)
      })
      .catch((e) => { formError.value = apiMessage(e, locale.value, t('Auth.Errors.NetworkError')) })
      .finally(() => { submitting.value = false })
  }
  const startAdd = () => { adding.value = true; editingId.value = null; formError.value = '' }
  const startEdit = (set) => { editingId.value = set.id; adding.value = false; formError.value = '' }
</script>

<template>
  <div class="w-full max-w-5xl text-slate-800 dark:text-slate-800">
    <p v-if="!character" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.NoCharacter') }}</p>
    <p v-else-if="loading" role="status" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.Loading') }}</p>
    <p v-else-if="error" role="alert" class="text-slate-700 dark:text-slate-700" data-testid="prices-error">{{ error }}</p>

    <template v-else-if="province">
      <header class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-slate-300 pb-2">
        <h2 class="!mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.Prices.PageTitle', { province: province.name }) }}</h2>
        <div class="flex flex-wrap items-center gap-3">
          <RouterLink :to="{ name: 'economy-registry' }" class="text-sm underline text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.Prices.BackToRegistry') }}</RouterLink>
          <button v-if="canWrite" type="button" class="odc-btn odc-btn--soft odc--gold odc-btn--sm" data-testid="prices-add" @click="startAdd">
            {{ t('EconomyMines.RegistryPage.Prices.AddPrice') }}
          </button>
        </div>
      </header>

      <!-- Outil de suivi du gestionnaire, jamais un blocage. -->
      <p v-if="missing.length" role="note" class="mt-3 text-sm font-semibold text-orange-800 dark:text-orange-800" data-testid="prices-uncovered">
        {{ t('EconomyMines.RegistryPage.Prices.NoPricesWarning') }}
      </p>

      <section v-if="adding" class="mt-4 max-w-md" data-testid="prices-add-form">
        <MinePriceForm :initial="addInitial" :date="todayIso()" is-new :note="addNote" :submit-label="t('EconomyMines.RegistryPage.Prices.Save')" :submitting="submitting" :error="formError" id-prefix="add"
                       @submit="body => save(body, null)" @cancel="adding = false" />
      </section>

      <p v-if="!prices.length" class="mt-4 text-sm text-slate-700 dark:text-slate-700" data-testid="prices-empty">{{ t('EconomyMines.RegistryPage.Prices.Empty') }}</p>

      <ul v-else class="mt-4 divide-y divide-slate-300" data-testid="prices-list">
        <li v-for="set in prices" :key="set.id" class="py-3" :data-testid="`price-${set.id}`">
          <template v-if="editingId === set.id">
            <div class="max-w-md">
              <MinePriceForm :initial="set" :submit-label="t('EconomyMines.RegistryPage.Prices.Save')" :submitting="submitting" :error="formError"
                             :id-prefix="`edit-${set.id}`" @submit="body => save(body, set)" @cancel="editingId = null" />
            </div>
          </template>
          <template v-else>
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 class="!mb-0 font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.Prices.InForceFrom', { date: date('price_effective_from', set.effective_from) }) }}</h3>
              <button v-if="set.editable" type="button" class="odc-btn odc-btn--quiet odc-btn--sm odc--slate" :data-testid="`price-edit-${set.id}`" @click="startEdit(set)">
                {{ t('EconomyMines.RegistryPage.Prices.Edit') }}
              </button>
              <span v-else-if="canWrite" class="text-xs italic text-slate-600 dark:text-slate-600" :data-testid="`price-locked-${set.id}`">{{ t('EconomyMines.RegistryPage.Prices.Locked') }}</span>
            </div>
            <dl class="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
              <div v-for="resource in PRICED_RESOURCES" :key="resource" class="flex gap-1">
                <dt class="text-slate-700 dark:text-slate-700">{{ t(`EconomyMines.RegistryPage.Prices.Resource.${resource}`) }}</dt>
                <dd class="font-bold">{{ num(set.prices[resource]) }}</dd>
              </div>
              <div class="flex gap-1">
                <dt class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.Prices.HourlyRate') }}</dt>
                <dd class="font-bold">{{ num(set.hourly_rate) }}</dd>
              </div>
            </dl>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-600">{{ byLine(set) }}</p>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>
