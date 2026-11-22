import { useAuthStore } from '@/stores/authStore'
import useSharedResource from '@/use/useSharedResource'
import customsApi from '@/use/customsApi'

/*
  État « douanier » d'un personnage : GET characters/{id}/customs → { officer, can_request, decider }. Le menu de la Sécurité (lien « Douaniers » pour
  qui valide) et la page de validation le demandent chacun : ils partagent une requête et attendent `ready`. ⚠️ Aucune règle ici : le serveur décide.
  `characterId` : une ref, un getter ou une valeur ; null = personne.
*/
export default function useCustomsOfficer(characterId) {
  const authStore = useAuthStore()
  const api = customsApi()
  const { data, ready, error, reload } = useSharedResource(
    'customs-officer',
    characterId,
    id => (authStore.isLoggedIn ? api.officer(id) : Promise.resolve(null)),
  )
  return { state: data, ready, error, reload }
}
