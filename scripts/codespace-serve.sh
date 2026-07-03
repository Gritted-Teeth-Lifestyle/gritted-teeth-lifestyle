#!/usr/bin/env bash
# Codespace auto-serve: keeps the dev-branch phone-testing environment alive.
# Launched detached by devcontainer.json postStartCommand on every codespace
# boot. Two jobs:
#   1. Autopull loop — codespace tracks origin/dev so pushes from workers
#      show up on the phone within ~30s (hot reload picks up the changes).
#   2. Next dev server on :3000 (the forwarded port).
# Logs: /tmp/gtl-pull.log and /tmp/gtl-dev.log

cd "$(dirname "$0")/.." || exit 1

# Don't stack duplicates if postStart fires on a container that already runs us.
if pgrep -f "next dev -p 3000" > /dev/null 2>&1; then
  echo "dev server already running — skipping" >> /tmp/gtl-start.log
  exit 0
fi

(
  while true; do
    git pull --ff-only >> /tmp/gtl-pull.log 2>&1
    sleep 30
  done
) &

exec npx next dev -p 3000 >> /tmp/gtl-dev.log 2>&1
