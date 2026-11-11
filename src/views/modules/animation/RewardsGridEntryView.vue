<script setup>
  import { useI18n } from 'vue-i18n'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'
  import RewardsStartPanel from '@/components/anim/RewardsStartPanel.vue'

  /*
    Grille des lots — PAGE D'ENTRÉE au sein de l'application (/app/anim/grille). Montre l'encadré
    sombre RewardsGridHero en tête, puis le panneau « Votre grille » (RewardsStartPanel, 3/4) qui
    route selon le contexte : connecté, anonyme, adresse mémorisée. Même structure que
    DecodeActivityView en mode « sans adresse » : Hero + col-span-3/1.
  */
  const { t } = useI18n()
</script>

<template>
  <div class="w-full">
    <RewardsGridHero
      :title="t('Animation.Types.rewards.Name')"
      :divider="false"
      title-testid="rewards-entry-title"
      visual-testid="rewards-entry-visual"
      class="mb-5"
    />

    <div class="grid gap-5 laptop:grid-cols-4 items-start">
      <div class="laptop:col-span-3">
        <RewardsStartPanel />
      </div>
      <!-- Colonne droite : aide rapide sur la mécanique -->
      <section class="laptop:col-span-1 rounded-xl border border-slate-300 bg-white p-4 text-slate-800 dark:text-slate-800" data-testid="rewards-entry-how">
        <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-teal-700 to-green-600">{{ t('Animation.Rewards.HowTitle') }}</h3>
        <ol class="!my-0 space-y-1.5 text-sm text-slate-700 dark:text-slate-700 pl-4 list-decimal">
          <li>{{ t('Animation.Rewards.HowStep1') }}</li>
          <li>{{ t('Animation.Rewards.HowStep2') }}</li>
          <li>{{ t('Animation.Rewards.HowStep3') }}</li>
          <li>{{ t('Animation.Rewards.HowStep4') }}</li>
        </ol>
      </section>
    </div>
  </div>
</template>
