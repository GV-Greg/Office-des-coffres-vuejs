<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { RouterLink, RouterView } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import NavMenu from '../../../components/NavMenu.vue'
  import { useAuthStore } from '@/stores/authStore'
  import useDecodeActivities from '@/use/useDecodeActivities'

  /*
    Module Animation (brief admin/modules/animation/brief-coffres-scelles.md). Une colonne de liens, comme
    l'Économie : un lien par TYPE D'ACTIVITÉ ouvert (le serveur dit lesquels, les types désactivés ne s'affichent
    pas) et, connecté, « Mes activités ». Ajouter une activité plus tard = une ligne dans TYPE_ROUTES, sans
    refaire cette page.
  */
  const { t } = useI18n()
  const authStore = useAuthStore()
  const api = useDecodeActivities()

  // clé de type (serveur) → route de sa page publique. Une clé inconnue du site n'est pas affichée.
  const TYPE_ROUTES = { decode: 'animation-decode' }

  const types = ref([])
  const links = computed(() => types.value.filter(key => TYPE_ROUTES[key]).map(key => ({ key, route: TYPE_ROUTES[key] })))

  onMounted(async () => {
    try {
      types.value = await api.types()
    } catch {
      types.value = [] // sans réponse, on n'affiche pas un type peut-être fermé
    }
  })
</script>

<template>
  <div class="page-card">
    <div class="w-full flex flex-col laptop:flex-row flex-grow mb-2">
      <div class="w-full laptop:w-52 laptop:shrink-0 flex flex-col justify-start text-teal-600">
        <h3 class="text-center">{{ t('Animation.Title') }}</h3>
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
        <RouterLink
          v-if="authStore.isLoggedIn"
          :to="{ name: 'animation-mine' }"
          class="inline-flex items-center font-bold mt-2"
          data-testid="anim-mine-link"
        >
          <v-icon name="fa-user-edit" scale="1.2" class="mr-2" aria-hidden="true" />
          {{ t('Animation.MyActivitiesLink') }}
        </RouterLink>
        <p class="mt-3 text-xs text-slate-600 dark:text-slate-600">{{ t('Animation.MenuHelp') }}</p>
      </div>
      <div class="w-full laptop:w-auto laptop:flex-1 laptop:min-w-0 mt-2 laptop:mt-0 laptop:ml-2 p-1">
        <RouterView />
      </div>
    </div>
    <NavMenu />
  </div>
</template>
