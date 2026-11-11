<script setup>
  import { useI18n } from 'vue-i18n'
  import AnimCreateForm from '@/components/anim/AnimCreateForm.vue'
  import RewardsGridPreview from '@/components/anim/RewardsGridPreview.vue'

  /*
    Création d'une Grille des lots (mode PRIVÉ ou SANS COMPTE) : le formulaire et son écran de confirmation sont ceux d'`AnimCreateForm`, commun à
    toutes les activités d'Animation. Cette enveloppe n'ajoute que ce qui est PROPRE à la grille : les dimensions (largeur × hauteur), leur ligne
    du récapitulatif et la validité de forme. ⚠️ Aucune règle de bornes ici (elles sont au serveur, qui renvoie son refus `dimensions`, affiché
    sous les champs) : le site vérifie seulement que ce sont deux entiers.
  */
  defineProps({
    mode: { type: String, required: true, validator: v => ['private', 'anonymous'].includes(v) },
    errors: { type: Object, default: () => ({}) },
    submitting: { type: Boolean, default: false },
    slugDelay: { type: Number, default: 300 },
  })
  const emit = defineEmits(['confirm'])
  const { t } = useI18n()

  const defaults = { width: 5, height: 5 }
  const valid = extra => Number.isInteger(extra.width) && Number.isInteger(extra.height) && extra.width >= 1 && extra.height >= 1
  const recap = extra => [{
    key: 'dimensions',
    text: t('Animation.Rewards.Recap.Dimensions', { width: extra.width, height: extra.height, count: extra.width * extra.height }),
  }]
</script>

<template>
  <AnimCreateForm
    kind="rewards"
    wide
    :mode="mode"
    :errors="errors"
    :submitting="submitting"
    :slug-delay="slugDelay"
    :extra-defaults="defaults"
    :extra-valid="valid"
    :extra-recap="recap"
    @confirm="emit('confirm', $event)"
  >
    <!-- Les dimensions, dans la colonne de la grille (à gauche, sous le lieu). -->
    <template #extra="{ extra, errors: formErrors }">
      <fieldset data-testid="create-dimensions">
        <legend class="text-sm font-bold">{{ t('Animation.Rewards.Create.Dimensions') }}<span class="text-red-700 dark:text-red-700" aria-hidden="true"> *</span></legend>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="create-width" class="block text-sm font-bold">{{ t('Animation.Grid.Width') }}</label>
            <input id="create-width" v-model.number="extra.width" type="number" inputmode="numeric" required class="form-field w-full" data-testid="create-width" />
          </div>
          <div>
            <label for="create-height" class="block text-sm font-bold">{{ t('Animation.Grid.Height') }}</label>
            <input id="create-height" v-model.number="extra.height" type="number" inputmode="numeric" required class="form-field w-full" data-testid="create-height" />
          </div>
        </div>
        <p v-if="formErrors.dimensions || formErrors.width || formErrors.height" role="alert" class="text-sm text-red-700 dark:text-red-700" data-testid="create-error-dimensions">{{ formErrors.dimensions || formErrors.width || formErrors.height }}</p>
      </fieldset>
    </template>

    <!-- À droite : l'aperçu vivant, qui se redessine avec les dimensions saisies. -->
    <template #aside="{ extra }">
      <RewardsGridPreview class="laptop:sticky laptop:top-4" :width="extra.width" :height="extra.height" />
    </template>
  </AnimCreateForm>
</template>
