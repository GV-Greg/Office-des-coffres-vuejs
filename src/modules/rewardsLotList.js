/*
  Lire la liste de lots collée dans « Ajouter une liste » de la Grille des lots. Logique pure, testée seule.

  Les lots sont séparés par un retour à la ligne, une virgule ou une tabulation. Deux soins pour les listes copiées de l'inventaire du jeu, où la
  quantité précède le nom (« 4Andouillettes gratinées au chèvre ») :
    - un nombre COLLÉ au nom reçoit une espace : « 4 Andouillettes gratinées au chèvre » (lecture seule, le sens ne change pas) ;
    - sur une ligne de ce format, le nombre COLLÉ à la FIN du nom (la valeur de l'inventaire : « 6Planches de bois d'ébène12 ») est retiré ;
      de même une colonne de valeur seule, en dernier, après une tabulation (« 4⇥Andouillettes⇥12 ») ;
    - un nombre SEUL suivi d'une tabulation est recollé au nom qui le suit (« 4⇥Andouillettes » → « 4 Andouillettes ») et ne compte pas pour un lot de plus.
  ⚠️ Un nombre au début d'un nom N'EST JAMAIS une quantité (décision de Greg, 10/11/2026) : « 4 andouillettes » est UN lot de quatre andouillettes, pas quatre
  lots. La quantité n'existe que dans l'ajout d'un lot unique. Aucune règle de fond ici : le serveur juge les noms.
*/
const tidy = (name) => {
  let n = name.trim()
  // Format de l'inventaire : quantité collée au nom (« 6Planches de bois d'ébène12 »), suivie d'une valeur collée à la fin. La valeur est retirée,
  // la quantité reçoit son espace. Une ligne sans nombre collé au début (liste écrite à la main : « R2D2 », « Potion 50 ») n'est JAMAIS touchée.
  if (/^\d+(?=\p{L})/u.test(n)) {
    n = n.replace(/(?<=[^\d\s])\d+$/u, '').replace(/^(\d+)(?=\p{L})/u, '$1 ')
  }
  return n.trim()
}

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
          // Une colonne de valeur (un nombre seul) en dernier de la ligne n'est pas un lot ; suivie d'un nom, c'est le début du lot suivant.
          if (i + 1 === parts.length - 1 && /^\d+$/.test(parts[i + 1])) i++
        } else {
          names.push(tidy(parts[i]))
        }
      }
    }
  }
  return names.filter(Boolean)
}
