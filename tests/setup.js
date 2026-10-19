import { config } from '@vue/test-utils'
import { timing } from '../src/modules/chestTiming'

// Le coffre de chargement attend (délai anti-flash, ouverture) : en test, tout est synchrone. Les tests du coffre
// lui-même remettent `timing.instant = false` et pilotent des faux minuteurs.
timing.instant = true

// `main.js` enregistre `v-icon` globalement (app.component('v-icon', OhVueIcon)),
// mais les tests montent les composants sans passer par main.js : chaque icône
// rendue produisait un « [Vue warn]: Failed to resolve component: v-icon », par
// dizaines à chaque run. Aucun impact fonctionnel, mais assez de bruit pour noyer
// les vrais avertissements Vue.
//
// On stubbe plutôt que d'enregistrer le vrai composant : aucun test ne vérifie
// quelle icône est affichée, seulement le texte et le comportement.
config.global.stubs = {
  ...(config.global.stubs || {}),
  'v-icon': true,
}
