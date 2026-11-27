<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SPECIES, BATCH_SIZES, ingredientsOf, speciesByKey, birthCost } from '@/modules/birthCosts'

/*
  Le Livre des naissances (partie Finances de la Salle des comptes) : un calculateur PUBLIC. On choisit une espèce, UN ingrédient et un
  nombre d'animaux ; l'Office dit ce qu'il faut prévoir et ce qui sera perdu. 🔴 Rien n'est enregistré, ni envoyé : tout est calculé
  dans le navigateur à partir des coûts fixes du jeu (modules/birthCosts.js).

  Mise en page : tout tient sans défiler. Les quatre lots sont côte à côte — la colonne EST le choix du nombre d'animaux — et chacun
  montre son dernier sac, rempli de ce qui sert : la part hachurée est perdue.
*/
const { t, locale } = useI18n()

const species = ref(SPECIES[0].key)
const ingredient = ref(ingredientsOf(SPECIES[0].key)[0])
const quantity = ref(1)

const ingredients = computed(() => ingredientsOf(species.value))

// L'ingrédient suit l'espèce : on le garde s'il lui convient (maïs ou blé d'un animal à l'autre), sinon le premier des siens.
function chooseSpecies(key) {
  species.value = key
  if (!ingredientsOf(key).includes(ingredient.value)) ingredient.value = ingredientsOf(key)[0]
}

const batches = computed(() => BATCH_SIZES.map(n => ({ n, ...birthCost(species.value, ingredient.value, n) })))
const result = computed(() => batches.value[quantity.value - 1])
const price = computed(() => speciesByKey(species.value).price)

const num = value => value.toLocaleString(locale.value, { maximumFractionDigits: 2 })
const unit = computed(() => t(`EconomyBirths.Units.${ingredient.value}`))
// Ce qui se perd est toujours inférieur à un : l'unité s'y écrit au singulier (les ruches ne perdent jamais rien).
const wastedUnit = computed(() => t(`EconomyBirths.UnitsOne.${ingredient.value}`))
const choice = active => (active ? 'odc--gold' : 'odc--violet')

// Le sac : de la gueule (y = 22) au fond (y = 86) ; il se remplit par le bas de ce qui sert du dernier sac pris.
const SACK = 'M33 22 C18 32 8 50 10 68 C12 82 24 86 40 86 C56 86 68 82 70 68 C72 50 62 32 47 22 Z'
const level = waste => 22 + 64 * waste
</script>

<template>
  <div class="w-full max-w-5xl mx-auto">
    <header class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-300 pb-2">
      <h2 class="!mt-0 !mb-0 text-2xl font-bold text-slate-800 dark:text-slate-800">{{ t('EconomyBirths.PageTitle') }}</h2>
      <p class="!m-0 text-sm italic text-slate-600 dark:text-slate-600">{{ t('EconomyBirths.Intro') }}</p>
    </header>

    <!-- Les deux choix, sur la plaque ardoise bordée d'ambre (charte §3.1, matière des plaques du menu). -->
    <div class="births-plate mt-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-2xl px-4 py-3">
      <div role="group" aria-labelledby="births-species-label" class="flex flex-wrap items-center gap-2">
        <span id="births-species-label" class="plate-label mr-1 text-sm font-bold">{{ t('EconomyBirths.SpeciesLabel') }}</span>
        <button
          v-for="s in SPECIES"
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
        <span id="births-ingredient-label" class="plate-label mr-1 text-sm font-bold">{{ t('EconomyBirths.IngredientLabel') }}</span>
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

    <!-- La page du registre : quatre lots, séparés par des filets. La carte reste claire dans les deux thèmes (couleurs fixes). -->
    <div class="mt-4 overflow-hidden rounded-2xl border border-slate-300 bg-white">
      <div role="group" :aria-label="t('EconomyBirths.QuantityLabel')" class="births-ledger grid grid-cols-2 tablet:grid-cols-4">
        <button
          v-for="batch in batches"
          :key="batch.n"
          type="button"
          class="births-lot flex flex-col items-center px-2 pb-3 pt-3 text-center"
          :aria-pressed="quantity === batch.n"
          :data-testid="`births-quantity-${batch.n}`"
          @click="quantity = batch.n"
        >
          <span class="flex items-center gap-1.5 text-sm font-bold text-slate-700">
            <v-icon v-if="quantity === batch.n" name="fa-check" aria-hidden="true" />{{ t('EconomyBirths.Births', { n: batch.n }, batch.n) }}
          </span>
          <span class="births-amount text-4xl font-extrabold leading-tight tabular-nums">{{ num(batch.real) }}</span>
          <span class="text-xs text-slate-600">{{ unit }}</span>

          <svg viewBox="0 0 80 92" class="my-1.5 h-20 w-[4.35rem]" aria-hidden="true" focusable="false">
            <defs>
              <clipPath :id="`births-sack-${batch.n}`"><path :d="SACK" /></clipPath>
              <pattern :id="`births-lost-${batch.n}`" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#ffedd5" />
                <rect width="3" height="7" fill="#ea580c" />
              </pattern>
            </defs>
            <g :clip-path="`url(#births-sack-${batch.n})`">
              <rect x="0" y="22" width="80" height="64" :fill="`url(#births-lost-${batch.n})`" />
              <rect x="0" :y="level(batch.waste)" width="80" :height="86 - level(batch.waste)" fill="#eab308" :data-testid="`births-fill-${batch.n}`" />
            </g>
            <path :d="SACK" fill="none" stroke="#78350f" stroke-width="2.5" stroke-linejoin="round" />
            <path d="M33 22 L27 9 Q34 13 40 8 Q46 13 53 9 L47 22" fill="#fde68a" stroke="#78350f" stroke-width="2.5" stroke-linejoin="round" />
            <path d="M30 22 H50" stroke="#451a03" stroke-width="4" stroke-linecap="round" />
          </svg>

          <span class="text-sm font-bold" :class="batch.waste > 0 ? 'text-orange-800' : 'text-green-800'" :data-testid="`births-lost-label-${batch.n}`">
            {{ batch.waste > 0 ? t('EconomyBirths.Lost', { waste: num(batch.waste) }) : t('EconomyBirths.NothingLost') }}
          </span>
        </button>
      </div>

      <!-- Le lot choisi, en une phrase. -->
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-slate-300 px-4 py-3" aria-live="polite" data-testid="births-result">
        <div class="min-w-0">
          <span class="block text-base font-bold text-slate-800" data-testid="births-real">
            {{ t('EconomyBirths.Summary', { n: quantity, real: num(result.real), unit }, quantity) }}
          </span>
          <span
            v-if="result.waste > 0"
            class="flex items-center gap-1.5 text-sm font-semibold text-orange-900"
            data-testid="births-waste"
          >
            <v-icon name="fa-exclamation-triangle" class="shrink-0" aria-hidden="true" />
            {{ t('EconomyBirths.Waste', { waste: num(result.waste), unit: wastedUnit, n: quantity }, quantity) }}
          </span>
          <span v-else class="flex items-center gap-1.5 text-sm font-semibold text-green-900" data-testid="births-no-waste">
            <v-icon name="fa-check" class="shrink-0" aria-hidden="true" />{{ t('EconomyBirths.NoWaste') }}
          </span>
        </div>
        <div class="text-sm text-slate-700">
          <span class="block" data-testid="births-theoretical">{{ t('EconomyBirths.Theoretical', { amount: num(result.theoretical) }) }}</span>
          <span class="block" data-testid="births-price">{{ t('EconomyBirths.Price', { price }) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* Plaque ardoise bordée d'ambre : mêmes matières que les plaques du menu circulaire et du registre (charte §3.1). */
  .births-plate {
    background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #d97706;
    box-shadow: inset 0 1px 0 rgb(253 230 138 / 0.18), 0 6px 16px -8px rgb(69 26 3 / 0.55);
  }
  .plate-label { color: #fde68a; }

  /* Les filets entre les lots ; deux colonnes sur petit écran. */
  .births-lot { border-top: 4px solid transparent; transition: background-color 0.15s ease; }
  .births-lot:nth-child(even) { border-left: 1px solid #cbd5e1; }
  .births-lot:nth-child(n + 3) { box-shadow: inset 0 1px 0 #cbd5e1; }
  @media (min-width: 640px) {
    .births-lot + .births-lot { border-left: 1px solid #cbd5e1; }
    .births-lot:nth-child(n + 3) { box-shadow: none; }
  }
  .births-amount { color: #334155; }
  .births-lot:hover { background-color: #fffbeb; }
  /* Le lot choisi : liseré or en tête, fond chaud, chiffre brun. */
  .births-lot[aria-pressed='true'] { background-color: #fef3c7; border-top-color: #d97706; }
  .births-lot[aria-pressed='true'] .births-amount { color: #78350f; }
  /* L'anneau de focus reste dans la colonne (le cadre coupe ce qui dépasse). */
  .births-lot:focus-visible { outline: 3px solid #451a03; outline-offset: -5px; }
</style>
