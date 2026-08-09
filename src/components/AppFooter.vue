<script setup>
import { useI18n } from 'vue-i18n';
import { useCookieStore } from '@/stores/cookieStore';

const { t } = useI18n();
const cookieStore = useCookieStore();
</script>

<template>
  <footer class="w-full bg-slate-300 dark:bg-slate-900 px-4 py-3">
    <div class="max-w-screen-lg mx-auto flex flex-row items-center justify-between gap-4">
      <span class="text-sm text-slate-700 dark:text-slate-200">{{ t('Common.SiteName') }}</span>
      <button
        type="button"
        class="btn btn-grad-slate btn-sm"
        @click="cookieStore.openPreferencesModal()"
      >
        {{ t('Cookies.Button.Preferences') }}
      </button>
    </div>
  </footer>
</template>
