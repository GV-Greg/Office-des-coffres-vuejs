import { http } from '@/api.js'
import { useAuthStore } from '@/stores/authStore'

/*
  Appels de l'API des prix des mines (brief admin/content/brief-prix-registre.md, lot 2). Aucune règle :
  qui lit, écrit ou corrige est décidé par le serveur (`access.prices`, `editable` de chaque jeu) ;
  les refus arrivent en FR et EN (`apiMessage`). Les jetons sont attachés à la main, comme partout (api.js).
*/
export default function useMinePrices() {
  const authStore = useAuthStore()
  const auth = () => ({ headers: { Authorization: `Bearer ${authStore.getToken}` } })

  return {
    /** Ce que le personnage peut faire des prix, et dans quelle province : { write, read } (ou null). */
    async access(characterId) {
      const { data } = await http.get(`characters/${characterId}/mine-registry`, auth())
      return data
    },
    /** Tous les jeux de prix de la province, du plus récent au plus ancien. */
    async list(provinceId) {
      const { data } = await http.get(`provinces/${provinceId}/mine-prices`, auth())
      return data.prices
    },
    async create(provinceId, body) {
      const { data } = await http.post(`provinces/${provinceId}/mine-prices`, body, auth())
      return data.price
    },
    async update(provinceId, id, body) {
      const { data } = await http.put(`provinces/${provinceId}/mine-prices/${id}`, body, auth())
      return data.price
    },
  }
}
