<script setup>
  import { ref, computed, onMounted, provide } from 'vue'
  import { RouterLink, RouterView } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'
  import useDecodeActivities from '@/use/useDecodeActivities'

  /*
    Module Animation (brief admin/modules/animation/brief-coffres-scelles.md ; spécification à jour : tour 12 du fil
    animation-coffres-scelles). Coquille du module : un menu à gauche et la page à droite.

    Le menu ne porte QUE les liens des pages du module — aujourd'hui « Décode le code » seule. Les gestes d'une activité (organiser sans
    compte, retrouver la sienne, mes activités) vivent sur la page de l'activité, pas ici. Le titre du module ramène à son ACCUEIL
    (AnimationHomeView : une carte par activité), que chaque module aura sur le même modèle (ModuleHomeCards).

    Le serveur dit quelles activités sont ouvertes (les types désactivés ne s'affichent pas) : la liste est chargée UNE fois ici, pour le
    menu, et passée à l'accueil par `provide` — pas de seconde requête. Ajouter une activité = une ligne dans TYPE_ROUTES, sans refaire
    cette page.
  */
  const { t } = useI18n()
  const api = useDecodeActivities()

  // clé de type (serveur) → route de la page de l'activité. Une clé inconnue du site n'est pas affichée.
  const TYPE_ROUTES = { decode: 'animation-decode' }

  const types = ref([])
  const links = computed(() => types.value.filter(key => TYPE_ROUTES[key]).map(key => ({ key, route: TYPE_ROUTES[key] })))
  const typesReady = ref(false)
  provide('animationTypes', types)
  provide('animationTypesReady', typesReady)

  onMounted(async () => {
    try {
      types.value = await api.types()
    } catch {
      types.value = [] // sans réponse, on n'affiche pas un type peut-être fermé
    } finally {
      typesReady.value = true
    }
  })
</script>

<template>
  <div class="page-card">
    <div class="w-full flex flex-col laptop:flex-row flex-grow mb-2">
      <div class="w-full laptop:w-52 laptop:shrink-0 flex flex-col justify-start text-teal-600">
        <h3 class="text-center">
          <RouterLink :to="{ name: 'animation' }" data-testid="anim-home-link">{{ t('Animation.Title') }}</RouterLink>
        </h3>
        <RouterLink
          v-for="link in links"
          :key="link.key"
          :to="{ name: link.route }"
          class="inline-flex items-center font-bold"
          :data-testid="`anim-type-${link.key}`"
        >
          <v-icon name="gi-chest" scale="2" class="mr-1" aria-hidden="true" />
          {{ t(`Animation.Types.${link.key}.Name`) }}
        </RouterLink>
      </div>
      <div class="w-full laptop:w-auto laptop:flex-1 laptop:min-w-0 mt-2 laptop:mt-0 laptop:ml-2 p-1">
        <RouterView />
      </div>
    </div>
    <NavMenu />
  </div>
</template>
