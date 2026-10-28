<script setup>
  import { computed, inject, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import ModuleHomeCards from '@/components/ModuleHomeCards.vue'
  import ChestLoader from '@/components/loading/ChestLoader.vue'
  import DecodeCodeVisual from '@/components/anim/DecodeCodeVisual.vue'

  /*
    Accueil du module Animation : un titre centré, puis une carte par ACTIVITÉ ouverte, avec son nom et son descriptif. Le serveur dit
    quelles activités sont ouvertes (types désactivés absents) ; la liste est chargée une seule fois par MainAnimation (le menu de gauche)
    et passée ici par `provide` — pas de seconde requête. Ajouter une activité = une ligne dans ACTIVITIES, avec ses textes dans les locales.
    Titre : h2 sur la carte claire, en teinte du module (teal-800, 7,6:1) ; le sous-titre en slate-600 (≥ 4,5:1) ; filet orné d'un coffre.
  */
  const { t } = useI18n()
  const openTypes = inject('animationTypes', null)
  const ready = inject('animationTypesReady', ref(true)) // la liste des types n'est pas encore connue : le coffre s'ouvre

  // clé de type (serveur) → page de l'activité. Une clé que le site ne connaît pas n'est pas affichée.
  const ACTIVITIES = { decode: 'animation-decode' }

  const items = computed(() => (openTypes?.value ?? [])
    .filter(key => ACTIVITIES[key])
    .map(key => ({
      key,
      title: t(`Animation.Types.${key}.Name`),
      description: t(`Animation.Types.${key}.Description`),
      to: { name: ACTIVITIES[key] },
      icon: 'gi-chest', // l'icône du jeu, la même que dans le menu de gauche
      action: t('Animation.Home.Open'),
    })))
</script>

<template>
  <div class="w-full max-w-4xl mx-auto">
    <header class="text-center mb-6">
      <h2 class="!mt-0 !mb-1 text-4xl tablet:text-5xl font-extrabold tracking-tight text-teal-800 dark:text-teal-800" data-testid="animation-home-title">{{ t('Animation.Home.Title') }}</h2>
      <div class="flex items-center justify-center gap-3 text-teal-700 dark:text-teal-700" aria-hidden="true">
        <span class="h-px w-16 bg-teal-700/40"></span>
        <v-icon name="gi-rolling-dice-cup" scale="1.4" />
        <span class="h-px w-16 bg-teal-700/40"></span>
      </div>
      <p class="!mt-1 !mb-0 text-base tablet:text-lg tablet:whitespace-nowrap italic leading-relaxed text-slate-600 dark:text-slate-600" data-testid="animation-home-intro">{{ t('Animation.Home.Intro') }}</p>
    </header>

    <ChestLoader :loading="!ready" accent="teal" illustration="gate">
    <p v-if="!items.length" class="text-center text-sm text-slate-700 dark:text-slate-700" data-testid="animation-home-empty">{{ t('Animation.Home.Empty') }}</p>
    <ModuleHomeCards v-else :items="items" accent="teal" testid="animation-cards">
      <!-- Visuel propre à « Décode le code » : les cinq cases de la combinaison, encore scellées. Décoratif. -->
      <template #visual-decode>
        <DecodeCodeVisual />
      </template>
    </ModuleHomeCards>
    </ChestLoader>
  </div>
</template>
