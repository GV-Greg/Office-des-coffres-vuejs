<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { parseInventoryText, resolveItems } from '@/modules/inventoryParser'
import { suggestCategory, orderCategoryKeys, CATEGORY_KEYS, CATEGORY_LABELS_FR } from '@/modules/inventoryCategories'
import { EXPORT_DEFAULT_COLOR } from '@/modules/inventoryBBcode'
import { compareInventories, formatDiff, formatEcusDiff, STATUS } from '@/modules/inventoryCompare'
import { exportBalanceToBBCode } from '@/modules/inventoryBalanceBBcode'
import { formatFieldDate } from '@/modules/playerDates'
import { fetchItemIcons } from '@/use/itemIconsApi'
import { useAuthStore } from '@/stores/authStore'
import { useCookieStore } from '@/stores/cookieStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import AccessLoader from '@/components/loading/AccessLoader.vue'

/*
  La Balance des stocks (4ᵉ module de la Salle des comptes ; fil admin/echanges/inventaire-comparaison/, décisions de Greg du 19/11/2026) :
  on colle un ancien inventaire et l'inventaire actuel, l'Office pèse l'écart. 🔴 Elle NE STOCKE RIEN : les deux champs ne sont ni
  mémorisés (ni cookie, ni stockage local, ni serveur) ni enregistrés par « Confier au scribe », qui n'exporte que le BBCode.
  Le bouton « Récupérer » relit, en LECTURE PURE (`inventoryStore.readLastPaste`), le dernier inventaire retenu par la Gestion des stocks
  pour le niveau choisi ; c'est une action volontaire, jamais un remplissage automatique. Catégories et options d'export sont celles de
  la Gestion des stocks (le joueur ne les règle pas ici). Aucune règle côté site : le serveur dit les niveaux ouverts (`scopes`).
*/
const { t, locale } = useI18n()
const authStore = useAuthStore()
const cookies = useCookieStore()
const store = useInventoryStore()

const level = ref('personal')
const levels = computed(() => store.availableLevels)
// Les niveaux ouverts viennent du serveur : tant qu'il n'a pas répondu, la place du sélecteur est réservée (cadenas + squelette, comme le Bilan des mines).
const scopesReady = ref(!store.serverMode)

const previousText = ref('')
const currentText = ref('')

// ─── Niveau et « Récupérer » ─────────────────────────────────────────────────
async function enter(lv) {
  if (!store.serverMode) {
    scopesReady.value = true
    return
  }
  try {
    await store.loadScopes()
    await store.load('personal')
    if (lv !== 'personal') await store.load(lv)
  } finally {
    scopesReady.value = true
  }
}
onMounted(() => enter(level.value))
watch(level, lv => { fetchedEmpty.value = false; enter(lv) })
watch(() => store.characterId, () => { level.value = 'personal'; source.value = null; scopesReady.value = !store.serverMode; enter('personal') })

// Mêmes libellés que la Gestion des stocks : « Personnel », « Ville : Arras », « Province : Artois ».
const levelLabel = lv => {
  if (lv === 'city') return t('EconomyInventory.LevelCity', { name: store.scopes?.city?.name ?? '' })
  if (lv === 'province') return t('EconomyInventory.LevelProvince', { name: store.scopes?.province?.name ?? '' })
  return t('EconomyInventory.LevelPersonal')
}

// Niveau actif en or (la couleur d'Économie) avec une coche, les autres en violet — plus voyant que l'ardoise de la Gestion des stocks (Greg, 19/11/2026).

// Sans compte, la reprise lit le cache de la Gestion des stocks : il n'existe qu'avec le consentement « Préférences ». Le bouton se
// désactive alors, sans jamais ouvrir la bannière.
const fetchDisabledNoConsent = computed(() => !store.serverMode && !cookies.hasAcceptedPreferences)

const fetching = ref(false)
const fetchedEmpty = ref(false)
// D'où vient l'ancien inventaire repris : { raw, kind: 'saved'|'taken'|'browser', date }. Oublié dès que le joueur retouche le champ.
const source = ref(null)

async function fetchPrevious() {
  fetching.value = true
  fetchedEmpty.value = false
  try {
    const result = await store.readLastPaste(level.value)
    if (result === null) return
    if (!result.raw.trim()) {
      fetchedEmpty.value = true
      return
    }
    previousText.value = result.raw
    source.value = result.takenOn
      ? { raw: result.raw, kind: 'taken', date: formatFieldDate('inventory_snapshot_date', result.takenOn, locale.value) }
      : result.savedAt
        ? { raw: result.raw, kind: 'saved', date: new Date(result.savedAt).toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit' }) }
        : { raw: result.raw, kind: 'browser', date: null }
  } finally {
    fetching.value = false
  }
}

watch(previousText, val => {
  if (source.value && val !== source.value.raw) source.value = null
  if (val.trim()) fetchedEmpty.value = false
})

const sourceNote = computed(() => {
  if (!source.value) return ''
  const { kind, date } = source.value
  return t(`EconomyBalance.From${kind === 'taken' ? 'Taken' : kind === 'saved' ? 'Saved' : 'Browser'}`, { date })
})

// ─── Lecture et comparaison ──────────────────────────────────────────────────
const parse = text => {
  const { totalEcus, items } = parseInventoryText(text)
  return { totalEcus, items: resolveItems(items) }
}
const previous = computed(() => parse(previousText.value))
const current = computed(() => parse(currentText.value))
const hasPrevious = computed(() => previous.value.items.length > 0)
const hasCurrent = computed(() => current.value.items.length > 0)

// Les deux champs doivent porter un inventaire reconnu ; sinon, pas de colonne d'écarts, pas d'erreur.
const comparison = computed(() => (hasPrevious.value && hasCurrent.value ? compareInventories(previous.value, current.value) : null))

// ─── Catégories : celles du niveau choisi dans la Gestion des stocks ─────────
const doc = computed(() => store.doc(level.value))
const personalDoc = computed(() => store.doc('personal'))
const customCats = computed(() => doc.value.itemCategories)
const customCatsList = computed(() => doc.value.custom ?? [])
const hiddenBuiltIn = computed(() => new Set(doc.value.hiddenBuiltIn ?? []))

const allCategoryKeys = computed(() => orderCategoryKeys([
  ...CATEGORY_KEYS.filter(k => !hiddenBuiltIn.value.has(k)),
  ...customCatsList.value.map(c => c.key),
], doc.value.order))

const getCategoryLabel = key => {
  const custom = customCatsList.value.find(c => c.key === key)
  if (custom) return locale.value === 'fr' ? custom.fr : (custom.en || custom.fr)
  return t(`EconomyInventory.Categories.${key}`)
}
// Libellé FR fixe pour le BBCode forum (indépendant de la langue de l'interface)
const getCategoryLabelFr = key => {
  const custom = customCatsList.value.find(c => c.key === key)
  if (custom) return custom.fr
  return CATEGORY_LABELS_FR[key] ?? key
}
const getCategory = name => suggestCategory(name, customCats.value) ?? 'divers'

const groupedRows = computed(() => {
  if (!comparison.value) return []
  const groups = new Map(allCategoryKeys.value.map(k => [k, []]))
  for (const row of comparison.value.rows) {
    const cat = getCategory(row.name)
    const bucket = groups.has(cat) ? cat : 'divers'
    if (!groups.has(bucket)) groups.set(bucket, [])
    groups.get(bucket).push(row)
  }
  return [...groups.entries()].filter(([, rows]) => rows.length > 0)
})

// ─── Affichage d'un écart : flèche ET signe, la couleur n'est qu'un repère. Une quantité identique n'affiche RIEN (pas de tiret : Greg, 19/11/2026). ───
const STATUS_VIEW = {
  [STATUS.UP]: { arrow: '▲', cls: 'text-green-700 dark:text-green-400', label: 'EconomyBalance.Increased' },
  [STATUS.NEW]: { arrow: '▲', cls: 'text-green-700 dark:text-green-400', label: 'EconomyBalance.Increased' },
  [STATUS.DOWN]: { arrow: '▼', cls: 'text-red-700 dark:text-red-400', label: 'EconomyBalance.Decreased' },
}
const statusView = status => STATUS_VIEW[status]
const diffText = row => formatDiff(row.diff)

const ecusView = computed(() => {
  const e = comparison.value?.ecus
  if (!e) return null
  // Trésor identique : le montant seul, sans écart ni flèche.
  const view = e.diff > 0 ? STATUS_VIEW[STATUS.UP] : e.diff < 0 ? STATUS_VIEW[STATUS.DOWN] : null
  return { ...(view ?? { arrow: '', cls: '', label: '' }), amount: e.after.toLocaleString('fr-FR'), diff: view ? formatEcusDiff(e.diff) : '' }
})

// ─── Export : le BBCode annoté, sans rien enregistrer ───────────────────────
async function doExport() {
  if (!comparison.value) return
  const result = comparison.value
  const exportColor = (authStore.isLoggedIn ? doc.value.exportColor : undefined) ?? EXPORT_DEFAULT_COLOR
  // Les ID d'icônes se demandent à l'Office au moment d'exporter (connecté seulement, comme la Gestion des stocks) ; une panne ne bloque pas.
  let icons = {}
  if (store.serverMode && personalDoc.value.exportShowIcons) {
    try {
      icons = await fetchItemIcons([...result.rows, ...result.disappeared].map(item => item.name))
    } catch {
      push.warning(t('EconomyInventory.Icons.Unavailable'))
    }
  }
  const bbcode = exportBalanceToBBCode(
    result.rows,
    result.disappeared,
    name => suggestCategory(name, customCats.value),
    {
      categoryKeys: allCategoryKeys.value,
      getCategoryLabel: getCategoryLabelFr,
      options: {
        qtyFormat: personalDoc.value.exportQtyFormat,
        showEcus: personalDoc.value.exportShowEcus,
        wrapper: personalDoc.value.exportWrapper,
        color: exportColor,
        ecus: result.ecus ? { after: result.ecus.after, diff: result.ecus.diff } : null,
        totalEcus: current.value.totalEcus,
        icons,
      },
    },
  )
  try {
    await navigator.clipboard.writeText(bbcode)
    push.success(t('EconomyInventory.CopiedToast'))
  } catch {
    // clipboard non disponible (contexte non sécurisé, iframe…)
  }
}

function clearAll() {
  previousText.value = ''
  currentText.value = ''
  fetchedEmpty.value = false
}
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold text-yellow-600 dark:text-yellow-500 mb-1">
      {{ t('EconomyBalance.PageTitle') }}
    </h2>
    <p class="text-sm italic text-slate-600 dark:text-slate-400 mb-3">{{ t('EconomyBalance.Intro') }}</p>

    <!-- Niveau : au-dessus, comme dans la Gestion des stocks — seulement si le personnage actif a un poste qui en ouvre d'autres que le sien. -->
    <AccessLoader v-if="!scopesReady" min-height="3.5rem" class="mb-3" />
    <div v-else-if="levels.length > 1" role="group" :aria-label="t('EconomyInventory.LevelNav')" class="flex flex-wrap gap-2 mb-3" data-testid="balance-levels">
      <button
        v-for="lv in levels"
        :key="lv"
        type="button"
        class="odc-btn odc-btn--soft odc-btn--sm"
        :class="level === lv ? 'odc--gold' : 'odc--violet'"
        :aria-pressed="level === lv"
        :data-testid="`balance-level-${lv}`"
        @click="level = lv"
      >
        <v-icon v-if="level === lv" name="fa-check" aria-hidden="true" />{{ levelLabel(lv) }}
      </button>
    </div>

    <div class="laptop:grid laptop:grid-cols-2 laptop:gap-6 laptop:items-start">
      <!-- Ancien inventaire -->
      <div>
        <label class="block text-sm font-medium mb-1" for="balance-previous">{{ t('EconomyBalance.PreviousLabel') }}</label>
        <textarea
          id="balance-previous"
          v-model="previousText"
          :placeholder="t('EconomyBalance.PreviousPlaceholder')"
          class="textarea-autoresize w-full h-36 p-2 rounded-xl bg-white text-sm font-mono resize-y"
          data-testid="balance-previous"
        />
        <!-- Le fond de la carte reste CLAIR dans les deux thèmes : textes en couleur fixe, doublée de la même variante `dark:` pour neutraliser la
             règle globale `.dark p`. -->
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button
            type="button"
            class="odc-btn odc-btn--soft odc--gold odc-btn--sm shrink-0"
            :disabled="fetching || fetchDisabledNoConsent"
            :title="t('EconomyBalance.FetchHint')"
            data-testid="balance-fetch"
            @click="fetchPrevious"
          >
            <v-icon name="fa-sync-alt" aria-hidden="true" />{{ t('EconomyBalance.Fetch') }}
          </button>
          <p class="text-sm text-slate-700 dark:text-slate-700" data-testid="balance-fetch-hint">{{ t('EconomyBalance.FetchHint') }}.</p>
        </div>
        <p v-if="level === 'province'" class="mt-1 text-xs italic text-slate-600 dark:text-slate-600" data-testid="balance-province-hint">
          {{ t('EconomyBalance.FetchHintProvince') }}
        </p>
        <p v-if="sourceNote" class="mt-1 text-xs italic text-slate-600 dark:text-slate-600" data-testid="balance-source">{{ sourceNote }}</p>
        <p v-if="fetchDisabledNoConsent" role="note" class="mt-1 text-xs italic text-slate-600 dark:text-slate-600" data-testid="balance-no-consent">
          {{ t('EconomyBalance.FetchNoConsent') }}
        </p>
        <p v-if="fetchedEmpty" role="status" class="mt-1 text-xs italic text-slate-600 dark:text-slate-600" data-testid="balance-fetch-none">
          {{ t('EconomyBalance.FetchNone') }}
        </p>
      </div>

      <!-- Inventaire actuel -->
      <div class="mt-3 laptop:mt-0">
        <label class="block text-sm font-medium mb-1" for="balance-current">{{ t('EconomyBalance.CurrentLabel') }}</label>
        <textarea
          id="balance-current"
          v-model="currentText"
          :placeholder="t('EconomyBalance.CurrentPlaceholder')"
          class="textarea-autoresize w-full h-36 p-2 rounded-xl bg-white text-sm font-mono resize-y"
          data-testid="balance-current"
        />
        <div v-if="previousText.trim() || currentText.trim()" class="mt-2">
          <button type="button" class="odc-btn odc-btn--soft odc--red odc-btn--sm" data-testid="balance-clear" @click="clearAll">
            <v-icon name="fa-trash-alt" aria-hidden="true" />{{ t('EconomyInventory.ClearButton') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Résultat -->
    <section class="mt-4" aria-live="polite" data-testid="balance-result">
      <h3 class="text-sm font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-500 border-b border-yellow-200 dark:border-yellow-900 pb-0.5 mb-2">
        {{ t('EconomyBalance.ComparisonTitle') }}
      </h3>

      <p v-if="!hasPrevious" class="text-sm text-slate-500 dark:text-slate-400" data-testid="balance-no-previous">
        {{ t('EconomyBalance.NoPrevious') }}
      </p>
      <p v-else-if="!hasCurrent" class="text-sm text-slate-500 dark:text-slate-400" data-testid="balance-no-current">
        {{ currentText.trim() ? t('EconomyInventory.NoItems') : t('EconomyBalance.NoCurrent') }}
      </p>

      <template v-else-if="comparison">
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
          <p class="text-sm text-slate-600 dark:text-slate-400" data-testid="balance-summary">
            {{ t('EconomyBalance.Summary', { up: comparison.counts.up, down: comparison.counts.down, added: comparison.counts.new, gone: comparison.counts.disappeared }) }}
          </p>
          <button type="button" class="odc-btn odc-btn--soft odc--green" data-testid="balance-export" @click="doExport">
            <v-icon name="fa-copy" aria-hidden="true" />{{ t('EconomyInventory.ExportButton') }}
          </button>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">{{ t('EconomyBalance.ExportHint') }}</p>

        <p v-if="ecusView" class="text-sm mb-3" data-testid="balance-ecus">
          {{ t('EconomyBalance.Treasury', { ecus: ecusView.amount }) }}
          <span v-if="ecusView.diff" :class="ecusView.cls">
            <span aria-hidden="true">{{ ecusView.arrow }}</span>
            <span class="sr-only">{{ t(ecusView.label) }}</span>
            {{ ecusView.diff }}
          </span>
        </p>

        <p v-if="!comparison.hasChanges" class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3" data-testid="balance-no-change">
          {{ t('EconomyBalance.NoChange') }}
        </p>

        <div v-for="[catKey, rows] in groupedRows" :key="catKey" class="mb-4">
          <h4 class="flex items-center justify-between text-xs font-bold uppercase tracking-wide mb-1 border-b border-yellow-200 dark:border-yellow-900 pb-0.5 text-yellow-700 dark:text-yellow-500">
            <span>{{ getCategoryLabel(catKey) }}</span>
            <span class="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">{{ rows.length }}</span>
          </h4>
          <ul class="grid grid-cols-1 laptop:grid-cols-2 desktop:grid-cols-3 gap-x-6 gap-y-0.5">
            <li
              v-for="row in rows"
              :key="row.name"
              class="flex items-center gap-2 text-sm rounded px-1 -mx-1 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
              data-testid="balance-row"
            >
              <span class="tabular-nums text-right w-14 shrink-0 text-yellow-600 dark:text-yellow-500 font-medium">{{ row.quantity }}</span>
              <span class="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                <span class="truncate">{{ row.name }}</span>
                <span v-if="row.truncated" class="shrink-0 text-yellow-600 dark:text-yellow-400" :title="t('EconomyInventory.TruncatedHint')" aria-hidden="true">✂</span>
                <span
                  v-if="row.status === 'new'"
                  class="shrink-0 rounded px-1 text-[0.65rem] font-semibold uppercase bg-green-100 text-green-900 border border-green-300"
                  data-testid="balance-new"
                >{{ t('EconomyBalance.New') }}</span>
              </span>
              <span v-if="row.status !== 'same'" class="shrink-0 tabular-nums font-medium" :class="statusView(row.status).cls" data-testid="balance-diff">
                <span aria-hidden="true">{{ statusView(row.status).arrow }}</span>
                <span class="sr-only">{{ t(statusView(row.status).label) }}</span>
                {{ diffText(row) }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Items disparus : section séparée, lignes barrées. -->
        <div v-if="comparison.disappeared.length" class="mb-4" data-testid="balance-disappeared">
          <h4 class="flex items-center justify-between text-xs font-bold uppercase tracking-wide mb-1 border-b border-red-200 dark:border-red-900 pb-0.5 text-red-700 dark:text-red-400">
            <span>{{ t('EconomyBalance.Disappeared') }}</span>
            <span class="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-500">{{ comparison.disappeared.length }}</span>
          </h4>
          <ul class="grid grid-cols-1 laptop:grid-cols-2 desktop:grid-cols-3 gap-x-6 gap-y-0.5">
            <li v-for="item in comparison.disappeared" :key="item.name" class="flex items-center gap-2 text-sm px-1 -mx-1" data-testid="balance-gone">
              <span class="tabular-nums text-right w-14 shrink-0 line-through text-slate-500 dark:text-slate-400">{{ item.before }}</span>
              <span class="flex-1 min-w-0 truncate line-through text-slate-500 dark:text-slate-400">{{ item.name }}</span>
              <span class="shrink-0 tabular-nums font-medium text-red-700 dark:text-red-400">
                <span aria-hidden="true">▼</span>
                <span class="sr-only">{{ t('EconomyBalance.Decreased') }}</span>
                {{ formatDiff(-item.before) }}
              </span>
            </li>
          </ul>
        </div>
      </template>
    </section>
  </div>
</template>
