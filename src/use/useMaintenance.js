import { ref, computed } from 'vue'

// Mode maintenance (brief admin/content/brief-mode-maintenance.md, 18/11/2026).
//
// Quand l'Office est fermé, l'API répond 503 `{ message: "maintenance", retry_after }` à tout appel.
// api.js le signale ici (reportMaintenance) et MaintenanceNotice affiche sa page, embarquée dans
// l'application : elle ne dépend d'aucun appel à l'API.
//
// Bypass administrateur : le secret de `php artisan down --secret` (ici posé par le workflow de
// déploiement) s'ouvre par `/maintenance/<secret>` sur ce site. Il est gardé pour l'onglet
// seulement (sessionStorage) et envoyé à l'API dans l'en-tête X-Maintenance-Bypass — un cookie
// n'irait pas : le site et l'API sont deux origines, et axios n'envoie aucun cookie. Sert à
// essayer une mise à jour avant de rouvrir l'Office.
//
// 🔴 Stockage : c'est un identifiant d'administrateur, strictement nécessaire à ce qu'il demande
// (comme le jeton d'auth), jamais une donnée de joueur ni une préférence : hors consentement,
// d'où l'accès direct à sessionStorage ici (liste blanche de tests/enforcement/storage-usage).

export const BYPASS_HEADER = 'X-Maintenance-Bypass'
export const DEFAULT_RETRY_SECONDS = 300

const STORAGE_KEY = 'maintenance_bypass'
// Le secret voyage dans un en-tête HTTP et une adresse : on n'en accepte que la forme que le
// workflow de déploiement impose (scripts/maintenance.sh côté backend).
const SECRET_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const isMaintenance = ref(false)
const retryAfter = ref(DEFAULT_RETRY_SECONDS)
// Vérification de démarrage en cours (use/maintenanceProbe.js) : le loader global couvre le site
// tant que l'API n'a pas dit si l'Office est ouvert, pour qu'un site fermé ne s'affiche pas une
// seconde avant sa page de maintenance (Greg, 18/11/2026).
const isChecking = ref(false)

const readStoredBypass = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY) || ''
    return SECRET_PATTERN.test(stored) ? stored : ''
  } catch {
    return ''
  }
}

const bypass = ref(readStoredBypass())

// Une 503 de maintenance : celle de Laravel porte `message: "maintenance"`. Un 503 quelconque
// de l'hébergeur n'est PAS une maintenance (il n'a pas ce corps) : l'appelant affiche son
// erreur réseau habituelle.
export const isMaintenanceError = (error) =>
  error?.response?.status === 503 && error.response.data?.message === 'maintenance'

export const reportMaintenance = (error) => {
  const seconds = Number(error?.response?.data?.retry_after)
  retryAfter.value = Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_SECONDS
  isMaintenance.value = true
}

export const setChecking = (value) => {
  isChecking.value = value
}

export const getBypass = () => bypass.value

export const setBypass = (secret) => {
  if (!SECRET_PATTERN.test(secret ?? '')) return false
  bypass.value = secret
  // Un secret présenté, c'est un accès qu'on retente : la page de maintenance affichée avant se retire.
  isMaintenance.value = false
  try {
    sessionStorage.setItem(STORAGE_KEY, secret)
  } catch {
    // Stockage refusé : le secret reste en mémoire, valable jusqu'au rechargement de la page.
  }
  return true
}

export const clearBypass = () => {
  bypass.value = ''
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // rien à retirer
  }
}

export default function useMaintenance() {
  return {
    isMaintenance,
    isChecking,
    retryAfter,
    hasBypass: computed(() => bypass.value !== ''),
    setBypass,
    clearBypass,
  }
}
