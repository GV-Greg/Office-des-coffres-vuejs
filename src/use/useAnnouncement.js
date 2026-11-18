import { ref } from 'vue'
import { http } from '@/api'

// Annonce du site (bandeau de l'accueil, 18/11/2026) : l'administrateur prévient d'une maintenance à venir,
// le backend sert la seule annonce en cours (`GET announcements/current`, publique, sans jeton).
// Contrat : { announcement: null | { id, message: { fr, en } (marqueur {quand} déjà remplacé), schedule, visible_until } }.
// ⚠️ Aucune règle côté site : le serveur choisit l'annonce, rédige la date, fixe la fin de visibilité.
// Une panne de l'API n'affiche rien — le bandeau est un confort, jamais une erreur.

// Le message dans la langue de l'interface, à défaut dans l'autre : une annonce n'est jamais muette.
export const pickMessage = (announcement, lang) => {
  const message = announcement?.message
  if (!message) return ''
  return (lang === 'en' ? message.en : message.fr) || message.fr || message.en || ''
}

// `visible_until` : fin de visibilité effective, calculée par le serveur. Le site la respecte aussi, pour retirer le bandeau
// d'une page restée ouverte (la réponse est gardée 60 s par le cache HTTP).
export const isExpired = (announcement, now = Date.now()) => {
  const until = announcement?.visible_until ? Date.parse(announcement.visible_until) : NaN
  return Number.isFinite(until) && until <= now
}

export async function fetchCurrentAnnouncement(now = Date.now()) {
  try {
    const { data } = await http.get('announcements/current')
    const announcement = data?.announcement ?? null
    return announcement && !isExpired(announcement, now) ? announcement : null
  } catch {
    return null
  }
}

export default function useAnnouncement() {
  const announcement = ref(null)
  const load = async () => {
    announcement.value = await fetchCurrentAnnouncement()
  }
  return { announcement, load }
}
