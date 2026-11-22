import { ref } from 'vue'

/*
  Signal minimal entre la modale « Demander un poste » (qui envoie la demande de douanier) et les blocs du Profil qui affichent le statut : une demande
  envoyée incrémente la version, les blocs se relisent. Aucune donnée ici — le serveur reste la seule source (GET characters/{id}/customs).
*/
export const customsVersion = ref(0)
export const bumpCustoms = () => { customsVersion.value += 1 }
