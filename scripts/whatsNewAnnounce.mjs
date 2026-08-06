/* eslint-env node */
import { readFileSync } from 'node:fs'

// Parse le contenu JSON d'un whatsNew.json — tolérant : fichier absent,
// vide ou invalide (ex. premier run, ou --old inexistant) donne juste [].
export function parseEntries(jsonString) {
  if (!jsonString || !jsonString.trim()) return []
  try {
    const parsed = JSON.parse(jsonString)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn(`[whatsNewAnnounce] JSON invalide, ignoré : ${err.message}`)
    return []
  }
}

// Entrées présentes dans `currentEntries` qui n'existaient pas dans
// `previousEntries`. Match principal par id. Pont legacy : une ancienne
// entrée SANS id est considérée "déjà annoncée" si une entrée courante a le
// même date+fr, même si celle-ci a désormais un id que l'ancienne n'avait
// pas — nécessaire pour le commit qui ajoute id/type aux entrées
// existantes, qui ne doit rien ré-annoncer.
export function diffNewEntries(previousEntries, currentEntries) {
  const previousIds = new Set(previousEntries.filter((e) => e.id).map((e) => e.id))
  const legacyKeys = new Set(
    previousEntries.filter((e) => !e.id).map((e) => `${e.date}::${e.fr}`)
  )

  return currentEntries.filter((entry) => {
    if (entry.id && previousIds.has(entry.id)) return false
    if (legacyKeys.has(`${entry.date}::${entry.fr}`)) return false
    return true
  })
}

export function splitByType(entries) {
  return {
    feature: entries.filter((e) => e.type === 'feature'),
    fix: entries.filter((e) => e.type === 'fix'),
  }
}

const EMOJI_BY_TYPE = { feature: '📯', fix: '🔨' }
const SCOPE_LABEL = { public: '🌐 Public', private: '🔒 Membres' }

// Texte d'une entrée, réutilisé par buildPayload (salon Texte, message
// groupé) et buildForumPayloads (salon Forum, un message par post). `locales`
// prépare le multi-langue futur (aujourd'hui ['fr'] uniquement) : un bloc de
// texte par langue, pas une string figée.
function formatEntryLine(entry, locales) {
  const emoji = EMOJI_BY_TYPE[entry.type] ?? EMOJI_BY_TYPE.feature
  const scopeLabel = SCOPE_LABEL[entry.scope] ?? ''
  const textBlocks = locales.map((locale) => entry[locale]).filter(Boolean)
  return `${emoji} **${entry.date}** — ${scopeLabel}\n${textBlocks.join('\n')}`
}

// Titre de thread Discord (salon Forum) — 100 caractères max côté API.
function threadNameFor(entry) {
  const raw = `${entry.date} — ${entry.fr ?? entry.en ?? entry.id}`
  return raw.length > 100 ? `${raw.slice(0, 97)}...` : raw
}

// Salon Texte (ex. "chronique-de-loffice") : un seul message groupé, public
// et privé postés ensemble mais l'indication de scope reste dans le texte
// (comme le badge "Membres" du site).
export function buildPayload(entries, { locales = ['fr'] } = {}) {
  if (entries.length === 0) return null

  const lines = entries.map((entry) => formatEntryLine(entry, locales))
  return { content: lines.join('\n\n') }
}

// Salon Forum (ex. "registre-des-reparations") : un post/thread par entrée —
// l'API Discord exige `thread_name` sur un salon Forum, impossible de poster
// un message "plat" comme sur un salon Texte classique. Un appel webhook par
// entrée, chacun ouvrant son propre thread.
export function buildForumPayloads(entries, { locales = ['fr'] } = {}) {
  return entries.map((entry) => ({
    thread_name: threadNameFor(entry),
    content: formatEntryLine(entry, locales),
  }))
}

function safeRead(path) {
  if (!path) return ''
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function parseArgs(argv) {
  const args = { oldPath: null, newPath: null, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--old') args.oldPath = argv[++i]
    else if (argv[i] === '--new') args.newPath = argv[++i]
    else if (argv[i] === '--dry-run') args.dryRun = true
  }
  return args
}

async function postJson(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Discord a répondu ${response.status}: ${await response.text()}`)
  }
}

// Salon Texte : un seul message groupé.
async function postToDiscord(webhookUrl, payload, label) {
  if (!payload) {
    console.log(`[whatsNewAnnounce] Rien de nouveau à annoncer (${label}).`)
    return
  }
  if (!webhookUrl) {
    console.log(`[whatsNewAnnounce] Webhook "${label}" non configuré ou --dry-run — payload :`)
    console.log(JSON.stringify(payload, null, 2))
    return
  }
  try {
    await postJson(webhookUrl, payload)
    console.log(`[whatsNewAnnounce] Annonce envoyée sur le salon "${label}".`)
  } catch (err) {
    console.warn(`[whatsNewAnnounce] Échec de l'envoi Discord (${label}): ${err.message}`)
  }
}

// Salon Forum : un post par entrée. Une erreur sur une entrée n'empêche pas
// les suivantes d'être postées.
async function postForumEntries(webhookUrl, payloads, label) {
  if (!payloads || payloads.length === 0) {
    console.log(`[whatsNewAnnounce] Rien de nouveau à annoncer (${label}).`)
    return
  }
  if (!webhookUrl) {
    console.log(`[whatsNewAnnounce] Webhook "${label}" (forum) non configuré ou --dry-run — payloads :`)
    console.log(JSON.stringify(payloads, null, 2))
    return
  }
  for (const payload of payloads) {
    try {
      await postJson(webhookUrl, payload)
      console.log(`[whatsNewAnnounce] Post créé sur "${label}" : ${payload.thread_name}`)
    } catch (err) {
      console.warn(`[whatsNewAnnounce] Échec de l'envoi Discord (${label}) pour "${payload.thread_name}": ${err.message}`)
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.newPath) {
    console.error('[whatsNewAnnounce] --new <path> est obligatoire.')
    return
  }

  const previousEntries = parseEntries(safeRead(args.oldPath))
  const currentEntries = parseEntries(safeRead(args.newPath))
  const newEntries = diffNewEntries(previousEntries, currentEntries)
  const { feature, fix } = splitByType(newEntries)

  const newsPayload = buildPayload(feature)
  const fixesPayloads = buildForumPayloads(fix)

  const newsWebhook = args.dryRun ? null : process.env.DISCORD_NEWS_WEBHOOK_URL
  const fixesWebhook = args.dryRun ? null : process.env.DISCORD_FIXES_WEBHOOK_URL

  await postToDiscord(newsWebhook, newsPayload, 'nouveautés')
  await postForumEntries(fixesWebhook, fixesPayloads, 'corrections')
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  // Ne doit jamais faire échouer le job de déploiement : erreur -> log, pas de process.exit(1).
  main().catch((err) => console.error('[whatsNewAnnounce] échec non bloquant:', err))
}
