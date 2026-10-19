<script setup>
  import { computed } from 'vue'
  import { accentOf } from '@/modules/moduleAccents'

  /*
    Le coffre du logo (assets/logo/ecu.svg) : acajou, ferrures d'argent, serrure en laiton, mêmes dégradés — exception
    à la charte §3.1 documentée (illustration de chargement). La couleur du MODULE ne sert qu'à la lueur et aux faisceaux.
    Le couvercle se retourne : la façade s'aplatit, le dessous se déploie. Tout est transition ou animation FINIE
    (charte §8) ; le mouvement réduit les coupe par la règle globale de base.css.
    Voir admin/content/demo-animations-chargement.html.
  */
  const props = defineProps({
    open: { type: Boolean, default: false },
    burst: { type: Boolean, default: false },
    shake: { type: Boolean, default: false },
    accent: { type: String, default: 'gold' },
    size: { type: Number, default: 168 },
  })

  const vars = computed(() => {
    const { tint, rgb } = accentOf(props.accent)
    return { '--chest-tint': tint, '--chest-rgb': rgb, '--chest-size': `${props.size}px` }
  })
</script>

<template>
  <div class="chest" :class="{ 'is-open': open, 'is-burst': burst, 'is-shake': shake }" :style="vars" aria-hidden="true">
    <span class="glow"><i /></span>
    <svg class="art" viewBox="26 20 68 64">
      <defs>
        <linearGradient id="odc-chest-aW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a4452c" /><stop offset="1" stop-color="#5c1a0f" /></linearGradient>
        <linearGradient id="odc-chest-aL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0603f" /><stop offset="1" stop-color="#7a2816" /></linearGradient>
        <linearGradient id="odc-chest-hB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset="0.4" stop-color="#cbd5e1" /><stop offset="1" stop-color="#475569" /></linearGradient>
        <linearGradient id="odc-chest-hP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef3c7" /><stop offset="0.5" stop-color="#fbbf24" /><stop offset="1" stop-color="#92400e" /></linearGradient>
        <linearGradient id="odc-chest-in" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color: var(--chest-tint); stop-opacity: 0.95" /><stop offset="1" style="stop-color: var(--chest-tint); stop-opacity: 0.2" /></linearGradient>
        <linearGradient id="odc-chest-ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color: var(--chest-tint); stop-opacity: 0.65" /><stop offset="1" style="stop-color: var(--chest-tint); stop-opacity: 0" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="81.5" rx="31" ry="3.5" fill="#0f172a" opacity=".2" />
      <g class="lid-open">
        <path d="M36 46 L39 26 Q60 19.5 81 26 L84 46 Z" fill="#5c1a0f" stroke="#1e293b" stroke-width="1.2" stroke-linejoin="round" />
        <path d="M41 44 L43 29 Q60 24.5 77 29 L79 44 Z" fill="#3b0d06" />
        <path d="M37.5 45 L40 27 Q60 21 80 27 L82.5 45" fill="none" stroke="url(#odc-chest-hB)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
      </g>
      <g class="rays">
        <path d="M44 47 L26 18 L40 14 L56 46 Z" fill="url(#odc-chest-ray)" /><path d="M54 46 L52 10 L68 10 L66 46 Z" fill="url(#odc-chest-ray)" /><path d="M76 47 L94 18 L80 14 L64 46 Z" fill="url(#odc-chest-ray)" />
      </g>
      <path d="M34 52 L86 52 L83 44 L37 44 Z" fill="#1c0a02" />
      <path class="in-glow" d="M34 52 L86 52 L83 44 L37 44 Z" fill="url(#odc-chest-in)" />
      <rect x="32" y="53" width="56" height="27" rx="5" fill="url(#odc-chest-aW)" />
      <g stroke="#3b0d06" stroke-width="1" fill="none" stroke-linecap="round"><path d="M35 62H85" /><path d="M35 71H85" /></g>
      <rect x="34" y="55" width="52" height="23" rx="4" fill="none" stroke="#1e293b" stroke-width="6.2" stroke-linejoin="round" />
      <rect x="34" y="55" width="52" height="23" rx="4" fill="none" stroke="url(#odc-chest-hB)" stroke-width="4.5" stroke-linejoin="round" />
      <g class="lid-closed">
        <path d="M32 52V46Q32 29 60 29Q88 29 88 46V52Z" fill="url(#odc-chest-aL)" />
        <path d="M36 40Q60 32 84 40" fill="none" stroke="#3b0d06" stroke-width="1" stroke-linecap="round" />
        <path d="M34 51V46Q34 31 60 31Q86 31 86 46V51" fill="none" stroke="#1e293b" stroke-width="6.2" stroke-linejoin="round" />
        <path d="M34 51V46Q34 31 60 31Q86 31 86 46V51" fill="none" stroke="url(#odc-chest-hB)" stroke-width="4.5" stroke-linejoin="round" />
        <path d="M40 36Q60 30.5 80 36" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.6" stroke-linecap="round" />
      </g>
      <rect x="29.5" y="49" width="61" height="8" rx="4" fill="url(#odc-chest-hB)" stroke="#1e293b" stroke-width="0.9" />
      <path d="M31.5 50.5H88.5" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1" />
      <rect x="50" y="45" width="20" height="22" rx="6" fill="url(#odc-chest-hP)" stroke="#451a03" stroke-width="0.9" />
      <rect x="52" y="46.5" width="16" height="5" rx="2.5" fill="#ffffff" opacity="0.3" />
      <circle cx="60" cy="54.5" r="3" fill="#451a03" />
      <path d="M58.4 56H61.6L62.6 62.5H57.4Z" fill="#451a03" />
      <g class="motes"><circle cx="46" cy="38" r="1.2" /><circle cx="58" cy="31" r="1" /><circle cx="70" cy="36" r="1.3" /><circle cx="78" cy="28" r="1" /><circle cx="52" cy="26" r="0.9" /></g>
    </svg>
  </div>
</template>

<style scoped>
  .chest { position: relative; width: var(--chest-size); height: calc(var(--chest-size) * 0.94); margin: 0 auto; }
  .art { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .lid-closed, .lid-open { transform-box: fill-box; transform-origin: 50% 100%; }
  /* État de base = FERMETURE : le dessous se replie, puis la façade retombe. L'ouverture (.is-open) a ses propres durées. */
  .lid-closed { transition: transform 0.55s cubic-bezier(0.3, 1.35, 0.5, 1) 0.4s, opacity 0.1s linear 0.4s; }
  .lid-open { transform: scaleY(0.02); opacity: 0; transition: transform 0.5s cubic-bezier(0.5, 0, 0.9, 0.6), opacity 0.1s linear 0.45s; }
  .is-open .lid-closed { transform: scaleY(0.04); opacity: 0; transition: transform 0.5s cubic-bezier(0.5, 0, 0.9, 0.6) 0.05s, opacity 0.12s linear 0.45s; }
  .is-open .lid-open { transform: scaleY(1); opacity: 1; transition: transform 0.8s cubic-bezier(0.25, 1.1, 0.4, 1) 0.45s, opacity 0.12s linear 0.45s; }
  .rays, .in-glow { opacity: 0; transition: opacity 0.7s ease; }
  .is-open .rays { opacity: 1; transition-delay: 0.95s; }
  .is-open .in-glow { opacity: 1; transition-delay: 0.85s; }
  .motes circle { fill: #fbbf24; opacity: 0; }
  .is-open .motes circle { animation: chest-mote 1.7s ease-out 1 both; }
  .is-open .motes circle:nth-child(1) { animation-delay: 1.1s; }
  .is-open .motes circle:nth-child(2) { animation-delay: 1.35s; }
  .is-open .motes circle:nth-child(3) { animation-delay: 1.2s; }
  .is-open .motes circle:nth-child(4) { animation-delay: 1.55s; }
  .is-open .motes circle:nth-child(5) { animation-delay: 1.45s; }
  .glow { position: absolute; inset: -22%; border-radius: 50%; opacity: 0; transition: opacity 0.5s ease; pointer-events: none;
    background: radial-gradient(circle, rgba(var(--chest-rgb), 0.5) 0%, rgba(var(--chest-rgb), 0.22) 42%, transparent 70%); }
  .glow i { position: absolute; inset: 0; border-radius: 50%; background: inherit; }
  .is-open .glow { opacity: 1; transition-delay: 0.8s; }
  /* Lueur : deux pulsations puis elle reste fixe — jamais en boucle (charte §8). */
  .is-open .glow i { animation: chest-pulse 0.8s ease-in-out 0.9s 2 alternate both; }
  .is-burst .glow { animation: chest-burst 0.55s ease-out 1 both; }
  .is-shake { animation: chest-shake 0.45s ease 1; }
  @keyframes chest-pulse { from { transform: scale(0.86); opacity: 0.55; } to { transform: scale(1.08); opacity: 1; } }
  @keyframes chest-burst { from { transform: scale(1); opacity: 1; } to { transform: scale(2.1); opacity: 0; } }
  @keyframes chest-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  @keyframes chest-mote { 0% { opacity: 0; transform: translateY(4px); } 30% { opacity: 0.95; } 100% { opacity: 0; transform: translateY(-12px); } }
</style>
