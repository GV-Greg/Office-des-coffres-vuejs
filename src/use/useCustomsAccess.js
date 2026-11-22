import { useAuthStore } from '@/stores/authStore'
import useSharedResource from '@/use/useSharedResource'
import customsApi from '@/use/customsApi'

/*
  Accès d'un personnage au Registre de douane : GET characters/{id}/customs-access → { access } (null sans rôle). Le menu de la Sécurité et la
  page le demandent chacun : ils partagent une requête et attendent `ready`. ⚠️ Aucune règle ici : le serveur décide.
  `characterId` : une ref, un getter ou une valeur ; null = personne (prêt tout de suite, aucun droit).
*/
export default function useCustomsAccess(characterId) {
  const authStore = useAuthStore()
  const api = customsApi()
  const { data, ready, reload } = useSharedResource(
    'customs-access',
    characterId,
    id => (authStore.isLoggedIn ? api.access(id) : Promise.resolve(null)),
  )
  return { access: data, ready, reload }
}
