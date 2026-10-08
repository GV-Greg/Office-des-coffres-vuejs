<script setup>
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { push } from 'notivue'
  import { http } from '@/api.js'
  import { useAuthStore } from '@/stores/authStore'
  import { apiMessage } from '@/stores/mandateStore'
  import { parseMinesText, parseMineStates } from '@/modules/mineParser'
  import HelpModal from '@/components/HelpModal.vue'

  /*
    Registre des mines — enregistrer le collage du Bilan (PR 2 ; brief admin/content/
    brief-registre-mines.md §2, §6 ; fil admin/echanges/registre-mines, R3).
    « Un collage, deux destinations » : le même texte sert le Bilan public et le Registre ; ce bloc
    n'apparaît que pour un personnage que l'Office connaît comme commissaire aux mines ou bailli.

    ⚠️ Aucune règle ici : qui peut écrire, et dans quelle province, vient de l'API
    (GET characters/{id}/mine-registry) ; les refus arrivent en FR et EN (apiMessage). L'écran DIT la
    province avant l'envoi — avec l'ajout seul, une erreur de province se remplace, elle ne s'efface pas.
  */

  const props = defineProps({
    text: { type: String, required: true },
    prices: { type: Object, required: true },
    rate: { type: [Number, String], default: null },
  })

  const { t, locale } = useI18n()
  const authStore = useAuthStore()

  const character = computed(() => (authStore.isLoggedIn ? authStore.activeCharacter : null))
  const access = ref(null)
  const pending = ref(null) // 409 : remplacement à confirmer { message, existing }
  const sending = ref(false)
  const showHelp = ref(false)
  const helpSteps = computed(() => [1, 2, 3, 4].map(n => t(`EconomyMines.Registry.HelpStep${n}`)))

  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })

  async function loadAccess() {
    access.value = null
    pending.value = null
    if (!character.value) return
    try {
      const { data } = await http.get(`characters/${character.value.id}/mine-registry`, auth())
      access.value = data
    } catch {
      access.value = null // pas d'accès connu : le bloc reste caché, le Bilan public fonctionne
    }
  }
  watch(() => character.value?.id, loadAccess, { immediate: true })

  const mines = computed(() => parseMinesText(props.text))
  const province = computed(() => access.value?.write?.name ?? null)
  const visible = computed(() => !!province.value && mines.value.length > 0)

  async function save(confirmReplace = false) {
    if (sending.value) return
    sending.value = true
    try {
      const { data } = await http.post(`characters/${character.value.id}/mine-reports`, {
        raw: props.text.trim(),
        report: { mines: mines.value, states: parseMineStates(props.text) },
        prices: { ...props.prices },
        rate: props.rate,
        confirm_replace: confirmReplace,
      }, auth())
      pending.value = null
      const saved = t('EconomyMines.Registry.Saved', { province: data.report.province_name })
      push.success(data.replaced
        ? `${saved} ${t('EconomyMines.Registry.Replaced', { pseudo: data.replaced.pseudo ?? t('EconomyMines.Registry.DeletedCharacter') })}`
        : saved)
    } catch (error) {
      if (error?.response?.status === 409) {
        pending.value = { message: apiMessage(error, locale.value, ''), existing: error.response.data.existing ?? null }
      } else {
        push.error(apiMessage(error, locale.value, t('Auth.Errors.NetworkError')))
      }
    } finally {
      sending.value = false
    }
  }
</script>

<template>
  <!-- Plaque du registre (charte §3.1 : plaque ardoise bordée d'ambre, texte crème — la matière des
       plaques du menu circulaire). Enregistrer au registre est un acte du titulaire : la plaque le
       détache de la carte claire du Bilan dans les deux thèmes, sans aplat d'alerte. Un seul point
       fort : le nom de la province, que le brief exige de dire AVANT l'envoi. Bouton or : la charte
       réserve l'or aux actions propres à un module, et l'or est la couleur d'Économie.
       Couleurs en CSS scopé : la spécificité (classe + attribut) passe devant la règle globale
       `.dark p`, et l'ambre n'est pas dans le thème Tailwind restreint. -->
  <section v-if="visible" class="registry-plate relative mx-auto mt-10 w-full max-w-[15rem] rounded-2xl px-4 py-5 text-center"
           aria-labelledby="mine-registry-title" data-testid="mine-registry">
    <!-- Aide : même icône que celle du Bilan (fa-info-circle, MainEconomy), en coin de plaque. -->
    <button type="button" class="plate-help absolute right-2 top-2" :aria-label="t('EconomyMines.Registry.HelpButton')"
            :title="t('EconomyMines.Registry.HelpButton')" data-testid="mine-registry-help" @click="showHelp = true">
      <v-icon name="fa-info-circle" scale="0.9" />
    </button>
    <div class="flex flex-col items-center gap-2">
      <span class="odc-dot odc-dot--md odc--gold shrink-0" aria-hidden="true">
        <v-icon name="gi-scroll-unfurled" />
      </span>
      <h3 id="mine-registry-title" class="min-w-0 !mb-0 leading-tight">
        <span class="plate-kicker block text-sm font-normal">{{ t('EconomyMines.Registry.Title') }}</span>{{ ' ' }}
        <span class="plate-title block break-words text-xl font-bold">{{ province }}</span>
      </h3>
    </div>

    <div v-if="pending" role="alert" class="plate-rule mt-3 space-y-2 pt-3" data-testid="mine-registry-confirm">
      <p class="plate-title text-sm font-bold">{{ pending.message }}</p>
      <p v-if="pending.existing" class="plate-note text-sm">
        {{ t('EconomyMines.Registry.RecordedBy', {
          pseudo: pending.existing.pseudo ?? t('EconomyMines.Registry.DeletedCharacter'),
          office: pending.existing.office_label?.[locale] ?? '',
        }) }}
      </p>
      <div class="flex flex-wrap justify-center gap-2 pt-1">
        <button type="button" class="odc-btn odc-btn--soft odc--gold odc-btn--sm" :disabled="sending" @click="save(true)">
          {{ t('EconomyMines.Registry.Confirm') }}
        </button>
        <button type="button" class="odc-btn odc-btn--soft odc--slate odc-btn--sm" @click="pending = null">
          {{ t('EconomyMines.Registry.Cancel') }}
        </button>
      </div>
    </div>
    <button v-else type="button" class="mt-4 w-full odc-btn odc-btn--soft odc--gold" :disabled="sending" @click="save(false)">
      {{ t('EconomyMines.Registry.Save') }}
    </button>
  </section>
  <HelpModal
    :show="showHelp"
    :title="t('EconomyMines.Registry.HelpTitle')"
    :purpose="t('EconomyMines.Registry.HelpPurpose')"
    :overview="t('EconomyMines.Registry.HelpOverview')"
    :steps="helpSteps"
    @close="showHelp = false"
  />
</template>

<style scoped>
  /* Plaque ardoise bordée d'ambre : mêmes matières que les plaques du menu circulaire (charte §3.1,
     navMenuPalette.js) — ardoise slate-800 → slate-900, liseré ambre #d97706, ombre chaude brune. */
  .registry-plate {
    background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #d97706;
    box-shadow: inset 0 1px 0 rgb(253 230 138 / 0.18), 0 6px 16px -8px rgb(69 26 3 / 0.55);
  }
  /* Texte : or pâle (#fde68a, anneau de focus de la charte), crème (#fef3c7), ardoise claire. */
  .plate-kicker { color: #fde68a; }
  .plate-title { color: #fef3c7; }
  .plate-note { color: #cbd5e1; }
  .plate-rule { border-top: 1px solid rgb(180 83 9 / 0.6); }
  /* Icône d'aide : disque jaune (Greg, 08/10 — jaune 300, 11,1:1 sur l'ardoise), jaune 200 au survol. */
  .plate-help { color: #fde047; line-height: 0; }
  .plate-help:hover { color: #fef08a; }
</style>
