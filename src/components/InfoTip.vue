<script setup>
  import { ref, nextTick } from 'vue'

  /*
    Infobulle « i » : survol, focus ou clic (tactile) ; Échap la ferme. Le texte est téléporté au <body> et placé en fixe à DROITE de l'icône
    (à gauche si la place manque, jamais coupé) : une carte ou une zone qui rogne son contenu (overflow) ne le coupe pas. Même mécanique que
    la carte de poste du Profil (OfficerStatusPanel), qui la garde pour elle.
  */
  defineProps({
    label: { type: String, required: true }, // nom accessible du bouton
    text: { type: String, required: true }, // contenu de l'infobulle
    testid: { type: String, default: 'info-tip' },
  })

  const id = `info-tip-${Math.random().toString(36).slice(2, 9)}`
  const open = ref(false)
  const button = ref(null)
  const pos = ref({ top: 0, left: 0 })
  const WIDTH = 288
  const HEIGHT = 150 // hauteur approchée, pour recaler l'infobulle dans la fenêtre

  async function place() {
    await nextTick()
    const rect = button.value?.getBoundingClientRect()
    if (!rect) return
    const onRight = rect.right + 8 + WIDTH <= window.innerWidth - 8
    const left = onRight ? rect.right + 8 : Math.max(8, rect.left - 8 - WIDTH)
    const top = Math.max(8, Math.min(rect.top - 6, window.innerHeight - HEIGHT - 8))
    pos.value = { left, top }
  }
  const show = () => { open.value = true; place() }
  const toggle = () => (open.value ? (open.value = false) : show())
</script>

<template>
  <span class="inline-flex" @mouseenter="show" @mouseleave="open = false">
    <button
      ref="button"
      type="button"
      class="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
      :aria-label="label"
      :aria-expanded="open"
      :aria-describedby="id"
      :data-testid="`${testid}-button`"
      @click="toggle"
      @focus="show"
      @blur="open = false"
      @keydown.esc="open = false"
    >
      <v-icon name="fa-info-circle" scale="1" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <span
        v-show="open"
        :id="id"
        role="tooltip"
        class="fixed z-[60] w-72 rounded-md bg-slate-800 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
        :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
        :data-testid="testid"
      >{{ text }}</span>
    </Teleport>
  </span>
</template>
