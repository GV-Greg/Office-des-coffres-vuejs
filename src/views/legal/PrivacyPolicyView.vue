<script setup>
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'

  const { t, tm, locale } = useI18n()

  // Date de dernière publication du contenu de cette politique — à mettre à jour manuellement
  // à chaque modification substantielle (voir Legal.Privacy.Section10 / draft
  // admin/content/policy-privacy-draft.md).
  const LAST_UPDATED = '2026-08-11'
  const lastUpdated = computed(() => new Intl.DateTimeFormat(
    locale.value === 'fr' ? 'fr-FR' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  ).format(new Date(LAST_UPDATED)))

  const accountFields = computed(() => tm('Legal.Privacy.Section3.AccountFields'))
  const characterFields = computed(() => tm('Legal.Privacy.Section3.CharacterFields'))
  const dataRows = computed(() => tm('Legal.Privacy.Section4.Rows'))
  const rights = computed(() => tm('Legal.Privacy.Section7.Rights'))
  const measures = computed(() => tm('Legal.Privacy.Section8.Measures'))
</script>

<template>
  <div class="page-container relative min-h-screen">
    <div class="absolute top-4 right-4">
      <SelectorMenu />
    </div>

    <div class="flex flex-col items-center px-4 pt-16 tablet:pt-24 pb-16">
      <div class="max-w-3xl w-full space-y-6">
        <RouterLink
          :to="{ name: 'welcome' }"
          class="inline-block text-slate-300 hover:text-white dark:text-slate-400 dark:hover:text-slate-100 text-sm"
        >
          &larr; {{ t('Common.SiteName') }}
        </RouterLink>

        <h1>{{ t('Legal.Privacy.PageTitle') }}</h1>

        <div
          data-testid="privacy-policy-content"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 tablet:p-10 space-y-8"
        >
          <p>
            <i18n-t keypath="Legal.Privacy.Preamble" scope="global">
              <template #cookiesLink>
                <RouterLink
                  :to="{ name: 'legal-cookies' }"
                  data-testid="cookies-policy-link"
                  class="italic underline text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >{{ t('Legal.Privacy.CookiesPolicyLink') }}</RouterLink>
              </template>
            </i18n-t>
          </p>

          <section>
            <h3>{{ t('Legal.Privacy.Section1.Title') }}</h3>
            <p>{{ t('Legal.Privacy.Section1.Content') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section2.Title') }}</h3>
            <ul class="list-none space-y-1">
              <li><strong>{{ t('Legal.Common.Contact.NameLabel') }}</strong> : {{ t('Legal.Common.Contact.Name') }}</li>
              <li><strong>{{ t('Legal.Common.Contact.AddressLabel') }}</strong> : {{ t('Legal.Common.Contact.Address') }}</li>
              <li><strong>{{ t('Legal.Common.Contact.EmailLabel') }}</strong> : {{ t('Legal.Common.Contact.Email') }}</li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section3.Title') }}</h3>
            <p>{{ t('Legal.Privacy.Section3.Intro') }}</p>

            <p class="mt-4">{{ t('Legal.Privacy.Section3.AccountFieldsIntro') }}</p>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="(field, index) in accountFields" :key="`account-${index}`">
                <strong>{{ field.Label }}</strong> — {{ field.Text }}
              </li>
            </ul>

            <p class="mt-4">{{ t('Legal.Privacy.Section3.CharacterFieldsIntro') }}</p>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="(field, index) in characterFields" :key="`character-${index}`">
                <strong>{{ field.Label }}</strong> — {{ field.Text }}
              </li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section4.Title') }}</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-600">
                    <th class="text-left py-2 pr-4">{{ t('Legal.Privacy.Section4.Headers.Data') }}</th>
                    <th class="text-left py-2 pr-4">{{ t('Legal.Privacy.Section4.Headers.Purpose') }}</th>
                    <th class="text-left py-2">{{ t('Legal.Privacy.Section4.Headers.LegalBasis') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in dataRows"
                    :key="index"
                    class="border-b border-slate-100 dark:border-slate-700"
                  >
                    <td class="py-2 pr-4">{{ row.Data }}</td>
                    <td class="py-2 pr-4">{{ row.Purpose }}</td>
                    <td class="py-2">{{ row.LegalBasis }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-4">{{ t('Legal.Privacy.Section4.NoCommercialUse') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section5.Title') }}</h3>
            <ul class="list-disc list-inside space-y-2">
              <li>{{ t('Legal.Privacy.Section5.ActiveAccount') }}</li>
              <li>{{ t('Legal.Privacy.Section5.InactiveAccount') }}</li>
              <li>{{ t('Legal.Privacy.Section5.DeletedAccount') }}</li>
              <li>{{ t('Legal.Privacy.Section5.TechnicalLogs') }}</li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section6.Title') }}</h3>
            <ul class="list-disc list-inside space-y-2">
              <li>{{ t('Legal.Privacy.Section6.Yourself') }}</li>
              <li>{{ t('Legal.Privacy.Section6.Editor') }}</li>
              <li>{{ t('Legal.Privacy.Section6.NoOneElse') }}</li>
            </ul>
            <p class="mt-4">{{ t('Legal.Privacy.Section6.Hosting') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section7.Title') }}</h3>
            <p>{{ t('Legal.Privacy.Section7.Intro') }}</p>
            <ul class="list-disc list-inside space-y-1 mt-2">
              <li v-for="(right, index) in rights" :key="index">
                <strong>{{ right.Label }}</strong> — {{ right.Text }}
              </li>
              <li>
                <i18n-t keypath="Legal.Privacy.Section7.Complaint" scope="global">
                  <template #cnilLink>
                    <a
                      href="https://www.cnil.fr"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="underline text-blue-600 dark:text-blue-400"
                    >CNIL</a>
                  </template>
                </i18n-t>
              </li>
            </ul>
            <p class="mt-4">
              <i18n-t keypath="Legal.Privacy.Section7.HowToExercise" scope="global">
                <template #email>{{ t('Legal.Common.Contact.Email') }}</template>
              </i18n-t>
            </p>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section8.Title') }}</h3>
            <p>{{ t('Legal.Privacy.Section8.Intro') }}</p>
            <ul class="list-disc list-inside space-y-1 mt-2">
              <li v-for="(measure, index) in measures" :key="index">{{ measure }}</li>
            </ul>
            <p class="mt-4">{{ t('Legal.Privacy.Section8.BreachNotice') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section9.Title') }}</h3>
            <p>
              <i18n-t keypath="Legal.Privacy.Section9.Content" scope="global">
                <template #cookiesLink>
                  <RouterLink
                    :to="{ name: 'legal-cookies' }"
                    data-testid="cookies-policy-link"
                    class="italic underline text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >{{ t('Legal.Privacy.CookiesPolicyLink') }}</RouterLink>
                </template>
              </i18n-t>
            </p>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section10.Title') }}</h3>
            <p>{{ t('Legal.Privacy.Section10.Content') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Privacy.Section11.Title') }}</h3>
            <p>
              <i18n-t keypath="Legal.Privacy.Section11.Content" scope="global">
                <template #email>{{ t('Legal.Common.Contact.Email') }}</template>
              </i18n-t>
            </p>
          </section>

          <p class="text-sm text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-600">
            {{ t('Legal.Privacy.LastUpdated', { date: lastUpdated }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
