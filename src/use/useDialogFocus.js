import { watch, nextTick, onBeforeUnmount } from 'vue'

/*
  Comportement clavier d'une modale (mandats, lot 2) : à l'ouverture, le focus va au premier
  élément focalisable ; Tab et Maj+Tab restent DANS la modale ; Échap la ferme ; à la fermeture, le
  focus revient à l'élément qui l'a ouverte.

  ⚠️ Le brief citait DeleteAccountModal comme modèle « accessible, focus piégé, fermeture par
  Échap » : elle n'a ni l'un ni l'autre (constaté le 03/10/2026). Ce composable est prêt à lui être
  branché — dans une autre PR.
*/
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function useDialogFocus(isOpen, panelRef, onClose) {
  let opener = null

  const focusables = () => Array.from(panelRef.value?.querySelectorAll(FOCUSABLE) ?? [])

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusables()
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(isOpen, async (open) => {
    if (open) {
      opener = document.activeElement
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      focusables()[0]?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      opener?.focus?.()
      opener = null
    }
  }, { immediate: true })

  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
