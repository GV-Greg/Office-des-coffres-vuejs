import { push } from 'notivue' // Importer push depuis Notivue

export default function validation(test, title) {
  if (test === true) {
    push.error(title) // Utiliser Notivue pour afficher une notification d'erreur
    return true
  }
  return false
}