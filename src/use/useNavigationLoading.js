import { ref } from 'vue'

// Délai avant affichage : évite un flash de l'overlay sur les navigations déjà
// en cache (chunk déjà téléchargé) ou sur les vues chargées en eager (Welcome, Login...).
const SHOW_DELAY_MS = 150

const isNavigationLoading = ref(false)
// 'office' = navigation générale (Accueil, compte, pages publiques) ; 'chest' = un module
// "Coffres X" (Économie, Sécurité, Animation) — reflète la métaphore Office/Coffres du site ;
// 'api' = un envoi à l'API sans navigation (inscription, renvoi de lien, résidence...) : même
// écran, autre phrase. Le routeur ne voit pas ces requêtes, voir trackApiCall() plus bas.
const navigationContext = ref('office')
let showTimer = null
// Écran « tenu » : la navigation qui suit un envoi (connexion → /app/) garde la même phrase au
// lieu de la remplacer, et n'en relance pas le délai — un seul écran du clic à l'arrivée. stop()
// (afterEach/onError du routeur, ou l'échec de l'envoi) le libère.
let held = false

export default function useNavigationLoading() {
  const startNavigationLoading = (context = 'office', { hold = false } = {}) => {
    if (held) return
    held = hold
    navigationContext.value = context
    clearTimeout(showTimer)
    showTimer = setTimeout(() => {
      isNavigationLoading.value = true
    }, SHOW_DELAY_MS)
  }

  const stopNavigationLoading = () => {
    held = false
    clearTimeout(showTimer)
    isNavigationLoading.value = false
  }

  // Couvre une requête lancée par l'utilisateur : sans ça, rien ne bouge pendant l'attente (jusqu'à
  // 20 s, délai d'api.js). `navigates` : le succès enchaîne sur router.push, dont l'arrivée
  // fermera l'écran ; sinon il se ferme à la réponse. Un échec le ferme toujours.
  const trackApiCall = (promise, { context = 'api', navigates = false } = {}) => {
    startNavigationLoading(context, { hold: navigates })
    return promise.then(
      (result) => {
        if (!navigates) stopNavigationLoading()
        return result
      },
      (error) => {
        stopNavigationLoading()
        throw error
      },
    )
  }

  return { isNavigationLoading, navigationContext, startNavigationLoading, stopNavigationLoading, trackApiCall }
}
