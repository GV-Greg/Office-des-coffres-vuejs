<script setup>
  import NavMenu from '../components/NavMenu.vue'
  import { ref } from 'vue'
  import { useCookieStore } from '@/stores/cookieStore'

  const cookieStore = useCookieStore()
  const canUserLogin = computed(() => cookieStore.canUserLogin)
</script>

<template>
  <div class="page-container">
    <!-- Header -->
    <header class="page-header">
      <div class="page-header-content">
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Office des coffres</h1>
      </div>
    </header>

    <!-- Main content -->
    <main class="page-content">
      <div class="flex flex-col md:flex-row">
        <!-- Menu de navigation -->
        <NavMenu class="md:w-1/4 mb-6 md:mb-0" />

        <!-- Contenu principal -->
        <div class="md:w-3/4 md:pl-6">
          <h2 class="text-2xl font-bold mb-4">
            L'<span class="text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">
              Office des coffres
            </span> vous souhaite la bienvenue !
          </h2>
          <p class="text-slate-600 dark:text-slate-400 mb-4">
            Elle met à disposition des coffres qui vous aideront dans certaines tâches liées à l'animation, à la sécurité ou à l'économie.
          </p>
          <p class="text-blue-500 font-bold mt-10 italic text-center">
            L'Office est actuellement en construction...
          </p>

          <div class="form-container">
            <!-- Message si cookies de session non acceptés -->
            <div v-if="!canUserLogin" class="text-center p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <p class="text-sm text-yellow-800 dark:text-yellow-200">
                Veuillez accepter les cookies de session pour vous connecter
              </p>
            </div>

            <!-- Formulaire -->
            <form @submit.prevent="login" class="space-y-4">
              <div class="form-group">
                <label for="email" class="form-label text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                  :disabled="!canUserLogin"
                />
              </div>

              <div class="form-group">
                <label for="password" class="form-label text-sm font-medium text-slate-700 dark:text-slate-300">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                  :disabled="!canUserLogin"
                />
              </div>

              <button
                type="submit"
                :disabled="!canUserLogin"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
              >
                Se connecter
              </button>
            </form>

            <!-- Liens -->
            <div class="text-center space-y-2 mt-4">
              <a href="#" class="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                Mot de passe oublié ?
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
  .page-container {
    @apply flex flex-col min-h-screen;
  }

  .page-header {
    @apply bg-white dark:bg-slate-800 shadow-sm;
  }

  .page-header-content {
    @apply container mx-auto px-4 py-2;
  }

  .page-content {
    @apply flex-grow container mx-auto px-4 py-6;
  }

  .form-container {
    @apply w-full max-w-md mx-auto p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md;
  }

  .form-group {
    @apply space-y-4;
  }

  .form-label {
    @apply block text-sm font-medium text-slate-700 dark:text-slate-300;
  }

  .form-input {
    @apply mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400
    focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600;
  }

  .btn {
    @apply w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white;
  }

  .btn-primary {
    @apply bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800;
  }

  .btn-link {
    @apply text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300;
  }
</style>