<script setup>
import { inject, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ModuleHomeCards from '@/components/ModuleHomeCards.vue'
import ChestLoader from '@/components/loading/ChestLoader.vue'

const { t } = useI18n()

const access = inject('economyAccess', null)
const ready = inject('economyAccessReady', true)

const canAccessMandateTools = computed(() => !!(access?.value?.read || access?.value?.write))

const items = computed(() => {
  const cards = [
    {
      key: 'mines',
      title: t('Economy.Cards.mines.Name'),
      description: t('Economy.Cards.mines.Description'),
      to: { name: 'economy-mines' },
      icon: 'gi-chest',
    },
    {
      key: 'inventory',
      title: t('Economy.Cards.inventory.Name'),
      description: t('Economy.Cards.inventory.Description'),
      to: { name: 'economy-inventory' },
      icon: 'gi-tied-scroll',
    },
  ]

  if (canAccessMandateTools.value) {
    cards.push({
      key: 'registry',
      title: t('Economy.Cards.registry.Name'),
      description: t('Economy.Cards.registry.Description'),
      to: { name: 'economy-registry' },
      icon: 'gi-scroll-unfurled',
    })
  }

  return cards
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto">
    <header class="text-center mb-6">
      <h2 class="!mt-0 !mb-1 text-4xl tablet:text-5xl font-extrabold tracking-tight text-yellow-800 dark:text-yellow-800">{{ t('Economy.Home.Title') }}</h2>
      <div class="flex items-center justify-center gap-3 text-yellow-700 dark:text-yellow-700" aria-hidden="true">
        <span class="h-px w-16 bg-yellow-700/40"></span>
        <v-icon name="gi-crown-coin" scale="1.4" />
        <span class="h-px w-16 bg-yellow-700/40"></span>
      </div>
      <p class="!mt-1 !mb-0 text-base tablet:text-lg tablet:whitespace-nowrap italic leading-relaxed text-slate-600 dark:text-slate-600">{{ t('Economy.Home.Intro') }}</p>
    </header>

    <ChestLoader :loading="!ready" accent="gold" illustration="gate">
      <ModuleHomeCards
        v-if="items.length > 0"
        :items="items"
        accent="gold"
        testid="economy-home-cards"
      />
      <p v-else class="text-center text-sm text-slate-400 dark:text-slate-500 italic py-6">
        {{ t('Economy.Home.Empty') }}
      </p>
    </ChestLoader>
  </div>
</template>
