#!/bin/bash
# Installs (or removes) the daily narration on this Mac.
#
#   bash tts/install-daily.sh            # run every day at 10:20
#   bash tts/install-daily.sh 11 30      # pick another time (hour minute)
#   bash tts/install-daily.sh --remove   # stop the daily runs
#   bash tts/install-daily.sh --now      # start today's run right away
#
# If the Mac is asleep at that time, macOS runs it as soon as the Mac wakes up.

set -e
LABEL="ro.bibliotheca.narrate"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
UID_NUM="$(id -u)"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Daily narration removed."
  exit 0
fi

if [ "${1:-}" = "--now" ]; then
  launchctl kickstart "gui/$UID_NUM/$LABEL" && echo "Started. Follow it with: tail -f \"$DIR/tts/logs/$(date +%Y-%m-%d).log\""
  exit 0
fi

HOUR="${1:-10}"
MINUTE="${2:-20}"
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Can't find node. Open a Terminal where 'npm run dev' works and run this script from there."
  exit 1
fi
if [ ! -x "$DIR/tts/.venv/bin/python" ]; then
  echo "Missing tts/.venv. Do the one-time setup from the README first."
  exit 1
fi
if ! grep -q "GEMINI_API_KEY=" "$DIR/.env.local" 2>/dev/null; then
  echo "Missing GEMINI_API_KEY in .env.local."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$DIR/tts/logs"
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DIR/tts/daily.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BIBLIOTHECA_NODE</key><string>$NODE</string>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$HOUR</integer>
    <key>Minute</key><integer>$MINUTE</integer>
  </dict>
  <key>StandardOutPath</key><string>$DIR/tts/logs/launchd.log</string>
  <key>StandardErrorPath</key><string>$DIR/tts/logs/launchd.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST"
printf 'Daily narration installed: every day at %02d:%02d.\n' "$HOUR" "$MINUTE"
echo "Logs: $DIR/tts/logs/   ·   Remove: bash tts/install-daily.sh --remove"
