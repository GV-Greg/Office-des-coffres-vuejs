import { ref } from 'vue'

// Délai avant affichage : évite un flash de l'overlay sur les navigations déjà
// en cache (chunk déjà téléchargé) ou sur les vues chargées en eager (Welcome, Login...).
const SHOW_DELAY_MS = 150

const isNavigationLoading = ref(false)
// 'office' = navigation générale (Accueil, compte, pages publiques) ; 'chest' = un module
// "Coffres X" (Économie, Sécurité, Animation) — reflète la métaphore Office/Coffres du site.
const navigationContext = ref('office')
let showTimer = null

export default function useNavigationLoading() {
  const startNavigationLoading = (context = 'office') => {
    navigationContext.value = context
    clearTimeout(showTimer)
    showTimer = setTimeout(() => {
      isNavigationLoading.value = true
    }, SHOW_DELAY_MS)
  }

  const stopNavigationLoading = () => {
    clearTimeout(showTimer)
    isNavigationLoading.value = false
  }

  return { isNavigationLoading, navigationContext, startNavigationLoading, stopNavigationLoading }
}
