<script setup>
  import { computed } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import { goBackOrWelcome } from '@/modules/goBackOrWelcome'

  const { t, tm, rt, locale } = useI18n()
  const router = useRouter()

  // Obfuscation `[at]` uniquement nécessaire dans le JSON source (voir project_vue_i18n_at_symbol_bug) —
  // un `@` littéral y casse la compilation vue-i18n. Ici, valeur déjà résolue en mémoire : sans risque.
  const contactEmail = computed(() => t('Legal.Common.Contact.Email').replace('[at]', '@'))

  // Date de dernière publication du contenu de cette politique — à mettre à jour manuellement
  // à chaque modification substantielle (voir Legal.Cookies.Section8 / draft
  // admin/content/policy-cookies-draft.md).
  const LAST_UPDATED = '2026-08-10'
  const lastUpdated = computed(() => new Intl.DateTimeFormat(
    locale.value === 'fr' ? 'fr-FR' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  ).format(new Date(LAST_UPDATED)))

  // Liste "Ce que nous ne faisons pas" : tableau i18n plutôt que 5 clés numérotées. tm() renvoie
  // les messages précompilés (fonctions), pas des chaînes — rt() les résout dans le template,
  // sinon on affiche le code compilé tel quel (bug constaté en prod le 06/09/2026).
  const section4Items = computed(() => tm('Legal.Cookies.Section4.Items'))
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

        <h1>{{ t('Legal.Cookies.PageTitle') }}</h1>

        <div
          data-testid="cookies-policy-content"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 tablet:p-10 space-y-8"
        >
          <p>
            <i18n-t keypath="Legal.Cookies.Preamble" scope="global">
              <template #privacyLink>
                <RouterLink
                  :to="{ name: 'legal-privacy' }"
                  data-testid="privacy-policy-link"
                  class="italic underline text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >{{ t('Legal.Cookies.PrivacyPolicyLink') }}</RouterLink>
              </template>
            </i18n-t>
          </p>

          <section>
            <h3>{{ t('Legal.Cookies.Section1.Title') }}</h3>
            <p>{{ t('Legal.Cookies.Section1.Content') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section2.Title') }}</h3>
            <ul class="list-none space-y-1">
              <li><strong>{{ t('Legal.Common.Contact.NameLabel') }}</strong> : {{ t('Legal.Common.Contact.Name') }}</li>
              <li><strong>{{ t('Legal.Common.Contact.AddressLabel') }}</strong> : {{ t('Legal.Common.Contact.Address') }}</li>
              <li>
                <strong>{{ t('Legal.Common.Contact.EmailLabel') }}</strong> :
                <a :href="`mailto:${contactEmail}`" class="underline text-blue-600 dark:text-blue-400">{{ contactEmail }}</a>
              </li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section3.Title') }}</h3>
            <p>{{ t('Legal.Cookies.Section3.Intro') }}</p>

            <div class="mt-4 space-y-4">
              <div
                v-for="key in ['Preferences', 'Tokens']"
                :key="key"
                class="border border-slate-200 dark:border-slate-600 rounded-md p-4"
              >
                <h4 class="text-lg">{{ t(`Legal.Cookies.Section3.${key}.Title`) }}</h4>
                <ul class="list-none space-y-1 mt-2">
                  <li><strong>{{ t('Legal.Cookies.Fields.Purpose') }}</strong> : {{ t(`Legal.Cookies.Section3.${key}.Purpose`) }}</li>
                  <li><strong>{{ t('Legal.Cookies.Fields.Data') }}</strong> : {{ t(`Legal.Cookies.Section3.${key}.Data`) }}</li>
                  <li><strong>{{ t('Legal.Cookies.Fields.Retention') }}</strong> : {{ t(`Legal.Cookies.Section3.${key}.Retention`) }}</li>
                  <li><strong>{{ t('Legal.Cookies.Fields.LegalBasis') }}</strong> : {{ t(`Legal.Cookies.Section3.${key}.LegalBasis`) }}</li>
                  <li><strong>{{ t('Legal.Cookies.Fields.IfDecline') }}</strong> : {{ t(`Legal.Cookies.Section3.${key}.IfDecline`) }}</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section4.Title') }}</h3>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="(item, index) in section4Items" :key="index">{{ rt(item) }}</li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section5.Title') }}</h3>
            <p>{{ t('Legal.Cookies.Section5.Content') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section6.Title') }}</h3>
            <ul class="list-disc list-inside space-y-2">
              <li>{{ t('Legal.Cookies.Section6.Anonymous') }}</li>
              <li>
                <i18n-t keypath="Legal.Cookies.Section6.Registered" scope="global">
                  <template #privacyLink>
                    <RouterLink
                      :to="{ name: 'legal-privacy' }"
                      data-testid="privacy-policy-link"
                      class="italic underline text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >{{ t('Legal.Cookies.PrivacyPolicyLink') }}</RouterLink>
                  </template>
                </i18n-t>
              </li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section7.Title') }}</h3>
            <ul class="list-disc list-inside space-y-2">
              <li>{{ t('Legal.Cookies.Section7.Withdraw') }}</li>
              <li>{{ t('Legal.Cookies.Section7.Erase') }}</li>
              <li>
                <i18n-t keypath="Legal.Cookies.Section7.Complaint" scope="global">
                  <template #apdLink>
                    <a
                      href="https://www.autoriteprotectiondonnees.be"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="underline text-blue-600 dark:text-blue-400"
                    >APD</a>
                  </template>
                </i18n-t>
              </li>
            </ul>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section8.Title') }}</h3>
            <p>{{ t('Legal.Cookies.Section8.Content') }}</p>
          </section>

          <section>
            <h3>{{ t('Legal.Cookies.Section9.Title') }}</h3>
            <p>
              <i18n-t keypath="Legal.Cookies.Section9.Content" scope="global">
                <template #emailLink>
                  <a :href="`mailto:${contactEmail}`" class="underline text-blue-600 dark:text-blue-400">{{ contactEmail }}</a>
                </template>
              </i18n-t>
            </p>
          </section>

          <p class="text-sm text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-600">
            {{ t('Legal.Cookies.LastUpdated', { date: lastUpdated }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
