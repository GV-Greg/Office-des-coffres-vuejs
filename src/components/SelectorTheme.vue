<template>
  <button
    @click="toggleTheme"
    class="relative z-50 p-2 cursor-pointer bg-slate-300 dark:bg-slate-900 hover:bg-slate-600 dark:hover:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600 focus:outline-none"
    :aria-label="t('Common.Theme.Title')"
    type="button"
  >
    <v-icon 
      :name="isDark ? 'ri-moon-fill' : 'ri-sun-fill'" 
      class="w-6 h-6 text-slate-800 dark:text-slate-200"
      scale="1.2"
    />
  </button>
</template>

<script setup>
  import { computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useCookieStore } from '@/stores/cookieStore'

  const { t } = useI18n()
  const cookieStore = useCookieStore()

  const isDark = computed(() => cookieStore.essentialCookies.theme === 'dark')

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
    const currentTheme = cookieStore.essentialCookies.theme
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  })
</script>
