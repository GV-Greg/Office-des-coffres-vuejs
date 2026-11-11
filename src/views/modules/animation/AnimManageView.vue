<script setup>
  import { ref, shallowRef } from 'vue'
  import { RouterLink } from 'vue-router'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import { useCookieStore } from '@/stores/cookieStore'
  import useDecodeActivities from '@/use/useDecodeActivities'
  import useRewardsGrid from '@/use/useRewardsGrid'
  import useAnimKind from '@/use/useAnimKind'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import { ANIM_COMPONENTS } from '@/components/anim/animHeroes'
  import DecodeActivityCard from '@/components/anim/DecodeActivityCard.vue'
  import RewardsGridCard from '@/components/anim/RewardsGridCard.vue'

  /*
    Retrouver SON activité sans compte : l'adresse (slug) et le mot de passe (D3, D10) — commun à toutes les activités d'Animation (`kind`).
    Sans compte, il n'y a ni session ni jeton : la preuve accompagne chaque geste et ne vit que dans la mémoire de cette page. ⚠️ Le mot de
    passe n'est JAMAIS mémorisé ni stocké (D4) ; seule l'adresse peut l'être, sous une clé propre à l'activité, et seulement si les cookies
    « Préférences » sont acceptés (D22) — sinon l'utilisateur la ressaisit. Aucune règle ici : le serveur juge, ses refus s'affichent tels
    quels. Le refus est identique pour une adresse inconnue, une activité privée ou close et un mauvais mot de passe.
  */
  const props = defineProps({ kind: { type: String, required: true } })
  const { kind, kt, t, locale } = useAnimKind(props.kind)
  const api = props.kind === 'rewards' ? useRewardsGrid() : useDecodeActivities()
  const cookieStore = useCookieStore()
  const { trackApiCall } = useNavigationLoading()
  const Hero = ANIM_COMPONENTS[props.kind].hero

  const slug = ref(String(cookieStore.getComfortData(kind.slugKey, '') ?? ''))
  // Une activité mémorisée sur cet appareil (cookies de confort acceptés) : elle existe déjà, inutile de proposer d'en ouvrir une autre.
  // Sans cookies acceptés, rien n'est mémorisé : l'encart de création reste proposé.
  const hasRemembered = slug.value.trim() !== ''
  const password = ref('')
  const item = ref(null)
  const gestures = shallowRef(null)
  const opening = ref(false)
  const error = ref('')
  const resetSent = ref(false)

  // Une adresse ne porte que des minuscules (D14) : « Test » se lit « test » plutôt que d'échouer sur une route introuvable.
  const normalizedSlug = () => slug.value.trim().toLowerCase()

  function open() {
    const address = normalizedSlug()
    const secret = password.value
    opening.value = true
    error.value = ''
    resetSent.value = false
    trackApiCall(api.open(address, secret))
      .then((opened) => {
        item.value = opened
        gestures.value = api.asAnonymous(address, secret) // le mot de passe ne vit que dans cette fermeture, en mémoire
        cookieStore.setComfortData(kind.slugKey, address)
        password.value = ''
      })
      .catch((e) => {
        // Une route introuvable (adresse mal formée) n'a pas de message de l'API : le même refus que pour une adresse inconnue.
        const unknown = e?.response?.status === 404 && !e.response.data?.messages
        error.value = unknown ? kt('Manage.NotFound') : apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))
      })
      .finally(() => { opening.value = false })
  }

  // Une clôture est définitive : l'adresse n'a plus rien à retrouver, on l'oublie (D22).
  function update(updated) {
    item.value = updated
    if (updated.status === 'closed') cookieStore.setComfortData(kind.slugKey, null)
  }

  function leave() {
    item.value = null
    gestures.value = null
    password.value = ''
  }

  // La réponse est la même quoi qu'il arrive (le serveur ne révèle ni l'existence de l'activité ni la présence d'un email).
  function forgot() {
    error.value = ''
    trackApiCall(api.requestReset(normalizedSlug()))
      .then(() => { resetSent.value = true })
      .catch((e) => { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))) })
  }
</script>

<template>
  <div class="w-full text-slate-800 dark:text-slate-800">
    <!-- Avant l'ouverture : le même encadré de tête que l'entrée ; une fois ouverte, c'est SON encadré qui fait le titre. -->
    <component :is="Hero" v-if="!item" :title="kt('Manage.Title')" :divider="false" title-testid="manage-title" cells-testid="manage-visual" />

    <div v-if="!item" class="mt-5 grid gap-5 laptop:grid-cols-4 items-start">
      <section class="laptop:col-span-3 rounded-xl border border-slate-300 bg-white p-5" data-testid="manage-form">
        <h3 class="!mt-0 !mb-1 text-xl font-extrabold" :class="kind.titleClass">{{ kt('Manage.FormTitle') }}</h3>
        <p class="text-sm text-slate-700 dark:text-slate-700">{{ kt('Manage.Intro') }}</p>
        <form class="mt-3 flex flex-col gap-4 tablet:flex-row tablet:items-end" @submit.prevent="open">
          <div class="flex-1">
            <div class="grid gap-4 tablet:grid-cols-2">
              <div>
                <label for="manage-slug" class="block text-sm font-bold">{{ kt('Manage.Slug') }}</label>
                <input id="manage-slug" v-model="slug" type="text" maxlength="60" autocomplete="off" spellcheck="false" required class="form-field w-full font-mono" data-testid="manage-slug" />
              </div>
              <div>
                <label for="manage-password" class="block text-sm font-bold">{{ kt('Manage.Password') }}</label>
                <input id="manage-password" v-model="password" type="password" maxlength="200" autocomplete="current-password" required class="form-field w-full" data-testid="manage-password" />
              </div>
            </div>
            <p v-if="error" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-700" data-testid="manage-error">{{ error }}</p>
          </div>
          <!-- Le bouton à droite du formulaire, son bas aligné sur celui des champs. -->
          <button type="submit" class="odc-btn odc-btn--soft odc-btn--rect flex-col !gap-1 !min-h-[5.5rem] min-w-[10rem] px-8 text-base odc--teal" :disabled="opening" data-testid="manage-open">
            <v-icon :name="kind.icons.manage" scale="2" aria-hidden="true" />{{ kt('Manage.Open') }}
          </button>
        </form>
      </section>

      <!-- À droite : que faire si le mot de passe est perdu (selon qu'une adresse email a été confirmée ou non), puis la porte vers la création. -->
      <aside class="laptop:col-span-1 space-y-5">
        <section class="rounded-xl border border-slate-300 bg-white p-4 text-slate-800 dark:text-slate-800" data-testid="manage-lost">
          <h3 class="!mt-0 text-xl font-extrabold" :class="kind.titleClass">{{ kt('Manage.LostTitle') }}</h3>
          <ul class="m-0 p-0 list-none space-y-3 text-sm">
            <li class="flex gap-2">
              <v-icon name="fa-check-circle" class="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" />
              <span class="text-slate-700 dark:text-slate-700"><strong class="text-slate-800 dark:text-slate-800">{{ kt('Manage.LostEmailLead') }}</strong> {{ kt('Manage.LostEmail') }}</span>
            </li>
            <li class="flex gap-2">
              <v-icon name="gi-tied-scroll" class="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" />
              <span class="text-slate-700 dark:text-slate-700"><strong class="text-slate-800 dark:text-slate-800">{{ kt('Manage.LostNoEmailLead') }}</strong> {{ kt('Manage.LostNoEmail') }}</span>
            </li>
          </ul>
          <!-- UN seul bouton : avec une activité mémorisée sur l'appareil, « Réinitialiser mon mot de passe » ; sans, « Demander à l'administrateur du site ».
               Le serveur fait la même chose dans les deux cas (lien par email s'il est confirmé, sinon demande notée pour l'administrateur du site). -->
          <button type="button" class="mt-4 odc-btn odc-btn--soft odc-btn--sm odc--slate w-full" :disabled="!slug.trim()" data-testid="manage-forgot" @click="forgot">
            <v-icon :name="hasRemembered ? 'fa-lock' : 'gi-tied-scroll'" aria-hidden="true" />{{ hasRemembered ? kt('Manage.Forgot') : kt('Manage.AskAdmin') }}
          </button>
          <p v-if="resetSent" role="status" class="!mb-0 mt-3 text-sm font-semibold text-slate-800 dark:text-slate-800" data-testid="manage-reset-sent">{{ kt('Manage.ResetSent') }}</p>
        </section>

        <section v-if="!hasRemembered" class="rounded-xl border border-teal-700 bg-white p-4 text-slate-800 dark:text-slate-800" data-testid="manage-create">
          <h3 class="!mt-0 text-xl font-extrabold" :class="kind.titleClass">{{ kt('Manage.NoActivity') }}</h3>
          <p class="text-sm text-slate-700 dark:text-slate-700">{{ kt('Manage.NoActivityText') }}</p>
          <RouterLink :to="{ name: kind.routes.create }" class="odc-btn odc-btn--soft odc-btn--sm odc--green w-full" data-testid="manage-create-link">
            <v-icon :name="kind.icons.create" aria-hidden="true" />{{ kt('Manage.CreateOne') }}
          </RouterLink>
        </section>
      </aside>
    </div>

    <template v-else>
      <!-- Deux cartes, nommées : la carte de chaque type reste remplaçable par son nom (les tests). -->
      <DecodeActivityCard v-if="kind.key === 'decode'" :activity="item" :gestures="gestures" @update="update" />
      <RewardsGridCard v-else :grid="item" :gestures="gestures" @update="update" />
      <button type="button" class="mt-5 odc-btn odc-btn--soft odc-btn--sm odc--slate" data-testid="manage-leave" @click="leave">
        {{ kt('Manage.Leave') }}
      </button>
    </template>
  </div>
</template>
