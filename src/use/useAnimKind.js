import { useI18n } from 'vue-i18n'
import { ANIM_KINDS } from '@/modules/animKinds'

/*
  Les textes d'un type d'activité : `kt('Manage.Title')` lit `Animation.{ns}.Manage.Title` du type (ex. `Animation.Rewards.Manage.Title`) et,
  à défaut, la clé commune `Animation.Manage.Title`. Un type ne redéfinit que ce qu'il dit autrement ; pour Décode, les deux sont la même clé.
*/
export default function useAnimKind(key) {
  const { t, te, locale } = useI18n()
  const kind = ANIM_KINDS[key]
  const path = p => {
    const own = `${kind.ns}.${p}`
    return te(own) ? own : `Animation.${p}`
  }
  const kt = (p, params) => t(path(p), params)
  const has = p => te(`${kind.ns}.${p}`) || te(`Animation.${p}`)
  return { kind, kt, has, t, locale }
}
