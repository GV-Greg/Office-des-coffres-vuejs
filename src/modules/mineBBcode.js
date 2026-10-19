// Export BBcode d'un bilan de mines — logique pure, partagée par le Bilan public (EconomyMines) et par
// le Registre (bilans hebdomadaires revus, lot 2 des prix). Extraite d'EconomyMines.vue : un seul gabarit
// pour deux écrans, le forum du jeu ne doit jamais voir deux mises en page.
//
// `t` est la fonction de traduction de l'écran appelant (vue-i18n) : les libellés suivent la langue de
// l'interface, les clés sont celles d'`EconomyMines.*`.

// Couleurs des titres de mine dans les exports BBcode, choisies sur deux critères :
// évoquer la matière première, et rester lisibles sur le fond beige des [quote] du
// forum du jeu (#d5bc84, relevé sur une capture réelle). Les teintes précédentes
// (darkgoldenrod, seagreen, darkgray...) plafonnaient entre 1,27:1 et 2,3:1 de
// contraste, soit illisibles ; celles-ci sont toutes au-dessus de 4,5:1 (WCAG AA).
export const RESOURCE_COLOR = {
  OR: '#574000',      // or brun foncé      — 5,31:1
  PIERRE: '#4a4a4a',  // gris ardoise       — 4,79:1
  FER: '#26414c',     // acier bleuté       — 5,84:1
  ARGILE: '#7d3309',  // terre cuite        — 4,83:1
  SEL: '#14507d',     // bleu marin         — 4,59:1
}

export function formatNum(n) {
  return Number(n.toFixed(2)).toLocaleString('fr-FR')
}

// La production n'a pas d'unité commune (écus d'or, kg de fer, qx de pierre…) : l'unité suit le
// nombre, dans chaque case.
export function productionWithUnit(line, t) {
  const unit = line.resource ? t(`EconomyMines.Units.${line.resource}`) : ''
  return `${formatNum(line.production)} ${unit}`.trim()
}

// Solde et net signés et colorés pour le forum : green / red, choix de Greg (06/10/2026).
// ⚠️ Contraste sous 4,5:1 sur le fond clair du [quote] (#f0e8d0) : green 4,20:1, red 3,27:1 — le
// texte est en gras, et le signe (+/−) porte l'information sans la couleur. Variantes foncées
// mesurées si besoin : #14451a 9,05:1, #7a1010 8,99:1.
export function signed(n) {
  const color = n < 0 ? 'red' : 'green'
  return `[color=${color}]${n > 0 ? '+' : ''}${formatNum(n)}[/color]`
}

/**
 * @param {object} b      bilan (computePeriodBilan)
 * @param {{ title: string, week: string, t: Function }} options
 *   `week` : le libellé de la période, déjà dit en dates du JEU (le même que le sélecteur de l'écran).
 */
export function bilanToBBcode(b, { title, week, t }) {
  // Une copie de ce que le titulaire a vu : la table par mine, la ligne Total et la convention
  // (fil bilan-mines, Q11). Jamais l'alerte de seuil (Q9 bis), jamais une semaine incomplète (Q10).
  // Mise en page : UN seul [quote] (un cadre par mine alourdissait le forum — Greg, 05/10/2026), l'unité
  // dite une fois en tête, quatre lignes par mine, le solde en évidence et coloré, puis le Total et le
  // net en grand.
  const bbt = (key, params) => t(`EconomyMines.Bb.${key}`, params ?? {})
  const upkeep = (pierre, fer) => `${formatNum(pierre)} ${t('EconomyMines.Units.PIERRE')} / ${formatNum(fer)} ${t('EconomyMines.Units.FER')}`

  // Couleurs du titre et de la semaine choisies par Greg (06/10/2026) : darkblue 12,5:1 et
  // darkgreen 6,1:1 sur le fond clair du [quote] (#f0e8d0).
  let bb = `[quote][center][b][size=20][color=darkblue]${title}[/color][/size][/b]\n[i][color=darkgreen]${week}[/color][/i]\n`
  // Un taux qui a changé en cours de période (prix par période) ne tient pas en un chiffre : il est tu.
  if (b.rate !== null) bb += `[size=10]${bbt('Amounts', { rate: formatNum(b.rate) })}[/size]`
  bb += '[/center]\n'
  // Forme donnée par Greg (06/10/2026) : « [list][*] » collés, sans retour à la ligne entre les deux
  // — c'est ce retour, rendu en ligne vide par le forum, qui creusait un blanc sous chaque titre.
  const list = items => `[list][*]${items.join('\n[*]')}\n[/list]\n`
  for (const line of b.lines) {
    const color = RESOURCE_COLOR[line.resource] || 'black'
    bb += `[color=${color}][b][size=14]${line.label}[/size][/b][/color] [size=10](#${line.number}${line.noeud ? ' - Noeud ' + line.noeud : ''})[/size]\n`
    bb += list([
      // L'or produit des écus : sa production EST sa valeur, inutile de la répéter.
      `${bbt('Production')} : ${productionWithUnit(line, t)}${line.resource === 'OR' ? '' : ` — ${bbt('Value')} ${formatNum(line.valeur)} ${t('EconomyMines.Currency')}`}`,
      `${bbt('Wages')} : ${formatNum(line.salaire)} ${t('EconomyMines.Currency')} (${formatNum(line.heures)} h)`,
      `${bbt('Upkeep')} : ${formatNum(line.entretien)} ${t('EconomyMines.Currency')} (${upkeep(line.pierre, line.fer)})`,
      `[b]${bbt('Balance')} : ${signed(line.solde)}[/b]`,
    ])
  }
  // Le Total suit la forme d'une mine ; le net, à gauche, le conclut en grand.
  bb += `[b][size=14]${bbt('TotalTitle')}[/size][/b]\n`
  bb += list([
    `${bbt('ValueProduced')} : ${formatNum(b.total.valeur)} ${t('EconomyMines.Currency')}`,
    `${bbt('Wages')} : ${formatNum(b.total.salaire)} ${t('EconomyMines.Currency')} (${formatNum(b.total.heures)} h${b.rate !== null ? ` × ${formatNum(b.rate)}` : ''})`,
    `${bbt('Upkeep')} : ${formatNum(b.total.entretien)} ${t('EconomyMines.Currency')} (${upkeep(b.total.pierre, b.total.fer)})`,
  ])
  bb += `[size=18][b]${t('EconomyMines.NetLabel')} : ${signed(b.net)} ${t('EconomyMines.Currency')}[/b][/size]\n`
  bb += `[size=9][i]${t('EconomyMines.Convention')}[/i][/size][/quote]`
  return bb
}
