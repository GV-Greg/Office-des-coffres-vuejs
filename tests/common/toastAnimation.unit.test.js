// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Les toasts glissent depuis la DROITE (Greg, 21/11/2026), au lieu de tomber du haut comme dans l'animation d'origine de Notivue. Garde-fou :
  la configuration (main.js) nomme des classes qui existent (App.vue), le mouvement est horizontal, et le nom d'une animation de Notivue n'est
  jamais repris pour l'entrée ou la sortie.
*/
const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')
const main = readFileSync(resolve(src, 'main.js'), 'utf-8')
const app = readFileSync(resolve(src, 'App.vue'), 'utf-8')

describe('animation des toasts', () => {
  it('main.js nomme des classes d\'entrée et de sortie propres à l\'Office, et App.vue les définit', () => {
    expect(main).toMatch(/enter:\s*'odc-toast-enter'/)
    expect(main).toMatch(/leave:\s*'odc-toast-leave'/)
    expect(main).not.toMatch(/enter:\s*'Notivue__enter'/)
    for (const rule of ['.odc-toast-enter', '.odc-toast-leave', '@keyframes odc-toast-enter-kf', '@keyframes odc-toast-leave-kf']) expect(app).toContain(rule)
  })

  it('le mouvement est horizontal (translate3d(120%, 0, 0)), jamais vertical', () => {
    const css = app.slice(app.indexOf('.odc-toast-enter'), app.indexOf('/* Notivue : Rules for mobile devices */'))
    expect(css).toContain('translate3d(120%, 0, 0)')
    expect(css).not.toMatch(/translate3d\(0,\s*-?\d/)
  })

  it('la position reste en haut à droite, et la préférence de mouvement réduit s\'applique toujours', () => {
    expect(main).toMatch(/position:\s*'top-right'/)
    expect(readFileSync(resolve(src, 'assets/base.css'), 'utf-8')).toContain('prefers-reduced-motion: reduce')
  })
})
