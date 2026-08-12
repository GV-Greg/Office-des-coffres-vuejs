<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import useNavigationLoading from '@/use/useNavigationLoading'

const { t } = useI18n()
const { isNavigationLoading, navigationContext } = useNavigationLoading()

const iconName = computed(() => navigationContext.value === 'chest' ? 'gi-chest' : 'gi-medieval-pavilion')
const loadingText = computed(() => t(navigationContext.value === 'chest' ? 'Common.LoadingChest' : 'Common.LoadingOffice'))
</script>

<template>
  <Transition name="loading-fade">
    <div
      v-if="isNavigationLoading"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-200/95 dark:bg-slate-800/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div class="relative flex h-40 w-40 items-center justify-center">
        <div
          class="chest-glow absolute h-32 w-32 rounded-full blur-2xl bg-[radial-gradient(circle,rgba(251,191,36,0.55)_0%,rgba(234,88,12,0.35)_45%,transparent_70%)]"
        />
        <v-icon
          :name="iconName"
          scale="6"
          class="chest-icon relative text-orange-500 dark:text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]"
        />
      </div>
      <p class="text-slate-800 dark:text-slate-200 text-lg font-medium italic">
        {{ loadingText }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 150ms ease;
}
.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

.chest-icon {
  animation: chest-bounce 1.1s infinite;
}

.chest-glow {
  animation: chest-glow-pulse 2.4s ease-in-out infinite;
  animation-delay: -0.6s;
}

@keyframes chest-bounce {
  0%, 100% {
    transform: translateY(-12%) scale(1.05);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(0) scale(1);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}

@keyframes chest-glow-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 0.8; transform: scale(1.15); }
}

@media (prefers-reduced-motion: reduce) {
  .chest-icon,
  .chest-glow {
    animation: none;
  }
}
</style>
