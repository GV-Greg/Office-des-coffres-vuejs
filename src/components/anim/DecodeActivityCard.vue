<script setup>
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { push } from 'notivue'
  import { apiMessage } from '@/stores/mandateStore'
  import useNavigationLoading from '@/use/useNavigationLoading'
  import DecodeHero from '@/components/anim/DecodeHero.vue'
  import DecodeCodeVisual from '@/components/anim/DecodeCodeVisual.vue'
  import DecodeAttemptsTable from '@/components/anim/DecodeAttemptsTable.vue'
  import DecodeOpenedChests from '@/components/anim/DecodeOpenedChests.vue'
  import DecodeRankingCard from '@/components/anim/DecodeRankingCard.vue'

  /*
    Une activité de « Décode le code », côté ORGANISATEUR — la même carte pour le mode privé (« Ma salle ») et le mode sans
    compte (« Retrouver ma salle »). Elle ne sait pas dans lequel elle est : elle reçoit des `gestures` (voir
    useDecodeActivities : asOrganizer / asAnonymous). ⚠️ AUCUNE règle ici : seul l'organisateur gère, la note d'une combinaison
    vient du serveur, un refus s'affiche tel que l'API le dit (`apiMessage`, FR et EN). Les boutons ne suivent que l'état et ce
    que les gestes offrent (pas de « Rouvrir » ni de « Supprimer » sans compte : D19, D13).
    Le code du coffre en cours n'est visible de PERSONNE, l'organisateur compris : il n'apparaît qu'une fois le coffre percé (coffres ouverts).
    Vocabulaire (D34) : le nom saisi est celui d'un PERSONNAGE.
    Mise en page : celle de la page publique (encadré de tête, trois quarts à gauche, un quart à droite), avec en plus ce que seul l'organisateur voit
    (le code du coffre, la saisie) et ses gestes. Les blocs communs sont des composants partagés (DecodeHero, DecodeAttemptsTable…).
  */
  const props = defineProps({
    activity: { type: Object, required: true },
    gestures: { type: Object, required: true },
  })
  const emit = defineEmits(['update', 'removed'])

  const { t, locale } = useI18n()
  const { trackApiCall } = useNavigationLoading()

  const busy = ref(false)
  const proposal = reactive({ combination: '', characterName: '' })
  const result = ref('')
  const exported = ref('')
  const confirming = ref('') // '' | 'delete' | 'close' — une étape de confirmation avant un geste qui ne se défait pas

  const isAnonymous = computed(() => props.gestures.mode === 'anonymous')
  const closed = computed(() => props.activity.status === 'closed')
  const canReopen = computed(() => !!props.gestures.reopen && !!props.activity.can_reopen)
  const canRemove = computed(() => !!props.gestures.remove && closed.value)
  // Une combinaison compte cinq chiffres : sans eux, rien à inscrire (le serveur juge de toute façon).
  const combinationReady = computed(() => /^[0-9]{5}$/.test(proposal.combination.trim()))
  const proposals = computed(() => props.activity.current?.proposals ?? [])
  // Les pseudos déjà inscrits sur cette activité (classement cumulé, coffre en cours), proposés à la saisie : ils viennent du serveur,
  // aucun stockage local n'est nécessaire (un cookie de confort mémoriserait en plus des pseudos de tiers sur l'appareil).
  const knownNames = computed(() => [...new Set([
    ...(props.activity.ranking ?? []).map(r => r.character_name),
    ...proposals.value.map(p => p.character_name),
  ])].sort((a, b) => a.localeCompare(b)))
  const email = computed(() => props.activity.email ?? null)

  function run(call, success) {
    busy.value = true
    return trackApiCall(call())
      .then((value) => { if (success) push.success(t(success)); return value })
      .catch((e) => { push.error(apiMessage(e, locale.value, t('Auth.Errors.NetworkError'))); return null })
      .finally(() => { busy.value = false })
  }

  const update = (activity) => { if (activity) emit('update', activity) }

  const seal = () => run(() => props.gestures.generateSecret(props.activity), 'Animation.Mine.Sealed').then(update)
  const reopen = () => run(() => props.gestures.reopen(props.activity), 'Animation.Mine.Reopened').then(update)

  async function close() {
    confirming.value = ''
    const updated = await run(() => props.gestures.close(props.activity), 'Animation.Mine.Closed')
    update(updated)
  }
  // Une clôture sans compte est définitive : on demande avant. En privé, elle se défait (réouverture) : directe.
  const askClose = () => { if (isAnonymous.value) confirming.value = 'close'; else close() }

  async function remove() {
    const done = await run(async () => { await props.gestures.remove(props.activity); return true }, 'Animation.Mine.Deleted')
    confirming.value = ''
    if (done) emit('removed', props.activity)
  }

  async function submitProposal() {
    const data = await run(() => props.gestures.propose(props.activity, props.activity.current.id, {
      combination: proposal.combination.trim(),
      character_name: proposal.characterName.trim(),
    }))
    if (!data) return
    result.value = data.found
      ? t('Animation.Mine.ResultFound', { character: data.proposal.character_name })
      : t('Animation.Mine.ResultScore', { combination: data.proposal.combination, character: data.proposal.character_name, score: data.score })
    proposal.combination = ''
    proposal.characterName = ''
    update(data.activity)
  }

  async function doExport(kind) {
    const text = await run(() => (kind === 'rules' ? props.gestures.exportRules(props.activity) : props.gestures.exportResults(props.activity)))
    if (text === null) return
    exported.value = text
    try {
      await navigator.clipboard.writeText(text)
      push.success(t('Animation.Mine.Copied'))
    } catch {
      push.warning(t('Animation.Mine.CopyFailed')) // le texte reste affiché, à sélectionner à la main
    }
  }
</script>

<template>
  <article class="mt-4 text-slate-800 dark:text-slate-800" :data-testid="`activity-${activity.id}`">
    <!-- Le titre sur toute la largeur de la page. -->
    <DecodeHero :title="t('Animation.Mine.RoomTitle', { name: activity.name })" :status="activity.status" :divider="false" :status-testid="`status-${activity.id}`">
      <RouterLink :to="{ name: 'animation-public', params: { slug: activity.slug } }" target="_blank" rel="noopener" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :data-testid="`public-${activity.id}`">
        <v-icon name="fa-eye" aria-hidden="true" />{{ t('Animation.Mine.ViewPublic') }}
      </RouterLink>
    </DecodeHero>

    <div class="mt-5 grid gap-5 laptop:grid-cols-4 items-start">
      <!-- À gauche, trois quarts : le coffre en cours (code et saisie), puis les propositions et les coffres ouverts côte à côte. -->
      <div class="laptop:col-span-3 space-y-5">
        <!-- Le coffre en cours : le code n'est visible que de l'organisateur. -->
        <section v-if="activity.current" class="rounded-xl border border-slate-300 bg-white p-4 grid gap-5 tablet:grid-cols-2 items-center" :data-testid="`current-${activity.id}`">
          <!-- Deux colonnes : le code scellé à gauche, la saisie d'une proposition à droite. -->
          <div>
          <p class="!m-0 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-800">
            <v-icon name="gi-chest" scale="1.2" class="text-teal-700" aria-hidden="true" />{{ t('Animation.Mine.SecretTitle', { number: activity.current.number }) }}
          </p>
          <!-- Le coffre reste scellé pour tout le monde, l'organisateur compris : il ne connaît pas la combinaison (Greg, 28/10/2026). -->
          <DecodeCodeVisual tone="light" size="large" class="mt-2" :testid="`code-cells-${activity.id}`" />
          <p class="!mb-0 mt-2 text-xs text-slate-700 dark:text-slate-700">{{ t('Animation.Mine.SecretHelp') }}</p>

          </div>
          <div v-if="!closed || result">
          <form v-if="!closed" class="flex flex-wrap items-center gap-3" :data-testid="`proposal-form-${activity.id}`" @submit.prevent="submitProposal">
            <div>
              <label :for="`character-${activity.id}`" class="block text-sm font-bold">{{ t('Animation.Mine.Character') }}</label>
              <input :id="`character-${activity.id}`" v-model="proposal.characterName" type="text" maxlength="30" required autocomplete="off" :list="`names-${activity.id}`" class="form-field w-48" :data-testid="`character-${activity.id}`" />
              <datalist :id="`names-${activity.id}`" :data-testid="`names-${activity.id}`">
                <option v-for="name in knownNames" :key="name" :value="name" />
              </datalist>
            </div>
            <div>
              <label :for="`comb-${activity.id}`" class="block text-sm font-bold">{{ t('Animation.Mine.Combination') }}</label>
              <input :id="`comb-${activity.id}`" v-model="proposal.combination" type="text" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required placeholder="00000" class="form-field w-24 font-mono" :data-testid="`combination-${activity.id}`" />
            </div>
            <button type="submit" class="odc-btn odc-btn--soft odc-btn--sm odc-btn--rect odc--green flex-col !gap-1 !min-h-[5.5rem] min-w-[8rem] px-8 text-base" :disabled="busy || !combinationReady" :data-testid="`propose-${activity.id}`">
              <v-icon name="si-testcafe" scale="2.2" aria-hidden="true" />{{ t('Animation.Mine.Submit') }}
            </button>
          </form>
          <p v-if="result" role="status" class="!mb-0 mt-2 font-semibold text-slate-800 dark:text-slate-800" :data-testid="`result-${activity.id}`">{{ result }}</p>
          </div>
        </section>

        <div class="grid gap-5 tablet:grid-cols-2 items-start">
          <section class="rounded-xl border border-slate-300 bg-white p-4">
            <h3 class="!mt-0 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-700 to-orange-600">
              {{ t('Animation.Mine.ProposalsTitle') }}
              <span v-if="activity.current" class="text-sm font-normal text-slate-700 dark:text-slate-700">— {{ t('Animation.Mine.Attempts', { count: proposals.length }, proposals.length) }}</span>
            </h3>
            <DecodeAttemptsTable v-if="proposals.length" :proposals="proposals" :data-testid="`proposals-${activity.id}`" />
            <p v-else class="text-sm italic text-slate-700 dark:text-slate-700" :data-testid="`proposals-empty-${activity.id}`">{{ t('Animation.Mine.ProposalsEmpty') }}</p>
          </section>

          <DecodeOpenedChests :opened="activity.opened ?? []" />
        </div>
      </div>

      <!-- À droite, un quart : les gestes (ils suivent l'état et ce que le mode offre, le serveur reste juge), puis le classement. -->
      <div class="laptop:col-span-1 space-y-5">
        <aside class="rounded-xl border border-slate-300 bg-white p-4 space-y-3" :aria-label="t('Animation.Mine.ActionsTitle')">

          <!-- L'adresse d'un auteur sans compte : confirmée ou en attente de confirmation (D29). Jamais l'adresse elle-même. -->
          <p v-if="email && email.set && !closed" class="text-xs text-slate-700 dark:text-slate-700" :data-testid="`email-${activity.id}`">
            {{ email.verified ? t('Animation.Mine.EmailConfirmed') : t('Animation.Mine.EmailPending') }}
          </p>

          <!-- Activité sans compte close : plus rien à gérer, seul le résumé reste en ligne (D18, D19). -->
          <p v-if="isAnonymous && closed" role="note" class="font-semibold text-orange-800 dark:text-orange-800" :data-testid="`closed-note-${activity.id}`">
            {{ t('Animation.Mine.ClosedAnonymous') }}
          </p>

          <div class="flex flex-col items-stretch gap-2">
            <button v-if="activity.status === 'new'" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy" :data-testid="`seal-${activity.id}`" @click="seal">
              <v-icon name="gi-chest" aria-hidden="true" />{{ t('Animation.Mine.Seal') }}
            </button>
            <button v-if="canReopen" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy" :data-testid="`reopen-${activity.id}`" @click="reopen">
              <v-icon name="fa-undo" aria-hidden="true" />{{ t('Animation.Mine.Reopen') }}
            </button>
            <button v-if="!closed || !isAnonymous" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy" :data-testid="`export-rules-${activity.id}`" @click="doExport('rules')">
              <v-icon name="fa-copy" aria-hidden="true" />{{ t('Animation.Mine.ExportRules') }}
            </button>
            <button v-if="!closed || !isAnonymous" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--teal" :disabled="busy" :data-testid="`export-results-${activity.id}`" @click="doExport('results')">
              <v-icon name="fa-copy" aria-hidden="true" />{{ t('Animation.Mine.ExportResults') }}
            </button>
            <button v-if="!closed" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" :data-testid="`close-${activity.id}`" @click="askClose">
              <v-icon name="fa-lock" aria-hidden="true" />{{ t('Animation.Mine.Close') }}
            </button>
            <button v-if="canRemove" type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" :data-testid="`delete-${activity.id}`" @click="confirming = 'delete'">
              <v-icon name="fa-trash" aria-hidden="true" />{{ t('Animation.Mine.Delete') }}
            </button>
          </div>

          <!-- Clôture définitive (sans compte) : une étape de confirmation qui dit ce qui se passe (D19). -->
          <div v-if="confirming === 'close'" role="alertdialog" class="border border-red-700 rounded p-3 bg-red-50" :data-testid="`close-confirm-${activity.id}`">
            <p class="font-semibold text-red-900 dark:text-red-900">{{ t('Animation.Mine.CloseConfirmAnonymous') }}</p>
            <div class="mt-2 flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" :data-testid="`close-yes-${activity.id}`" @click="close">{{ t('Animation.Mine.CloseConfirmButton') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" :data-testid="`close-no-${activity.id}`" @click="confirming = ''">{{ t('Animation.Mine.DeleteCancel') }}</button>
            </div>
          </div>

          <div v-if="confirming === 'delete'" role="alertdialog" class="border border-red-700 rounded p-3 bg-red-50" :data-testid="`delete-confirm-${activity.id}`">
            <p class="font-semibold text-red-900 dark:text-red-900">{{ t('Animation.Mine.DeleteConfirm', { name: activity.name }) }}</p>
            <div class="mt-2 flex gap-2">
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--red" :disabled="busy" :data-testid="`delete-yes-${activity.id}`" @click="remove">{{ t('Animation.Mine.DeleteConfirmButton') }}</button>
              <button type="button" class="odc-btn odc-btn--soft odc-btn--sm odc--slate" @click="confirming = ''">{{ t('Animation.Mine.DeleteCancel') }}</button>
            </div>
          </div>

          <div v-if="exported">
            <label :for="`export-${activity.id}`" class="block text-sm font-bold">{{ t('Animation.Mine.ExportTitle') }}</label>
            <textarea :id="`export-${activity.id}`" readonly rows="8" class="form-field w-full font-mono text-xs" :value="exported" :data-testid="`export-text-${activity.id}`"></textarea>
          </div>
        </aside>

        <DecodeRankingCard :ranking="activity.ranking ?? []" />
      </div>
    </div>
  </article>
</template>
