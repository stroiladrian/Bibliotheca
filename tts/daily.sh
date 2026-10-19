#!/bin/bash
# Daily narration run, started automatically by macOS (see tts/install-daily.sh).
# Narrates the next books in the queue until Gemini's free daily limit, then rebuilds the catalog.
# You can also run it by hand:  bash tts/daily.sh

set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" || exit 1
mkdir -p tts/logs
LOG="tts/logs/$(date +%Y-%m-%d).log"
NODE="${BIBLIOTHECA_NODE:-$(command -v node || echo /usr/local/bin/node)}"
PY="$DIR/tts/.venv/bin/python"

{
  echo "=== $(date '+%Y-%m-%d %H:%M') daily narration ==="
  count() { grep -l '"engine": "gemini"' data/ro/*.json 2>/dev/null | wc -l | tr -d ' '; }
  before=$(count)
  if [ ! -x "$PY" ]; then
    echo "Missing tts/.venv. Run the one-time setup from the README."
    exit 1
  fi
  # new original poems first (they use another Gemini model, so they don't eat into the classics' daily limit)
  "$PY" tts/originals.py --all
  "$PY" tts/narrate.py --queue
  status=$?
  "$NODE" scripts/build-catalog.mjs
  after=$(count)
  new=$((after - before))
  echo "=== done (narrate exit $status), $new new book(s) ==="

  # a small macOS notification so you know it ran
  if command -v osascript >/dev/null; then
    if [ "$status" -ne 0 ]; then
      msg="Narrarea s-a oprit cu o eroare. Vezi tts/logs/$(date +%Y-%m-%d).log"
    elif [ "$new" -gt 0 ]; then
      msg="$new carte(cărți) nouă gata de ascultat."
    else
      msg="Am narat încă o parte. Continuă mâine."
    fi
    osascript -e "display notification \"$msg\" with title \"Bibliotheca\"" >/dev/null 2>&1 || true
  fi
} >>"$LOG" 2>&1

# keep only the last 30 logs
ls -1t tts/logs/*.log 2>/dev/null | tail -n +31 | while read -r old; do rm -f "$old"; done
