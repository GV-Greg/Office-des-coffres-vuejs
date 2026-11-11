import DecodeHero from '@/components/anim/DecodeHero.vue'
import RewardsGridHero from '@/components/anim/RewardsGridHero.vue'

// Les composants propres à chaque type d'activité, choisis par les écrans partagés (`views/modules/animation/Anim*View.vue`) :
// l'encadré sombre de tête (son visuel).
export const ANIM_COMPONENTS = {
  decode: { hero: DecodeHero },
  rewards: { hero: RewardsGridHero },
}
