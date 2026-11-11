import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { push } from 'notivue'
import i18n from '@/i18n/index'
import inventoryApi from '@/use/inventoryApi'
import { apiMessage } from '@/stores/mandateStore'
import { useAuthStore } from '@/stores/authStore'
import { useCookieStore } from '@/stores/cookieStore'

/*
  Réglages d'inventaire, aux trois niveaux — personnage, ville (maire), province (commissaire au commerce ; le dirigeant lit).
  Décision de Greg (11/11/2026) : « l'utilité du compte, c'est de se connecter partout et de retrouver ses paramètres ».

   - SANS COMPTE : tout reste dans le navigateur (cookieStore, comme avant) — seul le niveau personnel existe ;
   - AVEC un compte et un personnage actif : tout vient du SERVEUR, par personnage ; le navigateur n'est plus qu'un cache de passage.
     À la première connexion, les réglages du navigateur sont REPRIS en base sur le personnage actif, puis effacés d'ici.

  ⚠️ Aucune règle côté site : qui peut lire ou écrire un niveau, le serveur le dit (`scopes`) ; un refus s'affiche tel quel (`apiMessage`).
  Un même « document » de réglages vit des deux côtés : mêmes clés que l'API (voir backend App\Support\InventorySettingsDocument).
  Les écritures sont groupées (délai de SAVE_DELAY) et portent la version lue : si un autre appareil a écrit entre-temps, le serveur
  répond 409 avec l'état courant, qui remplace le nôtre.
*/

export const LEVELS = ['personal', 'city', 'province']

const SHARED_KEYS = ['custom', 'hiddenBuiltIn', 'order', 'exportColor', 'itemCategories']
const PERSONAL_ONLY_KEYS = ['exportQtyFormat', 'exportShowEcus', 'exportWrapper', 'visibility']
const keysFor = (level) => (level === 'personal' ? [...SHARED_KEYS, ...PERSONAL_ONLY_KEYS] : SHARED_KEYS)

/** Clés de confort du navigateur : les mêmes qu'avant ce chantier. */
const LOCAL = {
  catConfig: 'inventory_cat_config',
  cats: 'inventory_custom_cats',
  visibility: 'inventory_visibility',
  qty: 'inventory_export_qty_format',
  ecus: 'inventory_export_ecus',
  wrapper: 'inventory_export_wrapper',
  paste: 'inventory_paste',
}

export const SAVE_DELAY = 800

const arr = (v) => (Array.isArray(v) ? v : [])
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

/** Le document complet, avec ses valeurs par défaut. Un objet PHP vide revient en `[]` : on le rend `{}`. */
export function normalizeDoc(raw = {}) {
  const r = obj(raw)
  const visibility = obj(r.visibility)
  return {
    custom: arr(r.custom).map((c) => ({ key: c.key, fr: c.fr, en: c.en ?? c.fr })),
    hiddenBuiltIn: [...arr(r.hiddenBuiltIn)],
    order: [...arr(r.order)],
    exportColor: typeof r.exportColor === 'string' ? r.exportColor : undefined,
    itemCategories: { ...obj(r.itemCategories) },
    exportQtyFormat: r.exportQtyFormat === 'suffix' ? 'suffix' : 'prefix',
    exportShowEcus: r.exportShowEcus !== false,
    exportWrapper: ['rp', 'quote'].includes(r.exportWrapper) ? r.exportWrapper : 'none',
    visibility: { hiddenCategories: [...arr(visibility.hiddenCategories)], hiddenItems: [...arr(visibility.hiddenItems)] },
  }
}

/** Ce qui part au serveur : seulement les clés de ce niveau, jamais une valeur `undefined`. */
function toPayload(level, doc) {
  const out = {}
  for (const key of keysFor(level)) {
    if (doc[key] !== undefined) out[key] = doc[key]
  }
  return out
}

const isEmptyData = (data) => data == null || (typeof data === 'object' && Object.keys(data).length === 0)

/** Y a-t-il quelque chose à reprendre du navigateur ? (les options d'export comptent si elles ne sont plus celles par défaut) */
function hasContent(doc) {
  return doc.custom.length > 0 || doc.hiddenBuiltIn.length > 0 || doc.order.length > 0
    || Object.keys(doc.itemCategories).length > 0 || doc.exportColor !== undefined
    || doc.exportQtyFormat !== 'prefix' || doc.exportShowEcus === false || doc.exportWrapper !== 'none'
}

const t = (key, params) => i18n.global.t(key, params)
const locale = () => i18n.global.locale.value ?? i18n.global.locale

export const useInventoryStore = defineStore('inventory', () => {
  const auth = useAuthStore()
  const cookies = useCookieStore()
  const api = inventoryApi()

  const scopes = ref(null) // { personal, city, province } — null tant que non chargé, ou sans compte
  const history = ref(null) // historique de la province : { province, snapshots, can_write }
  const docs = reactive({}) // niveau → { data, version, status, saving, dirty, timer }
  const texts = reactive({}) // niveau → { raw, status, timer }
  const imported = ref(false) // les réglages du navigateur viennent d'être repris en base

  const serverMode = computed(() => auth.isLoggedIn && !!auth.activeCharacter)
  const characterId = computed(() => auth.activeCharacter?.id ?? null)

  /** Les niveaux que le personnage peut ouvrir MAINTENANT : le personnel toujours, la ville et la province selon son poste. */
  const availableLevels = computed(() => {
    if (!serverMode.value || !scopes.value) return ['personal']
    return LEVELS.filter((level) => level === 'personal' || scopes.value[level])
  })

  function canWrite(level) {
    if (level === 'personal') return true
    return serverMode.value && scopes.value?.[level]?.can_write === true
  }

  // ─── Navigateur (sans compte) ────────────────────────────────────────────────
  function readLocal() {
    return normalizeDoc({
      ...obj(cookies.getComfortData(LOCAL.catConfig, {})),
      itemCategories: cookies.getComfortData(LOCAL.cats, {}),
      visibility: cookies.getComfortData(LOCAL.visibility, {}),
      exportQtyFormat: cookies.getComfortData(LOCAL.qty, 'prefix'),
      exportShowEcus: cookies.getComfortData(LOCAL.ecus, true),
      exportWrapper: cookies.getComfortData(LOCAL.wrapper, 'none'),
    })
  }

  function writeLocal(doc) {
    cookies.setComfortData(LOCAL.catConfig, {
      custom: doc.custom,
      hiddenBuiltIn: doc.hiddenBuiltIn,
      order: doc.order,
      ...(doc.exportColor ? { exportColor: doc.exportColor } : {}),
    })
    cookies.setComfortData(LOCAL.cats, { ...doc.itemCategories })
    cookies.setComfortData(LOCAL.visibility, { ...doc.visibility })
    cookies.setComfortData(LOCAL.qty, doc.exportQtyFormat)
    cookies.setComfortData(LOCAL.ecus, doc.exportShowEcus)
    cookies.setComfortData(LOCAL.wrapper, doc.exportWrapper)
  }

  function clearLocalSettings() {
    for (const key of [LOCAL.catConfig, LOCAL.cats, LOCAL.visibility, LOCAL.qty, LOCAL.ecus, LOCAL.wrapper]) {
      cookies.removeComfortData(key)
    }
  }

  // ─── Lecture des réglages ────────────────────────────────────────────────────
  /** Le document d'un niveau, complet. Lisible dans un `computed` : il suit les écritures. */
  function doc(level) {
    if (!serverMode.value) return level === 'personal' ? readLocal() : normalizeDoc({})
    return normalizeDoc(docs[level]?.data ?? {})
  }

  const status = (level) => (serverMode.value ? docs[level]?.status ?? 'idle' : 'ready')

  async function loadScopes(force = false) {
    if (!serverMode.value) return
    if (scopes.value && !force) return
    const id = characterId.value
    try {
      const data = await api.scopes(id)
      if (id === characterId.value) scopes.value = { personal: data.personal, city: data.city, province: data.province }
    } catch (error) {
      push.error(apiMessage(error, locale(), t('MonBureau.SettingsLoadError')))
    }
  }

  async function load(level, force = false) {
    if (!serverMode.value) return
    const previous = docs[level]
    if (previous && !force && (previous.status === 'ready' || previous.status === 'loading')) return previous.promise
    docs[level] = { data: previous?.data ?? null, version: previous?.version ?? 0, status: 'loading', saving: false, dirty: false, timer: null, promise: null }
    // ⚠️ Relire l'entrée DANS `docs` : c'est sa version réactive ; l'objet qu'on vient d'affecter est le brut, dont les changements ne se voient pas.
    const entry = docs[level]
    const id = characterId.value
    entry.promise = (async () => {
      try {
        const settings = await api.getSettings(id, level)
        if (docs[level] !== entry || id !== characterId.value) return
        entry.data = settings.data
        entry.version = settings.version
        entry.status = 'ready'
        if (level === 'personal') await importLocalIfNeeded()
      } catch (error) {
        if (docs[level] !== entry) return
        entry.status = 'error'
        push.error(apiMessage(error, locale(), t('MonBureau.SettingsLoadError')))
      }
    })()
    return entry.promise
  }

  /** Première connexion : si le personnage n'a encore rien en base et que le navigateur garde des réglages, ils sont repris, puis effacés d'ici. */
  async function importLocalIfNeeded() {
    const entry = docs.personal
    if (!entry || !isEmptyData(entry.data)) return
    const local = readLocal()
    if (!hasContent(local)) return
    try {
      const settings = await api.saveSettings(characterId.value, 'personal', toPayload('personal', local), entry.version)
      entry.data = settings.data
      entry.version = settings.version
      clearLocalSettings() // seulement APRÈS la sauvegarde réussie
      imported.value = true
      push.success(t('MonBureau.ImportedFromBrowser'))
    } catch {
      // Refus ou conflit : on garde les réglages du navigateur intacts, la reprise sera retentée au prochain chargement.
    }
  }

  // ─── Écriture des réglages ───────────────────────────────────────────────────
  /** Modifie une partie du document d'un niveau. Sans compte : le navigateur, tout de suite. Avec un compte : le serveur, avec un court délai. */
  async function update(level, patch) {
    const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => keysFor(level).includes(key)))
    if (!serverMode.value) {
      if (level === 'personal') writeLocal({ ...readLocal(), ...allowed })
      return
    }
    if (!canWrite(level) && level !== 'personal') return
    await load(level)
    const entry = docs[level]
    if (!entry || entry.status !== 'ready') return
    entry.data = { ...normalizeDoc(entry.data ?? {}), ...allowed }
    clearTimeout(entry.timer)
    entry.timer = setTimeout(() => save(level), SAVE_DELAY)
  }

  async function save(level) {
    const entry = docs[level]
    if (!entry) return
    clearTimeout(entry.timer)
    entry.timer = null
    if (entry.saving) {
      entry.dirty = true
      return
    }
    entry.saving = true
    let conflicted = false
    try {
      const settings = await api.saveSettings(characterId.value, level, toPayload(level, normalizeDoc(entry.data)), entry.version)
      entry.version = settings.version
      if (!entry.dirty) entry.data = settings.data
    } catch (error) {
      const current = error?.response?.data?.current
      if (error?.response?.status === 409 && current) {
        // Un autre appareil a écrit entre-temps : son état remplace le nôtre.
        conflicted = true
        entry.data = current.data
        entry.version = current.version
      }
      push.error(apiMessage(error, locale(), t('EconomyInventory.SaveError')))
    } finally {
      entry.saving = false
      if (entry.dirty && !conflicted) {
        entry.dirty = false
        await save(level)
      } else {
        entry.dirty = false
      }
    }
  }

  /** Enregistre sans attendre ce qui est en attente (avant de quitter la page). */
  async function flush() {
    const pending = []
    for (const [level, entry] of Object.entries(docs)) {
      if (entry.timer) pending.push(save(level))
    }
    for (const entry of Object.values(texts)) {
      if (entry.timer) {
        clearTimeout(entry.timer)
        entry.timer = null
      }
    }
    await Promise.all(pending)
  }

  // ─── Texte collé ─────────────────────────────────────────────────────────────
  /** Le texte d'un niveau : le navigateur sans compte ; avec un compte, le dernier inventaire enregistré (personnel, ville) ou le plus récent de l'historique (province). */
  async function loadPaste(level) {
    if (!serverMode.value) return cookies.getComfortData(LOCAL.paste, '')
    const id = characterId.value
    if (level === 'province') {
      await loadHistory()
      return history.value?.snapshots?.[0]?.raw ?? ''
    }
    try {
      const inventory = await api.getText(id, level)
      let raw = inventory.raw ?? ''
      // Première connexion : le collage gardé dans le navigateur est repris en base (personnel seulement), puis effacé d'ici.
      const local = cookies.getComfortData(LOCAL.paste, '')
      if (level === 'personal' && !raw && local.trim()) {
        await api.putText(id, 'personal', local)
        cookies.removeComfortData(LOCAL.paste)
        raw = local
      }
      return raw
    } catch (error) {
      push.error(apiMessage(error, locale(), t('MonBureau.SettingsLoadError')))
      return ''
    }
  }

  /** Le collage gardé dans le navigateur, lu tout de suite (rendu initial sans compte). */
  const localPaste = () => cookies.getComfortData(LOCAL.paste, '')

  /** Mémorise le texte collé. Sans compte : le navigateur. Avec un compte : le serveur (personnel, ville), avec un délai ; jamais la province (son historique s'inscrit à la main), jamais un texte vide. */
  function savePaste(level, raw) {
    if (!serverMode.value) {
      cookies.setComfortData(LOCAL.paste, raw)
      return
    }
    if (level === 'province' || !raw.trim() || !canWrite(level)) return
    if (!texts[level]) texts[level] = { timer: null }
    const entry = texts[level]
    clearTimeout(entry.timer)
    const id = characterId.value
    entry.timer = setTimeout(async () => {
      entry.timer = null
      try {
        await api.putText(id, level, raw)
      } catch (error) {
        push.error(apiMessage(error, locale(), t('EconomyInventory.SaveError')))
      }
    }, SAVE_DELAY)
  }

  // ─── Province : l'historique ─────────────────────────────────────────────────
  async function loadHistory(force = false) {
    if (!serverMode.value) return
    if (history.value && !force) return
    const id = characterId.value
    try {
      const data = await api.provinceHistory(id)
      if (id === characterId.value) history.value = data
    } catch (error) {
      push.error(apiMessage(error, locale(), t('MonBureau.SettingsLoadError')))
    }
  }

  /** Inscrit l'inventaire du jour dans l'historique de la province. Renvoie la réponse du serveur (`replaced`, `unchanged`). */
  async function recordProvince(raw) {
    const result = await api.recordProvince(characterId.value, raw)
    await loadHistory(true)
    return result
  }

  // ─── Copie entre personnages ─────────────────────────────────────────────────
  /** Copie les réglages personnels du personnage actif vers un autre personnage du compte. Lève l'erreur du serveur (409 : confirmation). */
  async function copyPersonalTo(targetId, confirmReplace = false) {
    return api.copyPersonal(targetId, characterId.value, confirmReplace)
  }

  // ─── Changement de personnage ou de connexion : on repart de zéro ────────────
  function reset() {
    for (const entry of Object.values(docs)) clearTimeout(entry.timer)
    for (const entry of Object.values(texts)) clearTimeout(entry.timer)
    for (const key of Object.keys(docs)) delete docs[key]
    for (const key of Object.keys(texts)) delete texts[key]
    scopes.value = null
    history.value = null
    imported.value = false
  }
  watch([characterId, serverMode], reset)

  return {
    scopes, history, imported, serverMode, characterId, availableLevels,
    canWrite, doc, status, loadScopes, load, update, flush, localPaste, loadPaste, savePaste, loadHistory, recordProvince, copyPersonalTo, reset,
  }
})
