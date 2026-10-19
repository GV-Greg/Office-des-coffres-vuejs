import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'
import useSharedResource from '@/use/useSharedResource'

/*
  Accès d'un personnage au Registre des mines : GET characters/{id}/mine-registry → { write, read, prices }.
  Quatre composants le demandaient chacun (menu d'Économie, Bilan, plaque d'enregistrement, prix) : ils partagent
  maintenant une requête et attendent `ready` avant de choisir ce qu'ils montrent. ⚠️ Aucune règle ici : le serveur décide.
  `characterId` : une ref, un getter ou une valeur ; null = personne (prêt tout de suite, aucun droit).
*/
export default function useMineAccess(characterId) {
  const authStore = useAuthStore()
  const { data, ready, reload } = useSharedResource(
    'mine-access',
    characterId,
    (id) => http.get(`characters/${id}/mine-registry`, { headers: { Authorization: `Bearer ${authStore.getToken}` } }).then(({ data }) => data),
  )
  return { access: data, ready, reload }
}
