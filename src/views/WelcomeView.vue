<script setup>
import { useRouter } from 'vue-router'
import SettingsMenu from '@/components/SettingsMenu.vue'
const router = useRouter()
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Settings Menu -->
    <div class="absolute top-4 right-4">
      <SettingsMenu />
    </div>

    <!-- Main Content -->
    <div class="flex flex-col items-center px-4 pt-16 sm:pt-24">
      <div class="max-w-4xl w-full space-y-12">
        <div class="text-center">
          <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600 mb-6">
            Office des coffres
          </h1>
        </div>

        <div class="flex flex-col items-center space-y-8">
          <button 
            @click="router.push('/login')"
            class="inline-flex items-center justify-center"
          >
            <v-icon 
              name="bi-shield-lock-fill" 
              scale="10" 
              animation="ring" 
              hover 
              class="text-slate-800 dark:text-slate-200"
            />
          </button>
          
          <div class="animate-bounce grid grid-cols-1 justify-items-center">
            <div class="transform rotate-225">
              <v-icon name="gi-broadhead-arrow" scale="2" class="text-slate-800 dark:text-slate-200" />
            </div>
            <p class="text-slate-800 dark:text-slate-200 text-lg font-medium">
              click
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-h-screen {
  min-height: calc(100vh - 2rem);
}
</style>