<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { PRICED_RESOURCES, uncoveredWeeks, setForDay } from '@/modules/minePrices'
  import { todayIso } from '@/modules/mineParser'
  import { formatFieldDate } from '@/modules/playerDates'
  import useMinePrices from '@/use/useMinePrices'
  import { http } from '@/api.js'
  import MinePricesModal from '@/components/mines/MinePricesModal.vue'

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

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const province = ref(null)      // { id, name }
  const canWrite = ref(false)
  const prices = ref([])
  const registry = ref(null)      // mandat du lecteur, pour l'alerte de semaines non couvertes (peut manquer)
  const loading = ref(false)
  const error = ref('')

  const showAdd = ref(false) // « Ajouter un prix » ouvre la même modale que « Gérer les prix » du registre
  const editing = ref(null) // jeu en cours de correction : la modale sert aussi à modifier

  async function load() {
    prices.value = []
    province.value = null
    canWrite.value = false
    registry.value = null
    error.value = ''
    showAdd.value = false
    editing.value = null
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

  const missing = computed(() => (registry.value?.mandate?.in_office_from
    ? uncoveredWeeks(prices.value, registry.value.mandate.in_office_from, registry.value.today)
    : []))

  // Le jeu en vigueur AUJOURD'HUI est repéré dans la liste ; chaque valeur dit son écart avec le jeu précédent
  // (la ligne juste en dessous, liste du plus récent au plus ancien) — un historique de prix se lit en variations.
  const inForceId = computed(() => setForDay(prices.value, todayIso())?.id ?? null)
  const olderOf = index => prices.value[index + 1] ?? null
  const deltaOf = (index, current, older, resource) => {
    if (!older) return null
    const before = resource === 'RATE' ? older.hourly_rate : older.prices[resource]
    const diff = Math.round((current - before) * 100) / 100
    return diff === 0 ? null : diff
  }
  const signedNum = n => `${n > 0 ? '+' : '−'}${num(Math.abs(n))}`

  const date = (field, value) => formatFieldDate(field, value, locale.value)
  const num = n => Number(n).toLocaleString(locale.value === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 2 })
  const byLine = set => (set.updated_by !== null && set.updated_at !== set.created_at
    ? t('EconomyMines.RegistryPage.Prices.ModifiedBy', { name: set.updated_by, date: date('price_updated_at', set.updated_at) })
    : t('EconomyMines.RegistryPage.Prices.CreatedBy', { name: set.created_by ?? t('EconomyMines.Registry.DeletedCharacter'), date: date('price_created_at', set.created_at) }))

  // Ajout et correction passent par la MÊME modale (Greg, 15/10) ; elle recharge la liste à l'enregistrement.
  const onSaved = async () => { prices.value = await api.list(province.value.id) }
  const closeModal = () => { showAdd.value = false; editing.value = null }
  const startAdd = () => { editing.value = null; showAdd.value = true }
  const startEdit = (set) => { showAdd.value = false; editing.value = set }
</script>

<template>
  <div class="w-full max-w-5xl text-slate-800 dark:text-slate-800">
    <p v-if="!character" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.NoCharacter') }}</p>
    <p v-else-if="loading" role="status" class="text-slate-700 dark:text-slate-700">{{ t('EconomyMines.RegistryPage.Loading') }}</p>
    <p v-else-if="error" role="alert" class="text-slate-700 dark:text-slate-700" data-testid="prices-error">{{ error }}</p>

    <template v-else-if="province">
      <header class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-slate-300 pb-2">
        <!-- Retour à gauche, en bouton avec icône (Greg, 15/10/2026) ; le titre le suit, l'ajout est à droite. -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <RouterLink :to="{ name: 'economy-registry' }" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="prices-back">
            <v-icon name="fa-reply" aria-hidden="true" />{{ t('EconomyMines.RegistryPage.Prices.BackToRegistry') }}
          </RouterLink>
          <h2 class="!mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyMines.RegistryPage.Prices.PageTitle', { province: province.name }) }}</h2>
        </div>
        <button v-if="canWrite" type="button" class="odc-btn odc-btn--soft odc--green odc-btn--sm" data-testid="prices-add" @click="startAdd">
          <v-icon name="fa-plus" aria-hidden="true" />{{ t('EconomyMines.RegistryPage.Prices.AddPrice') }}
        </button>
      </header>

      <!-- Outil de suivi du gestionnaire, jamais un blocage. -->
      <p v-if="missing.length" role="note" class="mt-3 text-sm font-semibold text-orange-800 dark:text-orange-800" data-testid="prices-uncovered">
        {{ t('EconomyMines.RegistryPage.Prices.NoPricesWarning') }}
      </p>

      <p v-if="!prices.length" class="mt-4 text-sm text-slate-700 dark:text-slate-700" data-testid="prices-empty">{{ t('EconomyMines.RegistryPage.Prices.Empty') }}</p>

      <!-- Frise verticale (Greg, 15/10 : pas de tableau) : un historique de prix EST une suite dans le temps, du plus récent au
           plus ancien. Une entrée par jeu : la date à gauche, les cinq prix et le taux avec leur unité sur la ligne, l'auteur
           dessous, l'action à droite. Le jeu en vigueur aujourd'hui a son point et son liseré or (couleur du module). -->
      <ol v-else class="price-timeline mt-5" data-testid="prices-list">
        <li v-for="(set, index) in prices" :key="set.id" class="price-entry" :class="set.id === inForceId ? 'price-entry--now' : ''" :data-testid="`price-${set.id}`">
          <div class="entry-date">
            <h3 class="!mb-0 text-base font-bold text-slate-800 dark:text-slate-800">{{ date('price_effective_from', set.effective_from) }}</h3>
            <span v-if="set.id === inForceId" class="price-now" data-testid="price-now">{{ t('EconomyMines.RegistryPage.Prices.InForceNow') }}</span>
          </div>

          <div class="entry-body">
            <dl class="entry-values">
              <div v-for="resource in PRICED_RESOURCES" :key="resource">
                <dt>{{ t(`EconomyMines.RegistryPage.Prices.Resource.${resource}`) }}</dt>
                <dd>
                  <strong>{{ num(set.prices[resource]) }}</strong>
                  <span class="unit">{{ t(`EconomyMines.RegistryPage.Prices.PerUnit.${resource}`) }}</span>
                  <span v-if="deltaOf(index, set.prices[resource], olderOf(index), resource)" class="delta">{{ signedNum(deltaOf(index, set.prices[resource], olderOf(index), resource)) }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ t('EconomyMines.RegistryPage.Prices.HourlyRate') }}</dt>
                <dd>
                  <strong>{{ num(set.hourly_rate) }}</strong>
                  <span class="unit">{{ t('EconomyMines.RegistryPage.Prices.PerUnit.RATE') }}</span>
                  <span v-if="deltaOf(index, set.hourly_rate, olderOf(index), 'RATE')" class="delta">{{ signedNum(deltaOf(index, set.hourly_rate, olderOf(index), 'RATE')) }}</span>
                </dd>
              </div>
            </dl>
            <p class="entry-author">{{ byLine(set) }}</p>
          </div>

          <div class="entry-action">
            <button v-if="set.editable" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--green" :data-testid="`price-edit-${set.id}`" @click="startEdit(set)">
              <v-icon name="fa-edit" aria-hidden="true" />{{ t('EconomyMines.RegistryPage.Prices.Edit') }}
            </button>
            <span v-else-if="canWrite" class="text-xs italic text-slate-600 dark:text-slate-600" :data-testid="`price-locked-${set.id}`">{{ t('EconomyMines.RegistryPage.Prices.Locked') }}</span>
          </div>
        </li>
      </ol>
    </template>
    <MinePricesModal :show="showAdd || !!editing" :edit="editing" :province-id="province?.id ?? null" :prices="prices" :show-history-link="false" @close="closeModal" @saved="onSaved" />
  </div>
</template>

<style scoped>
  /* Frise : un trait vertical, un point par entrée ; le jeu en vigueur aujourd'hui a le point et le liseré or. */
  .price-timeline { margin-left: 0.4rem; padding-left: 1.6rem; border-left: 2px solid #cbd5e1; list-style: none; }
  /* Chaque entrée est une plaque contournée, posée sur la frise. Une seule est mise en avant : le jeu en vigueur
     aujourd'hui — papier sable #f3ecdc, choisi par Greg le 15/10 sur une planche comparée de six fonds
     (logo/plaques/planche-fond-plaque-prix.html) : chaud, accordé au contour ambre et à l'ombre brune. Textes
     #475569 / #1e293b dessus : voir les contrastes mesurés. */
  .price-entry { position: relative; display: grid; gap: 0.5rem 1.5rem; margin-bottom: 0.75rem; padding: 0.9rem 1rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 0.75rem; box-shadow: 0 1px 0 rgb(15 23 42 / 0.04); }
  .price-entry:last-child { margin-bottom: 0; }
  .price-entry::before { content: ''; position: absolute; left: calc(-1.975rem - 2px); top: 1.2rem; width: 0.75rem; height: 0.75rem; border-radius: 999px; background: #94a3b8; box-shadow: 0 0 0 3px #f8fafc; }
  .price-entry--now { background: #f3ecdc; border-color: #d97706; box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 6px 14px -8px rgb(69 26 3 / 0.4); }
  .price-entry--now::before { background: #d97706; box-shadow: 0 0 0 3px #f8fafc, 0 0 0 5px rgb(217 119 6 / 0.35); }
  .entry-date { display: flex; flex-direction: column; align-items: flex-start; gap: 0.3rem; }
  .price-now { display: inline-block; padding: 0.05rem 0.55rem; border-radius: 999px; border: 1px solid #d97706; background: #fef3c7; color: #78350f; font-size: 0.7rem; font-weight: 700; }
  .entry-values { display: flex; flex-wrap: wrap; gap: 0.5rem 1.75rem; margin: 0; }
  .entry-values dt { font-size: 0.75rem; color: #475569; }
  .entry-values dd { margin: 0; font-variant-numeric: tabular-nums; }
  .entry-values strong { font-size: 1.05rem; color: #1e293b; }
  .entry-values .unit { margin-left: 0.25rem; font-size: 0.7rem; color: #475569; }
  .entry-values .delta { margin-left: 0.35rem; font-size: 0.7rem; color: #475569; }
  .entry-author { margin: 0.35rem 0 0; font-size: 0.75rem; color: #475569; }
  .entry-action { display: flex; align-items: flex-start; justify-content: flex-start; }
  /* À partir de laptop : date | prix | action sur une seule ligne, sans défilement ; en dessous, empilé. */
  @media (min-width: 1024px) {
    .price-entry { grid-template-columns: 11rem minmax(0, 1fr) 9rem; align-items: start; }
    .entry-action { justify-content: flex-end; }
  }
</style>
