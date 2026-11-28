<script setup>
  /*
    Rubrique d'un bilan de défense (Registre de douane). Passe de design du 24/11/2026 : fini la carte pastel au liseré coloré (le gabarit générique) —
    la matière de l'Office, celle des plaques du menu (charte §3.1) : une PLAQUE ardoise bordée d'ambre au texte crème, qui porte le titre, puis un corps
    clair. Une seule matière pour toutes les rubriques ; la couleur ne vit plus dans le fond mais dans la petite pastille de la plaque (la teinte du badge
    de la synthèse : bleu habitants, sarcelle entrées et sorties, rose groupes et couleur du module ; orange = quelque chose à surveiller ; ardoise = rien
    d'inscrit). Le corps reste CLAIR dans les deux thèmes : les couleurs de texte sont déclarées en `dark:` à l'intérieur (piège `.dark p`).
  */
  defineProps({
    title: { type: String, required: true },
    tone: { type: String, default: 'rose' }, // rose | blue | teal | violet | gold | alert | muted
    fill: { type: Boolean, default: false }, // prend toute la hauteur de sa colonne : deux cartes voisines s'alignent
    testid: { type: String, default: '' },
  })
</script>

<template>
  <section class="report-panel" :class="{ 'flex h-full flex-col': fill }" :data-tone="tone" :data-testid="testid || undefined">
    <header class="report-plate flex items-center gap-2 px-3 py-1.5">
      <span class="report-dot shrink-0" aria-hidden="true"></span>
      <h3 class="report-title !m-0 text-sm font-bold">{{ title }}</h3>
    </header>
    <div class="report-body px-3 py-3" :class="{ 'flex flex-1 flex-col': fill }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
  /* La plaque : ardoise bordée d'ambre, comme le menu circulaire et les plaques de registre. */
  .report-plate {
    background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #d97706;
    border-radius: 0.6rem 0.6rem 0 0;
    box-shadow: inset 0 1px 0 rgb(253 230 138 / 0.18);
  }
  .report-title { color: #fef3c7; }
  .report-body {
    background: #fff;
    border: 1px solid rgb(180 83 9 / 0.4);
    border-top: 0;
    border-radius: 0 0 0.6rem 0.6rem;
  }
  /* La teinte de la rubrique : une pastille, pas un fond. */
  .report-dot { width: 0.65rem; height: 0.65rem; border-radius: 9999px; background: #fb7185; }
  .report-panel[data-tone='blue'] .report-dot { background: #60a5fa; }
  .report-panel[data-tone='gold'] .report-dot { background: #eab308; }
  .report-panel[data-tone='teal'] .report-dot { background: #2dd4bf; }
  .report-panel[data-tone='violet'] .report-dot { background: #a78bfa; }
  .report-panel[data-tone='alert'] .report-dot { background: #fb923c; }
  .report-panel[data-tone='muted'] .report-dot { background: #64748b; }
  /* Rien d'inscrit : la plaque et le texte s'éteignent. */
  .report-panel[data-tone='muted'] .report-plate { border-color: #475569; }
  .report-panel[data-tone='muted'] .report-title { color: #94a3b8; }
  .report-panel[data-tone='muted'] .report-body { border-color: #cbd5e1; }
</style>
