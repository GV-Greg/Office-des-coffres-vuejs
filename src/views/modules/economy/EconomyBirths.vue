<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { SPECIES, BATCH_SIZES, ingredientsOf, speciesByKey, birthCost } from '@/modules/birthCosts'
import { feedPrice, ecusChoice } from '@/modules/livestock'
import { useAuthStore } from '@/stores/authStore'
import useLivestock from '@/use/useLivestock'
import BirthLedger from '@/components/livestock/BirthLedger.vue'
import BirthRecordBar from '@/components/livestock/BirthRecordBar.vue'
import AccessLoader from '@/components/loading/AccessLoader.vue'
import ReportCard from '@/components/customs/ReportCard.vue'

/*
  Le Livre des naissances (partie Finances de la Salle des comptes) : un calculateur PUBLIC. On choisit une espèce, UN ingrédient et un
  nombre d'animaux ; l'Office dit ce qu'il faut prévoir et ce qui sera perdu. Les coûts, fixés par le jeu, sont calculés dans le
  navigateur (modules/birthCosts.js). 🔴 Sans compte ou sans poste, rien n'est envoyé ni enregistré.
  Le bailli et le dirigeant n'y voient que les espèces élevées dans leur province (réglées dans Mon bureau) ; le bailli y inscrit
  les naissances. ⚠️ Qui peut quoi : le serveur le dit.

  Mise en page : titre centré, puis deux cartes à plaque ardoise (la matière de la Salle des gardes), de même hauteur : à gauche
  on prépare la naissance, à droite on lit le registre ; leurs bandeaux du bas (inscrire, prix) s'alignent. Le point fort : les
  quatre lots à l'or des choix, chacun avec son dernier sac rempli de ce qui sert (la part hachurée est perdue).
*/
const { t, locale } = useI18n()

const authStore = useAuthStore()
const characterId = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter?.id ?? null : null))
const { book, ready, refresh, record, pastMandate, withdraw } = useLivestock(characterId)
const ledgerApi = { pastMandate, withdraw, refresh }
const freshId = ref(null)
const onRecorded = id => { freshId.value = id; refresh() }
const province = computed(() => book.value?.province ?? null)
const canReadHistory = computed(() => !!province.value || (book.value?.past_mandates?.length ?? 0) > 0)
const offered = computed(() => (province.value ? SPECIES.filter(s => book.value.species?.includes(s.key)) : SPECIES))

const species = ref(SPECIES[0].key)
const ingredient = ref(ingredientsOf(SPECIES[0].key)[0])
const quantity = ref(1)

const ingredients = computed(() => ingredientsOf(species.value))

// L'ingrédient suit l'espèce : on le garde s'il lui convient (maïs ou blé d'un animal à l'autre), sinon le premier des siens.
function chooseSpecies(key) {
  species.value = key
  if (!ingredientsOf(key).includes(ingredient.value)) ingredient.value = ingredientsOf(key)[0]
}

// La liste de la province arrive après la page : l'espèce choisie doit en faire partie.
watch(offered, list => {
  if (list.length && !list.some(s => s.key === species.value)) chooseSpecies(list[0].key)
}, { immediate: true })

const batches = computed(() => BATCH_SIZES.map(n => ({ n, ...birthCost(species.value, ingredient.value, n) })))
const result = computed(() => batches.value[quantity.value - 1])
const price = computed(() => speciesByKey(species.value).price)

const num = value => value.toLocaleString(locale.value, { maximumFractionDigits: 2 })
const unit = computed(() => t(`EconomyBirths.Units.${ingredient.value}`))
// Ce qui se perd est toujours inférieur à un : l'unité s'y écrit au singulier (les ruches ne perdent jamais rien).
const wastedUnit = computed(() => t(`EconomyBirths.UnitsOne.${ingredient.value}`))
const choice = active => (active ? 'odc--gold' : 'odc--slate')

// Ce que le lot coûte au comté : la nourriture PRISE (des unités entières, ce qui dépasse est perdu) au prix de la province, ce
// jour-là — le jour choisi pour l'inscription. Sans province (sans compte ni poste), aucun prix n'est connu.
const recordDay = ref('')
watch(() => book.value?.today, today => { recordDay.value = today ?? '' }, { immediate: true })
const unitPrice = computed(() => {
  if (!province.value) return null
  return feedPrice(book.value.prices, recordDay.value || book.value.today, ingredient.value)
})
const ecus = amount => t('EconomyBirths.History.Ecus', { amount: num(amount) }, ecusChoice(amount, locale.value))
const costLine = computed(() => (unitPrice.value === null
  ? t('EconomyBirths.Record.NoPrice')
  : t('EconomyBirths.FoodCost', {
    real: num(result.value.real), unit: t(`EconomyBirths.UnitsShort.${ingredient.value}`), price: ecus(unitPrice.value), total: ecus(Math.round(result.value.real * unitPrice.value * 100) / 100),
  })))

// Le sac : de la gueule (y = 22) au fond (y = 86) ; il se remplit par le bas de ce qui sert du dernier sac pris.
const SACK = 'M33 22 C18 32 8 50 10 68 C12 82 24 86 40 86 C56 86 68 82 70 68 C72 50 62 32 47 22 Z'
const level = waste => 22 + 64 * waste
</script>

<template>
  <div class="w-full mx-auto text-slate-800 dark:text-slate-800" :class="canReadHistory ? 'max-w-[75rem]' : 'max-w-2xl'">
    <div class="-mt-2 flex flex-col items-center">
      <h1 class="!mt-0 !mb-0 bg-none text-3xl laptop:text-4xl title-eco" data-testid="births-title">
        {{ t('EconomyBirths.PageTitle') }}
      </h1>
      <p class="!m-0 text-center text-sm italic text-slate-700 dark:text-slate-700">{{ t('EconomyBirths.Intro') }}</p>
    </div>

    <!-- Connecté : on attend de savoir quelles espèces montrer, plutôt que d'en retirer sous les yeux. -->
    <AccessLoader v-if="!ready" class="mt-4" top />

    <div v-else class="mt-3 grid grid-cols-1 gap-6" :class="{ 'desktop:grid-cols-[minmax(0,8fr)_minmax(0,7fr)]': canReadHistory }">
    <ReportCard :title="t('EconomyBirths.CalculatorTitle')" tone="gold" fill class="min-w-0">
    <!-- La province n'a réglé aucune espèce : pas de calculateur, le chemin pour les régler. -->
    <div v-if="!offered.length" class="flex flex-col items-start gap-3" data-testid="births-not-configured">
      <p class="!m-0 text-sm text-slate-700 dark:text-slate-700">{{ t('EconomyBirths.NotConfigured', { province: province.name }) }}</p>
      <RouterLink :to="{ name: 'province', params: { section: 'cheptel' } }" class="odc-btn odc-btn--soft odc-btn--sm odc--gold" data-testid="births-configure">
        <v-icon name="fa-cog" aria-hidden="true" />{{ t('EconomyBirths.Configure') }}
      </RouterLink>
    </div>

    <template v-else>
      <!-- Les deux choix : or pour ce qui est choisi, ardoise pour le reste, comme le choix du niveau au Registre des stocks. -->
      <div class="flex flex-col gap-2">
        <div role="group" aria-labelledby="births-species-label" class="flex flex-wrap items-center gap-2">
          <span id="births-species-label" class="w-28 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyBirths.SpeciesLabel') }}</span>
          <button
            v-for="s in offered"
            :key="s.key"
            type="button"
            class="odc-btn odc-btn--soft odc-btn--sm"
            :class="choice(species === s.key)"
            :aria-pressed="species === s.key"
            :data-testid="`births-species-${s.key}`"
            @click="chooseSpecies(s.key)"
          >
            <v-icon v-if="species === s.key" name="fa-check" aria-hidden="true" />{{ t(`EconomyBirths.Species.${s.key}`) }}
          </button>
        </div>

        <div role="group" aria-labelledby="births-ingredient-label" class="flex flex-wrap items-center gap-2">
          <span id="births-ingredient-label" class="w-28 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyBirths.IngredientLabel') }}</span>
          <button
            v-for="key in ingredients"
            :key="key"
            type="button"
            class="odc-btn odc-btn--soft odc-btn--sm"
            :class="choice(ingredient === key)"
            :aria-pressed="ingredient === key"
            :data-testid="`births-ingredient-${key}`"
            @click="ingredient = key"
          >
            <v-icon v-if="ingredient === key" name="fa-check" aria-hidden="true" />{{ t(`EconomyBirths.Ingredients.${key}`) }}
          </button>
        </div>
      </div>

      <!-- Les quatre lots, en cases à l'or des choix : la case EST le choix du nombre d'animaux. -->
      <div role="group" :aria-label="t('EconomyBirths.QuantityLabel')" class="mt-3 grid grid-cols-2 gap-2.5 pb-1.5 tablet:grid-cols-4">
        <button
          v-for="batch in batches"
          :key="batch.n"
          type="button"
          class="birth-lot flex flex-col items-center rounded-lg px-1 py-1.5 text-center"
          :class="{ 'birth-lot--whole': batch.waste === 0 }"
          :aria-pressed="quantity === batch.n"
          :data-testid="`births-quantity-${batch.n}`"
          @click="quantity = batch.n"
        >
          <span class="flex items-center gap-1.5 text-sm font-bold">
            <v-icon v-if="quantity === batch.n" name="fa-check" aria-hidden="true" />{{ t('EconomyBirths.Births', { n: batch.n }, batch.n) }}
          </span>
          <span class="text-2xl font-extrabold leading-tight tabular-nums">{{ num(batch.real) }}</span>
          <span class="lot-unit text-xs leading-tight">{{ unit }}</span>

          <svg viewBox="0 0 80 92" class="my-0.5 h-16 w-[3.5rem]" aria-hidden="true" focusable="false">
            <defs>
              <clipPath :id="`births-sack-${batch.n}`"><path :d="SACK" /></clipPath>
              <pattern :id="`births-lost-${batch.n}`" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#ffffff" />
                <rect width="3" height="7" fill="#dc2626" />
              </pattern>
              <!-- La toile du sac : un tissage, fils clairs et fils sombres sur fond paille. -->
              <pattern :id="`births-weave-${batch.n}`" width="6" height="6" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="#e8b84a" />
                <path d="M0 1.5 H3 M3 4.5 H6" stroke="#b9852a" stroke-width="1.2" />
                <path d="M4.5 0 V3 M1.5 3 V6" stroke="#f6d67f" stroke-width="1.2" />
              </pattern>
            </defs>
            <g :clip-path="`url(#births-sack-${batch.n})`">
              <rect x="0" y="22" width="80" height="64" :fill="`url(#births-lost-${batch.n})`" />
              <rect x="0" :y="level(batch.waste)" width="80" :height="86 - level(batch.waste)" :fill="`url(#births-weave-${batch.n})`" :data-testid="`births-fill-${batch.n}`" />
            </g>
            <path class="sack-line" :d="SACK" fill="none" stroke-width="2.5" stroke-linejoin="round" />
            <path class="sack-line" d="M33 22 L27 9 Q34 13 40 8 Q46 13 53 9 L47 22" :fill="`url(#births-weave-${batch.n})`" stroke-width="2.5" stroke-linejoin="round" />
            <path class="sack-line" d="M30 22 H50" stroke-width="4" stroke-linecap="round" />
          </svg>

          <span class="text-sm font-bold" :class="batch.waste > 0 ? 'lot-lost' : 'lot-kept'" :data-testid="`births-lost-label-${batch.n}`">
            {{ batch.waste > 0 ? t('EconomyBirths.Lost', { waste: num(batch.waste) }) : t('EconomyBirths.NothingLost') }}
          </span>
        </button>
      </div>

      <!-- Le lot choisi : ce qui se perd, ce qu'il coûte, ce qu'il rapporte. -->
      <div class="pt-1 pb-1.5" aria-live="polite" data-testid="births-result">
        <div class="min-w-0 py-2.5">
          <span
            v-if="result.waste > 0"
            class="flex items-center justify-center gap-1.5 text-center text-sm font-bold text-red-700"
            data-testid="births-waste"
          >
            <v-icon name="fa-exclamation-triangle" class="shrink-0" aria-hidden="true" />
            {{ t('EconomyBirths.Waste', { waste: num(result.waste), unit: wastedUnit, n: quantity }, quantity) }}
          </span>
          <span v-else class="flex items-center justify-center gap-1.5 text-sm font-semibold text-green-900" data-testid="births-no-waste">
            <v-icon name="fa-check" class="shrink-0" aria-hidden="true" />{{ t('EconomyBirths.NoWaste') }}
          </span>
        </div>
        <div class="mt-1 flex flex-wrap gap-x-5 text-xs text-slate-600">
          <span v-if="province" class="block" data-testid="births-cost">{{ costLine }}</span>
          <span class="ml-auto block" data-testid="births-price">{{ quantity > 1 ? t('EconomyBirths.PriceMany', { total: ecus(price * quantity), n: quantity, price }) : t('EconomyBirths.Price', { total: ecus(price) }) }}</span>
        </div>
      </div>

      <BirthRecordBar
        v-if="book?.can_record"
        v-model:day="recordDay"
        :book="book"
        :birth="{ species, ingredient, quantity, taken: result.real, wasted: result.waste }"
        :record="record"
        @recorded="onRecorded"
      />
    </template>
    </ReportCard>

    <!-- La mémoire. -->
    <BirthLedger v-if="canReadHistory" :key="characterId" class="min-w-0" :book="book" :api="ledgerApi" :fresh-id="freshId" />
    </div>
  </div>
</template>

<style scoped>
  /* Les cases des lots : claires, et la case choisie en orange foncé. Textes posés ici (règle globale `.dark p`). La part perdue du
     sac est hachurée de rouge. */
  .birth-lot {
    position: relative;
    background: linear-gradient(180deg, #ffffff 0%, #f5efe6 100%);
    border: 1px solid #a16207;
    color: #713f12;
    /* Le relief d'un bouton : reflet en haut, tranche en bas, ombre courte. */
    box-shadow: inset 0 1px 0 #ffffff, 0 4px 0 #a16207, 0 7px 10px -4px rgb(69 26 3 / 0.45);
    transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.15s ease;
  }
  .birth-lot:hover { transform: translateY(-1px); filter: brightness(0.97); box-shadow: inset 0 1px 0 #ffffff, 0 5px 0 #a16207, 0 9px 12px -4px rgb(69 26 3 / 0.45); }
  .birth-lot:active { transform: translateY(3px); box-shadow: inset 0 1px 0 #ffffff, 0 1px 0 #a16207, 0 2px 4px -2px rgb(69 26 3 / 0.45); }
  .lot-unit { color: #854d0e; }
  .lot-lost { color: #b91c1c; }
  .lot-kept { color: #15803d; }
  .sack-line { stroke: #000000; }
  .birth-lot[aria-pressed='true'] { background: linear-gradient(180deg, #a16207 0%, #713f12 100%); border-color: #713f12; color: #ffffff; }
  /* La case choisie reste enfoncée. */
  .birth-lot[aria-pressed='true'],
  .birth-lot[aria-pressed='true']:hover { transform: translateY(3px); filter: none; box-shadow: inset 0 3px 8px rgb(69 26 3 / 0.55), 0 1px 0 #713f12; }
  .birth-lot[aria-pressed='true'] .lot-unit,
  .birth-lot[aria-pressed='true'] .lot-lost { color: #ffffff; }
  .birth-lot[aria-pressed='true'] .lot-kept { color: #bbf7d0; }
  /* Rien de perdu : la case est cernée de vert, tranche comprise, choisie ou non. */
  .birth-lot.birth-lot--whole { border: 2px solid #16a34a; }
  .birth-lot--whole:not([aria-pressed='true']) { box-shadow: inset 0 1px 0 #ffffff, 0 4px 0 #15803d, 0 7px 10px -4px rgb(69 26 3 / 0.45); }
  .birth-lot--whole:not([aria-pressed='true']):hover { box-shadow: inset 0 1px 0 #ffffff, 0 5px 0 #15803d, 0 9px 12px -4px rgb(69 26 3 / 0.45); }
  .birth-lot--whole:not([aria-pressed='true']):active { box-shadow: inset 0 1px 0 #ffffff, 0 1px 0 #15803d, 0 2px 4px -2px rgb(69 26 3 / 0.45); }
  .birth-lot.birth-lot--whole[aria-pressed='true'] { background: linear-gradient(180deg, #15803d 0%, #14532d 100%); border-color: #22c55e; box-shadow: inset 0 3px 8px rgb(5 46 22 / 0.55), 0 1px 0 #14532d; }
  .birth-lot--whole[aria-pressed='true'] .lot-unit { color: #dcfce7; }
  .birth-lot:focus-visible { outline: 3px solid #451a03; outline-offset: 2px; }
</style>
