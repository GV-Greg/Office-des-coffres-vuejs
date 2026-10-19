/*
  Durées du coffre de chargement (ChestLoader). Un seul endroit, pour que les tests et le mouvement réduit
  les neutralisent sans toucher aux composants. Budget de la charte §8 : 3 s de conception, 5 s de plafond ;
  le coffre tient dedans (ouverture ~1,4 s, lueur 2 × 0,8 s, fin ~1 s) puis reste FIXE tant que la page charge.
*/
export const timing = {
  showDelay: 150,   // rien ne s'affiche avant : une page rapide n'a jamais de coffre (même seuil que l'overlay global)
  openDone: 1400,   // l'étape « relever le couvercle » est cochée quand l'animation d'ouverture est finie
  burst: 250,       // après la dernière étape : la lueur jaillit…
  reveal: 600,      // …le coffre s'efface (0,35 s)…
  content: 950,     // …et SEULEMENT ENSUITE le contenu apparaît : jamais les deux à l'écran en même temps
  timeout: 10000,   // au-delà, le coffre se referme et propose « Réessayer »
  instant: false,   // tests : tout est synchrone
}

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Durées effectives : nulles en test, ou en mouvement réduit (rien à regarder, donc rien à attendre). */
export function effectiveTiming() {
  if (timing.instant || reduced()) return { ...timing, openDone: 0, burst: 0, reveal: 0, content: 0, showDelay: timing.instant ? 0 : timing.showDelay }
  return timing
}
