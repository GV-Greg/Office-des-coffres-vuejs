/**
 * Ville proposée par défaut dans le Relevé de guet et le Registre de douane (Greg, 23/11/2026) : celle où le personnage est rattaché
 * (le douanier, le maire…), pourvu que le serveur la dise lisible ; à défaut, la première des villes lisibles. Aucun droit n'est décidé
 * ici : `cities` vient de `customs-access` (readable_cities), c'est seulement un choix de présentation.
 *
 * @param {{ id: number }[]} cities  villes lisibles dites par le serveur
 * @param {{ city_id?: number|null }|null} character  personnage actif
 * @returns {number|null}
 */
export function defaultCityId(cities, character) {
  const list = cities ?? []
  return (list.find(c => c.id === character?.city_id) ?? list[0])?.id ?? null
}
