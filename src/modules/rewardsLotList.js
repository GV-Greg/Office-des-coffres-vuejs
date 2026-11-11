/*
  Lire la liste de lots collée dans « Ajouter une liste » de la Grille des lots. Logique pure, testée seule.

  Les lots sont séparés par un retour à la ligne, une virgule ou une tabulation. Deux soins pour les listes copiées de l'inventaire du jeu, où la
  quantité précède le nom (« 4Andouillettes gratinées au chèvre ») :
    - un nombre COLLÉ au nom reçoit une espace : « 4 Andouillettes gratinées au chèvre » (lecture seule, le sens ne change pas) ;
    - un nombre SEUL suivi d'une tabulation est recollé au nom qui le suit (« 4⇥Andouillettes » → « 4 Andouillettes ») et ne compte pas pour un lot de plus.
  ⚠️ Un nombre au début d'un nom N'EST JAMAIS une quantité (décision de Greg, 10/11/2026) : « 4 andouillettes » est UN lot de quatre andouillettes, pas quatre
  lots. La quantité n'existe que dans l'ajout d'un lot unique. Aucune règle de fond ici : le serveur juge les noms.
*/
const tidy = name => name.trim().replace(/^(\d+)(?=\p{L})/u, '$1 ')

export function parseLotList(text) {
  const names = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    for (const piece of line.split(',')) {
      const parts = piece.split('\t').map(p => p.trim()).filter(Boolean)
      for (let i = 0; i < parts.length; i++) {
        // Un nombre seul, suivi d'une tabulation et d'un nom : c'est le début du nom, pas un lot.
        if (/^\d+$/.test(parts[i]) && i + 1 < parts.length) {
          names.push(tidy(`${parts[i]} ${parts[i + 1]}`))
          i++
        } else {
          names.push(tidy(parts[i]))
        }
      }
    }
  }
  return names.filter(Boolean)
}
