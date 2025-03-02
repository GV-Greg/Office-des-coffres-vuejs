<template>
  <button
    @click="toggleLocale"
    class="relative z-50 px-3 py-2 cursor-pointer bg-slate-300 dark:bg-slate-900 hover:bg-slate-600 dark:hover:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600 focus:outline-none"
    :aria-label="t('Common.Language.Title')"
    type="button"
  >
    <span class="w-6 h-6 text-slate-800 dark:text-slate-200 font-bold">
      {{ currentLocale.toUpperCase() }}
    </span>
  </button>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCookieStore } from '@/stores/cookieStore'

const { t, locale } = useI18n()
const cookieStore = useCookieStore()

const isCurrentFrench = computed(() => locale.value === 'fr')
const currentLocale = computed(() => isCurrentFrench.value ? 'FR' : 'EN')

const applyLocale = (newLocale) => {
  console.log('Applying locale:', newLocale)
  locale.value = newLocale
  cookieStore.setLocale(newLocale)
}

const toggleLocale = () => {
  console.log('Current locale:', locale.value)
  const newLocale = isCurrentFrench.value ? 'en' : 'fr'
  console.log('Switching to:', newLocale)
  applyLocale(newLocale)
}

onMounted(() => {
  const savedLocale = cookieStore.essentialCookies.locale || 'fr'
  console.log('Initial locale:', savedLocale)
  if (['fr', 'en'].includes(savedLocale)) {
    applyLocale(savedLocale)
  }
})
</script>
