<script setup>
  import { ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import RewardsGridCard from '@/components/anim/RewardsGridCard.vue'
  import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'

  /*
    Grille des lots — retrouver SA grille sans compte : l'adresse (slug) et le mot de passe.
    Sans compte, il n'y a ni session ni jeton : la preuve accompagne chaque geste et ne vit que dans
    la mémoire de cette page. ⚠️ Le mot de passe n'est JAMAIS mémorisé ni stocké ; seule l'adresse
    peut l'être sous une clé propre à cette animation, et seulement si les cookies « Préférences »
    sont acceptés — sinon l'utilisateur la ressaisit. Aucune règle ici.
  */
  const { t, locale } = useI18n()
  const api = useRewardsGrid()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()

  const SLUG_KEY = 'anim_rewards_slug'
  const slug = ref(String(cookieStore.getComfortData(SLUG_KEY, '') ?? ''))
  const hasRemembered = slug.value.trim() !== ''
  const password = ref('')
  const grid = ref(null)
  const gestures = shallowRef(null)
  const opening = ref(false)
  const error = ref('')
  const resetSent = ref(false)

  const normalizedSlug = () => slug.value.trim().toLowerCase()

  function open() {
    const address = normalizedSlug()
    const secret = password.value
    opening.value = true
    error.value = ''
    resetSent.value = false
    trackApiCall(api.open(address, secret))
      .then((opened) => {
        grid.value = opened
        gestures.value = api.asAnonymous(address, secret)
        cookieStore.setComfortData(SLUG_KEY, address)
        password.value = ''
      })
      .catch((e) => {
        const unknown = e?.response?.status === 404 && !e.response.data?.messages
        error.value = unknown ? t('Animation.Grid.Manage.NotFound') : apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
      })
      .finally(() => { opening.value = false })
  }

  function update(updated) {
    grid.value = updated
    if (updated.status === 'closed') cookieStore.setComfortData(SLUG_KEY, null)
  }

  function leave() {
    grid.value = null
    gestures.value = null
    password.value = ''
  }

  function forgot() {
    error.value = ''
    trackApiCall(api.requestReset(normalizedSlug()))
      .then(() => { resetSent.value = true })
      .catch((e) => { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) })
  }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <RewardsGridHero v-if="!grid" :title="t('Animation.Types.rewards.Name')" :divider="false" title-testid="manage-grid-title" class="mb-5" />
    <div v-if="!grid" class="grid gap-5 laptop:grid-cols-4 items-start">
      <section class="laptop:col-span-3 rounded-xl border border-slate-300 bg-white p-5" data-testid="manage-grid-form">
        <h3 class="!mt-0 !mb-1 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.Manage.FormTitle') }}</h3>
        <p class="text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Grid.Manage.Intro') }}</p>
        <form class="mt-3 flex flex-col gap-4 tablet:flex-row tablet:items-end" @submit.prevent="open">
          <div class="flex-1">
            <div class="grid gap-4 tablet:grid-cols-2">
              <div>
                <label for="manage-grid-slug" class="block text-sm font-bold">{{ t('Animation.Grid.Manage.Slug') }}</label>
                <input id="manage-grid-slug" v-model="slug" type="text" maxlength="60" autocomplete="off" spellcheck="false" required class="form-field w-full font-mono" data-testid="manage-grid-slug" />
              </div>
              <div>
                <label for="manage-grid-password" class="block text-sm font-bold">{{ t('Animation.Grid.Manage.Password') }}</label>
                <input id="manage-grid-password" v-model="password" type="password" maxlength="200" autocomplete="current-password" required class="form-field w-full" data-testid="manage-grid-password" />
              </div>
            </div>
            <p v-if="error" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-700" data-testid="manage-grid-error">{{ error }}</p>
          </div>
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" :disabled="opening" data-testid="manage-grid-open">
            <v-icon name="gi-chest" scale="2" aria-hidden="true" />{{ t('Animation.Grid.Manage.Open') }}
          </button>
        </form>
      </section>

      <aside class="laptop:col-span-1 space-y-5">
        <section class="rounded-xl border border-slate-300 bg-white p-4 text-slate-800 dark:text-slate-800" data-testid="manage-grid-lost">
          <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.Manage.LostTitle') }}</h3>
          <ul class="m-0 p-0 list-none space-y-3 text-sm">
            <li class="flex gap-2">
              <v-icon name="fa-check-circle" class="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" />
              <span class="text-slate-700 dark:text-slate-700">
                <strong class="text-slate-800 dark:text-slate-800">{{ t('Animation.Grid.Manage.LostEmailLead') }}</strong>
                {{ t('Animation.Grid.Manage.LostEmail') }}
              </span>
            </li>
            <li class="flex gap-2">
              <v-icon name="gi-tied-scroll" class="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" />
              <span class="text-slate-700 dark:text-slate-700">
                <strong class="text-slate-800 dark:text-slate-800">{{ t('Animation.Grid.Manage.LostNoEmailLead') }}</strong>
                {{ t('Animation.Grid.Manage.LostNoEmail') }}
              </span>
            </li>
          </ul>
          <button type="button" class="mt-4 odc-btn odc-btn--soft odc-btn--sm odc--slate w-full" :disabled="!slug.trim()" data-testid="manage-grid-forgot" @click="forgot">
            <v-icon :name="hasRemembered ? 'fa-lock' : 'gi-tied-scroll'" aria-hidden="true" />
            {{ hasRemembered ? t('Animation.Grid.Manage.Forgot') : t('Animation.Grid.Manage.AskAdmin') }}
          </button>
          <p v-if="resetSent" role="status" class="!mb-0 mt-3 text-sm font-semibold text-slate-800 dark:text-slate-800" data-testid="manage-grid-reset-sent">{{ t('Animation.Grid.Manage.ResetSent') }}</p>
        </section>

        <section v-if="!hasRemembered" class="rounded-xl border border-teal-700 bg-white p-4 text-slate-800 dark:text-slate-800" data-testid="manage-grid-create">
          <h3 class="!mt-0 text-xl font-extrabold text-teal-800">{{ t('Animation.Grid.Manage.NoActivity') }}</h3>
          <p class="text-sm text-slate-700 dark:text-slate-700">{{ t('Animation.Grid.Manage.NoActivityText') }}</p>
          <RouterLink :to="{ name: 'animation-rewards-create' }" class="odc-btn odc-btn--soft odc-btn--sm odc--teal w-full" data-testid="manage-grid-create-link">
            <v-icon name="gi-chest" aria-hidden="true" />{{ t('Animation.Grid.Manage.CreateOne') }}
          </RouterLink>
        </section>
      </aside>
    </div>

    <template v-else>
      <RewardsGridCard :grid="grid" :gestures="gestures" @update="update" />
      <button type="button" class="mt-5 odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="manage-grid-leave" @click="leave">{{ t('Animation.Grid.Manage.Leave') }}</button>
    </template>
  </div>
</template>
