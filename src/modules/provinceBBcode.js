import { formatFieldDate } from '@/modules/playerDates'

/*
  Export forum de « Ma province » (fil admin/echanges/mandats-historique, 02 Q7) :
  - BBcode en FRANÇAIS FIXE, quelle que soit la langue de l'interface — même exception que
    SecurityGuet et EconomyMines : le forum du comté est francophone ;
  - dates en ANNÉE DU JEU (1474), par le module unique des champs de date.
  Logique pure, testée sans DOM. `history` : la réponse de GET characters/{id}/province.
*/
const date = (field, value) => formatFieldDate(field, value, 'fr')

const line = (holder) => {
  const from = date('history_started_at', holder.started_at)
  if (holder.ongoing) return `[*]${holder.pseudo} : depuis le ${from} (en cours)`
  const to = date('history_ended_at', holder.ended_at)
  return `[*]${holder.pseudo} : du ${from} au ${to} — ${holder.end_reason_label?.fr ?? ''}`.trimEnd()
}

export function provinceHistoryToBBcode(history) {
  const out = [
    `[b]Office des coffres — Historique des postes : ${history.province.name}[/b]`,
    "[i]L'Office n'enregistre que ce que les joueurs déclarent : un poste absent ici n'est pas forcément vacant dans le jeu.[/i]",
    '',
    '[u]Conseil comtal[/u]',
  ]
  for (const office of history.offices) {
    if (!office.holders.length) continue
    out.push(`[b]${office.label.fr}[/b]`, `[list]${office.holders.map(line).join('\n')}[/list]`)
  }
  out.push('', '[u]Maires[/u]')
  for (const group of history.mayors) {
    out.push(`[b]${group.city.name}[/b]`, `[list]${group.holders.map(line).join('\n')}[/list]`)
  }
  if (history.cities_without_mandate.length) {
    out.push(`Villes sans mandat déclaré : ${history.cities_without_mandate.join(', ')}.`)
  }
  return out.join('\n')
}
