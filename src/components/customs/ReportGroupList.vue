<script setup>
  import { useI18n } from 'vue-i18n'
  import CustomsPseudo from '@/components/customs/CustomsPseudo.vue'

  /*
    Liste de groupes d'un bilan (Registre de douane). Seul « Groupe de … » alerte (« groupe à surveiller », jamais « brigand ») ; le DÉTAIL d'un groupe
    (« Fermé », « Admission libre »…) n'est ni gardé ni montré (Greg, 23/11/2026).
  */
  defineProps({ groups: { type: Array, required: true } })
  const { t } = useI18n()
</script>

<template>
  <ul class="space-y-2">
    <li v-for="(group, index) in groups" :key="index" class="text-sm text-slate-800 dark:text-slate-800" :data-alert="group.alert ? 'true' : 'false'">
      <span class="font-bold">{{ t(`SecurityCustoms.Report.GroupTypes.${group.type}`) }}</span>
      <span v-if="group.alert" class="ml-1 inline-flex items-center gap-1 rounded border border-orange-600 bg-orange-100 px-1.5 text-xs font-bold text-orange-900" data-testid="group-alert">
        <v-icon name="fa-exclamation-triangle" scale="0.7" aria-hidden="true" />
        {{ t('SecurityCustoms.Report.GroupAlert') }}
      </span>
      <span class="ml-1 inline-flex flex-wrap gap-1">
        <CustomsPseudo v-for="p in group.members" :key="p.pseudo" :pseudo="p.pseudo" :colour="p.colour" />
      </span>
    </li>
  </ul>
</template>
