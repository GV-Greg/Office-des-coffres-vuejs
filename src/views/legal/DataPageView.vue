<script setup>
  import { computed } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import SelectorMenu from '@/components/SelectorMenu.vue'
  import { goBackOrWelcome } from '@/modules/goBackOrWelcome'
  // Niveau d'accès et couleur de badge : lus dans dataPageSections.js, jamais écrits ici. Badge à
  // côté du titre de chaque section — pas au sommaire (choix de Greg, 06/10/2026).
  import { DATA_PAGE_SECTIONS, BADGE_CLASSES } from '@/modules/dataPageSections'

  /*
    « Vos données, outil par outil » (brief admin/content/brief-pages-donnees-joueur.md ; fil
    admin/echanges/pages-donnees-joueur). Une seule page, un sommaire, une section par outil.

    🔴 Version B (Greg, 06/10/2026) : les énumérations de la politique de confidentialité (§4 bases
    légales, §5 durées, §6 destinataires) ne perdent jamais une ligne. Cette page porte ce qu'elles
    ne portent pas — à quoi sert l'outil, qui peut l'utiliser, ce que vous y mettez, ce qui n'est
    PAS enregistré — et, pour un outil qui conserve des données chez nous (postes déclarés, Registre
    des mines), RENVOIE à la politique pour la durée et les destinataires, sans les recopier.
  */

  const { t, te, locale } = useI18n()
  const router = useRouter()

  // Date de dernière modification de CETTE page (fil 05-corrections, C4) = date de MISE EN LIGNE (front #90).
  const LAST_UPDATED = '2026-10-11'
  const lastUpdated = computed(() => new Intl.DateTimeFormat(
    locale.value === 'fr' ? 'fr-FR' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  ).format(new Date(LAST_UPDATED)))

  // Les questions, dans le même ordre pour tous les outils (brief §4, fil 05-corrections C2). Une
  // section ne porte que celles qui la concernent : la clé absente n'est pas affichée.
  const QUESTIONS = ['Purpose', 'Input', 'Stored', 'Duration', 'Audience', 'Deletion']

  const answered = key => QUESTIONS.filter(question => te(`Legal.Data.${key}.${question}`))

  // Un outil qui conserve des données sur nos serveurs renvoie à la politique pour ce qu'elle
  // énumère (durée, destinataires, suppression du compte) : c'est l'outil qui exige un compte ou un
  // poste, hors la section Compte, qui est elle-même un renvoi.
  const seesPolicy = section => section.key !== 'Account' && section.access !== 'none'
</script>

<template>
  <div class="page-container relative">
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

        <h1>{{ t('Legal.Data.PageTitle') }}</h1>

        <div
          data-testid="data-page-content"
          class="bg-white dark:bg-gray-800 text-slate-800 dark:text-white rounded-lg shadow-md p-6 tablet:p-10 space-y-8"
        >
          <p>
            <i18n-t keypath="Legal.Data.Intro" scope="global">
              <template #privacyLink>
                <RouterLink :to="{ name: 'legal-privacy' }" class="underline text-blue-600 dark:text-blue-400">{{ t('Legal.Data.PrivacyLink') }}</RouterLink>
              </template>
            </i18n-t>
          </p>

          <!-- Qui peut utiliser quoi : les trois niveaux d'accès (fil 06-acces). -->
          <p data-testid="data-access">
            <strong>{{ t('Legal.Data.AccessTitle') }}</strong> {{ t('Legal.Data.Access') }}
          </p>

          <nav aria-labelledby="data-toc-title" data-testid="data-toc">
            <h3 id="data-toc-title">{{ t('Legal.Data.TocTitle') }}</h3>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="section in DATA_PAGE_SECTIONS" :key="section.id">
                <a :href="`#${section.id}`" class="underline text-blue-600 dark:text-blue-400">{{ t(`Legal.Data.${section.key}.Title`) }}</a>
              </li>
            </ul>
          </nav>

          <section v-for="section in DATA_PAGE_SECTIONS" :id="section.id" :key="section.id" class="scroll-mt-6">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <h3 class="!mb-0">{{ t(`Legal.Data.${section.key}.Title`) }}</h3>
              <span
                :class="['inline-block rounded-full border px-2 py-0.5 text-xs font-semibold', BADGE_CLASSES[section.access]]"
                data-testid="access-badge"
              >{{ t(`Legal.Data.Badges.${section.access}`) }}</span>
            </div>

            <p v-if="section.upcoming" class="mb-3 font-bold" data-testid="upcoming">{{ t('Legal.Data.Upcoming') }}</p>

            <!-- Compte et personnages : un renvoi à la politique, sans recopier un seul fait. -->
            <p v-if="section.key === 'Account'">
              <i18n-t keypath="Legal.Data.Account.Text" scope="global">
                <template #privacyLink>
                  <RouterLink :to="{ name: 'legal-privacy' }" class="underline text-blue-600 dark:text-blue-400">{{ t('Legal.Data.PrivacyLink') }}</RouterLink>
                </template>
              </i18n-t>
            </p>

            <template v-else>
              <dl class="space-y-3">
                <div v-for="question in answered(section.key)" :key="question">
                  <dt class="font-bold">{{ t(`Legal.Data.Questions.${question}`) }}</dt>
                  <dd>
                    <!-- Postes déclarés : facultatif, sauf pour les outils qui en exigent un (fil 06-acces §2). -->
                    <template v-if="question === 'Input' && te(`Legal.Data.${section.key}.InputLead`)">
                      <p><strong>{{ t(`Legal.Data.${section.key}.InputLead`) }}</strong> {{ t(`Legal.Data.${section.key}.Input`) }}</p>
                      <p class="mt-1">{{ t(`Legal.Data.${section.key}.InputDetail`) }}</p>
                    </template>
                    <template v-else>{{ t(`Legal.Data.${section.key}.${question}`) }}</template>
                  </dd>
                </div>
              </dl>

              <p v-if="seesPolicy(section)" class="mt-3" data-testid="see-policy">
                <i18n-t keypath="Legal.Data.SeePolicy" scope="global">
                  <template #privacyLink>
                    <RouterLink :to="{ name: 'legal-privacy' }" class="underline text-blue-600 dark:text-blue-400">{{ t('Legal.Data.PrivacyLink') }}</RouterLink>
                  </template>
                </i18n-t>
              </p>
            </template>
          </section>

          <p class="text-sm text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-600" data-testid="data-last-updated">
            {{ t('Legal.Data.LastUpdated', { date: lastUpdated }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
