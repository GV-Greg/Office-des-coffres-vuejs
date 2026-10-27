import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import CityCascadeSelect from '../../src/components/forms/CityCascadeSelect.vue'

// La résidence du personnage préremplit la cascade, quel que soit le niveau où elle s'arrête : la ville, elle, reste à choisir.

vi.mock('../../src/api.js', () => ({
  http: { get: vi.fn().mockResolvedValue({ data: { kingdoms: [
    { id: 1, kingdom_name: 'Bretagne', provinces: [{ id: 10, province_name: 'Finistère', cities: [{ id: 100, city_name: 'Brest' }, { id: 101, city_name: 'Quimper' }] }] },
    { id: 2, kingdom_name: 'Provence', provinces: [{ id: 20, province_name: 'Var', cities: [{ id: 200, city_name: 'Toulon' }] }] },
  ] } }) },
}))
vi.mock('notivue', () => ({ push: { error: vi.fn() } }))

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/locales')
const fr = JSON.parse(fs.readFileSync(path.join(dir, 'fr.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'))

async function mountCascade(props) {
  const w = mount(CityCascadeSelect, { props, global: { plugins: [createI18n({ legacy: false, locale: 'fr', messages: { fr, en } })] } })
  await flushPromises()
  return w
}

describe('CityCascadeSelect — résidence proposée', () => {
  it('mode ville : royaume et province repris de la résidence, ville vide', async () => {
    const w = await mountCascade({ initialCityId: 100 })
    const selects = w.findAll('select')

    expect(selects[0].element.value).toBe('1')
    expect(selects[1].element.value).toBe('10')
    expect(selects[2].element.value).toBe('')
  })

  it('mode royaume : le royaume de la résidence est choisi et annoncé', async () => {
    const w = await mountCascade({ initialCityId: 200, stopAt: 'kingdom' })

    expect(w.find('select').element.value).toBe('2')
    expect(w.emitted('update:modelValue')[0][0]).toBe(2)
  })
})
