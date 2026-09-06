// Lien "retour" des pages légales : revient à la page précédente plutôt que de forcer un
// retour à Welcome (demande Greg, 06/09/2026) — sauf arrivée directe sur la page (lien partagé,
// nouvel onglet), où il n'y a pas de page précédente dans l'historique de l'app.
export function goBackOrWelcome(router) {
  if (window.history.state?.back != null) {
    router.back()
  } else {
    router.push({ name: 'welcome' })
  }
}
