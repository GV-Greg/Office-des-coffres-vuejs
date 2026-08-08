/**
 * Calendrier du jeu.
 *
 * Renaissance Kingdoms ne se déroule pas à l'époque réelle : le jour et le mois sont
 * ceux du calendrier courant, mais l'année est celle du jeu (août 2026 → août 1474).
 * Tout ce qui est destiné à être lu par un joueur — export BBcode posté sur le forum,
 * libellés de période dans l'interface — doit porter l'année du jeu ; les données
 * manipulées en interne (relevés, bornes de semaine, clés de cache) restent en dates
 * réelles, c'est ce que produisent le collage du jeu et l'horloge du navigateur.
 *
 * On garde une table d'ancrages observés plutôt qu'un décalage unique codé en dur :
 * l'écart est constant (552 ans) sur tout ce qui a pu être vérifié, mais si le jeu
 * introduit un jour une rupture (année sautée, calendrier accéléré lors d'un événement),
 * il suffira d'ajouter une ligne ici — le reste du code n'a pas à changer.
 */

/**
 * En dessous de cette année, une date est considérée comme déjà exprimée dans le
 * calendrier du jeu. Le jeu se déroulant à la Renaissance et l'écart dépassant cinq
 * siècles, aucune date réelle manipulée par l'application ne peut tomber sous ce seuil.
 */
const REAL_YEAR_FLOOR = 1900

/** Correspondances constatées, année réelle → année du jeu. À compléter au fil des ans. */
export const YEAR_ANCHORS = [
  // Relevés hebdomadaires du Commissaire aux Mines de Greg, octobre → décembre 2025.
  { real: 2025, game: 1473 },
  // Confirmé par Greg le 08/08/2026.
  { real: 2026, game: 1474 },
]

/**
 * Année du jeu correspondant à une année réelle. Hors des ancrages connus, prolonge
 * l'écart de l'ancrage le plus proche (année du jeu et année réelle avancent du même
 * pas tant qu'aucune rupture n'a été constatée).
 */
export function gameYear(realYear) {
  const exact = YEAR_ANCHORS.find(a => a.real === realYear)
  if (exact) return exact.game

  const nearest = YEAR_ANCHORS.reduce((best, a) =>
    Math.abs(a.real - realYear) < Math.abs(best.real - realYear) ? a : best
  )
  return realYear - (nearest.real - nearest.game)
}

/**
 * Transpose une date ISO réelle (AAAA-MM-JJ) dans le calendrier du jeu, en ne
 * touchant qu'à l'année : '2026-08-08' → '1474-08-08'.
 *
 * Idempotente : une date déjà exprimée en année de jeu est renvoyée telle quelle.
 * Sans cette garde, une double application décalerait la date d'un second écart
 * (1474 → 922) — un bug silencieux, la date restant plausible à l'œil.
 */
export function toGameDateIso(dateIso) {
  if (typeof dateIso !== 'string' || dateIso.length < 4) return dateIso

  const year = Number(dateIso.slice(0, 4))
  if (!Number.isFinite(year) || year < REAL_YEAR_FLOOR) return dateIso
  return String(gameYear(year)) + dateIso.slice(4)
}
