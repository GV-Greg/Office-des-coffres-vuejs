import { http } from '@/api'
import { isMaintenanceError, reportMaintenance, setChecking } from '@/use/useMaintenance'

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

export async function probeMaintenance() {
  setChecking(true)
  try {
    const response = await http.get('auth/me', { timeout: PROBE_TIMEOUT_MS, validateStatus: () => true })
    if (isMaintenanceError({ response })) reportMaintenance({ response })
  } catch {
    // Délai dépassé ou réseau coupé : on ouvre le site.
  } finally {
    setChecking(false)
  }
}
