#!/usr/bin/env bash
# Passe rapide des tests sous WSL : synchronise le dossier de travail vers le système de fichiers LINUX de WSL (ext4), puis y lance Vitest.
#
# POURQUOI : sous WSL, un dépôt sur /mnt/d (le disque Windows) paie chaque ouverture de fichier à travers le pont 9P. Mesuré le 25/11/2026, même commit,
# même machine : la suite complète prend 186 s sur /mnt/d et 16 à 18 s sur ext4 (÷ 10), le lint 13 s contre 4 s. Votre IDE et le serveur de dev restent
# sur le dossier de travail : ce script ne fait que COPIER (rsync, 1 s) puis exécuter ailleurs.
#
# Usage :   bash scripts/test-fast.sh                       toute la suite
#           bash scripts/test-fast.sh tests/security        arguments passés à `vitest run`
#           bash scripts/test-fast.sh --lint                eslint (src, tests, scripts) puis la suite
#           bash scripts/test-fast.sh --lint-only           eslint seulement
#   ou      npm run test:fast
# Variable : ODC_FAST_DIR = dossier de la copie Linux (défaut : ~/odc-front-fast). Jamais sous /mnt (ce serait annuler le gain).
# Code de sortie : celui de la dernière commande qui a échoué (eslint, puis vitest), 0 si tout passe.
#
# Ce que le script ne fait PAS : il ne modifie jamais le dossier de travail, il ne remplace pas la CI (qui reste la référence), et il ne copie ni
# node_modules, ni .git, ni dist. node_modules vit dans la copie et n'est réinstallé (npm ci) que si package-lock.json a changé.

set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${ODC_FAST_DIR:-$HOME/odc-front-fast}"

die() { echo "✗ $*" >&2; exit 2; }
secs() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }
now() { date +%s.%N; }

LINT=0; ONLY_LINT=0; ARGS=()
for a in "$@"; do
  case "$a" in
    --lint) LINT=1 ;;
    --lint-only) LINT=1; ONLY_LINT=1 ;;
    *) ARGS+=("$a") ;;
  esac
done

# ── garde-fous ──
[ "$(uname -s)" = "Linux" ] || die "ce script est pour WSL / Linux (rsync + ext4). Ailleurs : npm test."
command -v rsync >/dev/null || die "rsync est absent (sudo apt install rsync)."
command -v node >/dev/null && command -v npm >/dev/null || die "node et npm sont requis dans WSL."
case "$DEST" in
  /mnt/*) [ "${ODC_FAST_ALLOW_MNT:-0}" = "1" ] || die "$DEST est sous /mnt : c'est le disque Windows, lent — le but est l'inverse. Choisir un dossier de ~ (ODC_FAST_DIR)." ;;
esac
case "$DEST/" in "$SRC"/*) die "la copie ($DEST) ne peut pas être dans le dossier de travail ($SRC)." ;; esac
case "$SRC/" in "$DEST"/*) die "le dossier de travail ($SRC) est dans la copie ($DEST) : refus de synchroniser par-dessus." ;; esac
case "$SRC" in
  /mnt/*) ;;
  *) echo "→ le dossier de travail n'est pas sous /mnt : il est déjà sur le système de fichiers Linux. Lancement direct."; cd "$SRC" || exit 2
     [ "$ONLY_LINT" = "1" ] || exec npx vitest run "${ARGS[@]}"; exec ./node_modules/.bin/eslint src tests scripts ;;
esac

T_ALL=$(now)

# ── 1. synchronisation (sans node_modules ni .git ni dist : ils restent là où ils sont) ──
mkdir -p "$DEST" || die "impossible de créer $DEST."
t0=$(now)
rsync -a --delete --exclude node_modules --exclude .git --exclude dist --exclude coverage "$SRC/" "$DEST/" || die "rsync a échoué."
echo "→ synchronisation : $(secs "$t0" "$(now)") s  ($SRC → $DEST)"

# ── 2. dépendances : seulement si le lockfile a changé (ou si la copie est neuve) ──
cd "$DEST" || exit 2
LOCK_HASH="$(sha256sum package-lock.json | cut -d' ' -f1)"
STAMP="node_modules/.odc-lock-hash"
if [ ! -d node_modules ] || [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$LOCK_HASH" ]; then
  echo "→ package-lock.json nouveau ou copie neuve : npm ci (une fois)…"
  t0=$(now)
  npm ci --no-audit --no-fund >/tmp/odc-fast-npm-ci.log 2>&1 || { tail -15 /tmp/odc-fast-npm-ci.log; die "npm ci a échoué (journal : /tmp/odc-fast-npm-ci.log)."; }
  echo "$LOCK_HASH" > "$STAMP"
  echo "→ npm ci : $(secs "$t0" "$(now)") s"
fi

# ── 3. lint puis tests, dans la copie ──
RC=0
if [ "$LINT" = "1" ]; then
  t0=$(now)
  ./node_modules/.bin/eslint src tests scripts; RC=$?
  echo "→ eslint : $(secs "$t0" "$(now)") s (code $RC)"
fi
if [ "$ONLY_LINT" != "1" ]; then
  t0=$(now)
  npx vitest run "${ARGS[@]}"; R=$?
  [ "$R" -ne 0 ] && RC=$R
  echo "→ vitest : $(secs "$t0" "$(now)") s (code $R)"
fi
echo "→ passe rapide terminée en $(secs "$T_ALL" "$(now)") s"
exit $RC
