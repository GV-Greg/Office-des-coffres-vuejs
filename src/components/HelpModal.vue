<script setup>
  import { useI18n } from 'vue-i18n'

  defineProps({
    show: { type: Boolean, required: true },
    title: { type: String, required: true },
    purpose: { type: String, default: '' },
    overview: { type: String, default: '' },
    steps: { type: Array, default: () => [] },
  })
  defineEmits(['close'])

  const { t } = useI18n()
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" @click="$emit('close')"></div>
    <div class="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
      <div class="h-1.5 bg-gradient-to-r from-orange-400 to-red-600 shrink-0"></div>
      <div class="p-6 overflow-y-auto">
        <div class="flex items-start justify-between gap-4 mb-5">
          <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <v-icon name="gi-scroll-unfurled" scale="1.2" class="text-orange-500 shrink-0" />
            {{ title }}
          </h3>
          <button
            type="button"
            @click="$emit('close')"
            class="btn-grad-slate shrink-0 p-2 rounded-full"
            :aria-label="t('Common.HelpModal.Close')"
          >
            <v-icon name="fa-times" scale="0.9" />
          </button>
        </div>

        <div v-if="purpose" class="mb-4">
          <h4 class="text-xs font-bold uppercase tracking-wide text-orange-500 mb-1">{{ t('Common.HelpModal.Purpose') }}</h4>
          <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{{ purpose }}</p>
        </div>

        <div v-if="overview" class="mb-5">
          <h4 class="text-xs font-bold uppercase tracking-wide text-orange-500 mb-1">{{ t('Common.HelpModal.Overview') }}</h4>
          <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{{ overview }}</p>
        </div>

        <div v-if="steps.length">
          <h4 class="text-xs font-bold uppercase tracking-wide text-orange-500 mb-3">{{ t('Common.HelpModal.Steps') }}</h4>
          <ol class="relative border-l-2 border-slate-300 dark:border-slate-600 space-y-5">
            <li v-for="(step, i) in steps" :key="i" class="relative pl-6">
              <span class="absolute -left-[0.95rem] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-600 ring-4 ring-white dark:ring-slate-800 text-white text-xs font-bold">
                {{ i + 1 }}
              </span>
              <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{{ step }}</p>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>
