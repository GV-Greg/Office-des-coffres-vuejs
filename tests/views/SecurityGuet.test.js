import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SecurityGuet from '../../src/views/modules/security/SecurityGuet.vue'

const i18n = createI18n({
  locale: 'fr',
  messages: {
    fr: {
      Security: {
        YesterdayLabel: "Liste des villageois d'hier :",
        TodayLabel: "Liste des villageois d'aujourd'hui :",
        GenerateButton: 'Générer les entrées/sorties',
        EntriesLabel: 'Entrées',
        ExitsLabel: 'Sorties',
        ExportButton: 'Exporter'
      }
    }
  }
})

const fixturePath = resolve(process.cwd(), 'tests/fixtures/Bug_ExportSorties.txt')
const fixture = readFileSync(fixturePath, 'utf8')

function extractBlock(text, startTag, endTag) {
  const start = text.indexOf(startTag) + startTag.length
  const end = text.indexOf(endTag)
  return text.slice(start, end).replace(/^\n/, '').replace(/\n$/, '')
}

const hier = extractBlock(fixture, '--- HIER_DEBUT ---', '--- HIER_FIN ---')
const aujourdhui = extractBlock(fixture, '--- AUJOURDHUI_DEBUT ---', '--- AUJOURDHUI_FIN ---')
const sortiesAttendues = extractBlock(fixture, '--- SORTIES_ATTENDUES ---', '--- SORTIES_FIN ---')
  .split('\n').map(s => s.trim()).filter(Boolean)
const entreesAttendues = extractBlock(fixture, '--- ENTREES_ATTENDUES ---', '--- ENTREES_FIN ---')
  .split('\n').map(s => s.trim()).filter(Boolean)

async function generateResult() {
  const wrapper = mount(SecurityGuet, { global: { plugins: [i18n] } })
  const textareas = wrapper.findAll('textarea')
  await textareas[0].setValue(hier)
  await textareas[1].setValue(aujourdhui)
  await wrapper.find('button').trigger('click')
  return wrapper
}

describe('SecurityGuet — transform() sur données réelles (préambule + tableau)', () => {
  it('détecte les bonnes entrées, sans pollution du préambule descriptif', async () => {
    const wrapper = await generateResult()
    const [entreesContainer] = wrapper.findAll('.flex-wrap')
    const entrees = entreesContainer.findAll('a').map(a => a.text())

    expect(entrees).toHaveLength(entreesAttendues.length)
    expect(entrees).toEqual(expect.arrayContaining(entreesAttendues))
  })

  it('détecte les bonnes sorties, sans doublon ni pseudo parasite du préambule', async () => {
    const wrapper = await generateResult()
    const [, sortiesContainer] = wrapper.findAll('.flex-wrap')
    const sorties = sortiesContainer.findAll('a').map(a => a.text())

    expect(sorties).toHaveLength(sortiesAttendues.length)
    expect(sorties).toEqual(expect.arrayContaining(sortiesAttendues))
  })

  it('ignore les lignes du préambule ("Le maire est...", "Liste des villageois (N)"...)', async () => {
    const wrapper = await generateResult()
    const allNames = wrapper.findAll('.flex-wrap a').map(a => a.text())

    expect(allNames).not.toContain('Le')
    expect(allNames).not.toContain('La')
    expect(allNames).not.toContain('Ils')
    expect(allNames).not.toContain("L'adjoint")
    expect(allNames).not.toContain('Liste')
  })
})
