<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  /*
    Un pseudo du Registre de douane, avec sa couleur de liste. Le SENS est porté par le TEXTE et l'icône, jamais par la couleur seule
    (WCAG 1.4.1) : « liste rouge » / « liste verte » restent lisibles sans couleur. La carte est claire dans les deux thèmes : couleurs de fond
    clair, sans variante `dark:`. Le pseudo s'affiche tel que collé (casse d'origine) ; la comparaison se fait côté serveur, en minuscules.
  */
  const props = defineProps({
    pseudo: { type: String, required: true },
    colour: { type: String, default: null },
    // Lien vers la fiche du personnage sur le site du jeu (Relevé de guet : entrées et sorties). Un clic du joueur, jamais un chargement automatique.
    linked: { type: Boolean, default: false },
    // Sans cadre (Table des douanes, où l'on gagne de la place) : du texte simple ; l'icône, le texte caché et la couleur du texte gardent le sens.
    plain: { type: Boolean, default: false },
  })
  const { t } = useI18n()

  const classes = computed(() => (props.plain
    ? { red: 'font-bold text-red-800', green: 'font-bold text-green-800' }[props.colour] ?? 'text-slate-800'
    : { red: 'bg-red-100 text-red-900 border-red-500', green: 'bg-green-100 text-green-900 border-green-600' }[props.colour] ?? 'bg-slate-100 text-slate-800 border-slate-300'))
  const label = computed(() => (props.colour ? t(`SecurityCustoms.List.${props.colour === 'red' ? 'Red' : 'Green'}`) : ''))
</script>

<template>
  <span class="inline-flex items-center gap-1 text-sm" :class="[plain ? '' : 'rounded border px-1.5 py-0.5', classes]" :data-colour="colour ?? 'none'" data-testid="customs-pseudo">
    <v-icon v-if="colour === 'red'" name="fa-exclamation-triangle" scale="0.7" aria-hidden="true" />
    <v-icon v-else-if="colour === 'green'" name="fa-check-circle" scale="0.7" aria-hidden="true" />
    <a v-if="linked" class="underline" :href="`https://www.renaissancekingdoms.com/FichePersonnage.php?login=${encodeURIComponent(pseudo)}`" target="_blank" rel="noopener noreferrer" data-testid="customs-pseudo-link">{{ pseudo }}</a>
    <template v-else>{{ pseudo }}</template>
    <span v-if="label" class="sr-only">({{ label }})</span>
  </span>
</template>
