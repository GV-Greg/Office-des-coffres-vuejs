<script setup>
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

/* Les deux pages du Livre des naissances. Montré seulement à qui peut lire un historique (le serveur le dit). */
defineProps({ current: { type: String, required: true } }) // 'calculator' | 'history'
const { t } = useI18n()
const tabs = [
  { key: 'calculator', route: 'economy-births', icon: 'gi-cow' },
  { key: 'history', route: 'economy-births-history', icon: 'gi-scroll-unfurled' },
]
</script>

<template>
  <nav :aria-label="t('EconomyBirths.Tabs.Label')" class="flex flex-wrap gap-2" data-testid="births-tabs">
    <RouterLink v-for="tab in tabs" :key="tab.key" :to="{ name: tab.route }" custom v-slot="{ href, navigate }">
      <a
        :href="href"
        class="odc-btn odc-btn--soft odc-btn--sm"
        :class="current === tab.key ? 'odc--gold' : 'odc--slate'"
        :aria-current="current === tab.key ? 'page' : undefined"
        :data-testid="`births-tab-${tab.key}`"
        @click="navigate"
      >
        <v-icon :name="tab.icon" aria-hidden="true" />{{ t(`EconomyBirths.Tabs.${tab.key}`) }}
      </a>
    </RouterLink>
  </nav>
</template>
