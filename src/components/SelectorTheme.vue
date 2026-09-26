<template>
  <button
    @click="toggleTheme"
    class="odc-btn odc-btn--soft odc-btn--rect odc-btn--icon odc--slate z-50"
    :aria-label="t('Common.Theme.Title')"
    type="button"
  >
    <v-icon :name="isDark ? 'ri-moon-fill' : 'ri-sun-fill'" />
  </button>
</template>

<script setup>
  import { computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useCookieStore } from '@/stores/cookieStore'

  const { t } = useI18n()
  const cookieStore = useCookieStore()

  const isDark = computed(() => cookieStore.comfortData.theme === 'dark')

  const toggleTheme = () => {
    console.log('Toggle theme clicked')
    const newTheme = isDark.value ? 'light' : 'dark'
    cookieStore.setTheme(newTheme)

    // Appliquer le thème à l'élément racine
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
  }

  onMounted(() => {
    console.log('Theme component mounted')
    const currentTheme = cookieStore.comfortData.theme
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })
</script>
