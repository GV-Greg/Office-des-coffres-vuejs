import { http } from '@/api'
import { BYPASS_HEADER, isMaintenanceError, isValidBypassSecret, reportMaintenance, setBypass, setChecking } from '@/use/useMaintenance'

// Sonde de démarrage du mode maintenance (Greg, 18/11/2026 : « le loader global »).
//
// Sans elle, le site ne sait que l'Office est fermé qu'à la première réponse d'API de la page — et
// s'affiche normalement jusque-là (l'accueil et /login n'en font aucune). Lancée par main.js AVANT le
// montage, elle pose `isChecking` : le loader global (LoadingOverlay) couvre le site jusqu'à la
// réponse, qui montre soit la page de maintenance, soit le site.
//
// - Route : `auth/me` SANS jeton. Elle répond 401 tout de suite, sans toucher la base ; fermée, le
//   middleware de maintenance répond avant, 503. Aucun jeton ne part, aucune donnée du joueur non plus.
// - `validateStatus` accepte tout statut : un 401 est ici la réponse normale, et ne doit pas passer par
//   l'intercepteur 401 d'authStore (il tenterait de renouveler une session qui n'est pas en cause).
// - **Jamais bloquant** : au-delà de PROBE_TIMEOUT_MS, ou sur une erreur réseau, le loader se retire et
//   le site s'ouvre (une API qui ne répond pas n'est pas une maintenance annoncée).
export const PROBE_TIMEOUT_MS = 2500

//
// `cover: false` — arrivée sur le portail d'accueil (`/`, voir main.js) : on n'est pas encore « entré » dans l'Office, aucun loader
// ne doit le dire (Greg, 20/11/2026). La sonde tourne quand même : fermé, la page de maintenance prend la place du portail.
export async function probeMaintenance({ cover = true } = {}) {
  if (cover) setChecking(true)
  try {
    const response = await http.get('auth/me', { timeout: PROBE_TIMEOUT_MS, validateStatus: () => true })
    if (isMaintenanceError({ response })) reportMaintenance({ response })
  } catch {
    // Délai dépassé ou réseau coupé : on ouvre le site.
  } finally {
    setChecking(false)
  }
}

// Accès administrateur depuis la page de maintenance (Greg, 18/11/2026 : « un bouton pour contourner »). Le secret saisi est ESSAYÉ
// avant d'être gardé : même route que la sonde (`auth/me`, sans jeton), avec le secret dans l'en-tête de contournement. Fermé pour
// lui aussi (503 « maintenance ») = secret refusé, rien n'est mémorisé ; sinon l'accès s'ouvre (setBypass le garde pour l'onglet).
// Le secret ne vit nulle part dans le code du site : il n'existe que dans la tête de l'administrateur et sur le serveur.
//   'ok' accès ouvert · 'refused' secret mauvais ou de forme invalide · 'error' vérification impossible (réseau, délai).
export const TRY_BYPASS_TIMEOUT_MS = 8000

export async function tryBypass(secret) {
  const value = String(secret ?? '').trim()
  if (!isValidBypassSecret(value)) return 'refused'
  try {
    const response = await http.get('auth/me', { timeout: TRY_BYPASS_TIMEOUT_MS, validateStatus: () => true, headers: { [BYPASS_HEADER]: value } })
    if (isMaintenanceError({ response })) return 'refused'
    setBypass(value)
    return 'ok'
  } catch {
    return 'error'
  }
}
