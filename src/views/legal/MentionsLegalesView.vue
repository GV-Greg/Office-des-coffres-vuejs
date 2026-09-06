<script setup>
  import { computed } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import { goBackOrWelcome } from '@/modules/goBackOrWelcome'

  const { t, locale } = useI18n()
  const router = useRouter()

  // Obfuscation `[at]` uniquement nécessaire dans le JSON source (voir project_vue_i18n_at_symbol_bug).
  const contactEmail = computed(() => t('Legal.Common.Contact.Email').replace('[at]', '@'))

  // Date de dernière publication du contenu de cette page — à mettre à jour manuellement
  // à chaque modification substantielle (voir admin/content/policy-mentions-legales-draft.md).
  const LAST_UPDATED = '2026-09-06'
  const lastUpdated = computed(() => new Intl.DateTimeFormat(
    locale.value === 'fr' ? 'fr-FR' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  ).format(new Date(LAST_UPDATED)))
</script>

<template>
  <div class="page-container relative min-h-screen">
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>

    <div class="flex flex-col items-center px-4 pt-16 tablet:pt-24 pb-16">
      <div class="max-w-3xl w-full space-y-6">
        <button
          type="button"
          class="inline-block text-slate-300 hover:text-white dark:text-slate-400 dark:hover:text-slate-100 text-sm"
          @click="goBackOrWelcome(router)"
        >
          &larr; {{ t('Common.SiteName') }}
        </button>

        <h1>{{ t('Legal.Mentions.PageTitle') }}</h1>

        <div
          data-testid="mentions-legales-content"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 tablet:p-10 space-y-8"
        >
          <p>{{ t('Legal.Mentions.Preamble') }}</p>

          <section>
            <h3>{{ t('Legal.Mentions.Section1.Title') }}</h3>
            <ul class="list-none space-y-1">
              <li><strong>{{ t('Legal.Common.Contact.NameLabel') }}</strong> : {{ t('Legal.Common.Contact.Name') }}</li>
              <li><strong>{{ t('Legal.Common.Contact.AddressLabel') }}</strong> : {{ t('Legal.Common.Contact.Address') }}</li>
              <li>
                <strong>{{ t('Legal.Common.Contact.EmailLabel') }}</strong> :
                <a :href="`mailto:${contactEmail}`" class="underline text-blue-600 dark:text-blue-400">{{ contactEmail }}</a>
              </li>
              <li><strong>{{ t('Legal.Mentions.Section1.StatusLabel') }}</strong> : {{ t('Legal.Mentions.Section1.Status') }}</li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Mentions.Section2.Title') }}</h3>
            <ul class="list-none space-y-1">
              <li><strong>{{ t('Legal.Mentions.Section2.HostNameLabel') }}</strong> : {{ t('Legal.Mentions.Section2.HostName') }}</li>
              <li><strong>{{ t('Legal.Mentions.Section2.HostAddressLabel') }}</strong> : {{ t('Legal.Mentions.Section2.HostAddress') }}</li>
              <li>
                <strong>{{ t('Legal.Mentions.Section2.HostWebsiteLabel') }}</strong> :
                <a
                  href="https://www.o2switch.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline text-blue-600 dark:text-blue-400"
                >o2switch.fr</a>
              </li>
              <li><strong>{{ t('Legal.Mentions.Section2.HostTypeLabel') }}</strong> : {{ t('Legal.Mentions.Section2.HostType') }}</li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Mentions.Section3.Title') }}</h3>
            <p>{{ t('Legal.Mentions.Section3.Content') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Mentions.Section4.Title') }}</h3>
            <p>{{ t('Legal.Mentions.Section4.Content') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Mentions.Section5.Title') }}</h3>
            <p>
              <i18n-t keypath="Legal.Mentions.Section5.Content" scope="global">
                <template #frontendRepoLink>
                  <a
                    href="https://github.com/GV-Greg/Office-des-coffres-vuejs"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline text-blue-600 dark:text-blue-400"
                  >Office-des-coffres-vuejs</a>
                </template>
                <template #backendRepoLink>
                  <a
                    href="https://github.com/GV-Greg/Office-des-coffres-backend"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline text-blue-600 dark:text-blue-400"
                  >Office-des-coffres-backend</a>
                </template>
              </i18n-t>
            </p>
          </section>

          <section>
            <h3>{{ t('Legal.Mentions.Section6.Title') }}</h3>
            <p>{{ t('Legal.Mentions.Section6.Intro') }}</p>
            <ul class="list-disc list-inside space-y-1 mt-2">
              <li>
                <RouterLink
                  :to="{ name: 'legal-privacy' }"
                  data-testid="privacy-policy-link"
                  class="italic underline text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >{{ t('Legal.Privacy.PageTitle') }}</RouterLink>
              </li>
              <li>
                <RouterLink
                  :to="{ name: 'legal-cookies' }"
                  data-testid="cookies-policy-link"
                  class="italic underline text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >{{ t('Legal.Cookies.PageTitle') }}</RouterLink>
              </li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Mentions.Section7.Title') }}</h3>
            <p>
              <i18n-t keypath="Legal.Mentions.Section7.Content" scope="global">
                <template #email>
                  <a :href="`mailto:${contactEmail}`" class="underline text-blue-600 dark:text-blue-400">{{ contactEmail }}</a>
                </template>
              </i18n-t>
            </p>
          </section>

          <p class="text-sm text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-600">
            {{ t('Legal.Mentions.LastUpdated', { date: lastUpdated }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
