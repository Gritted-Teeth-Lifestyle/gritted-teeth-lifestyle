#!/usr/bin/env bash
# Codespace auto-serve: keeps the dev-branch phone-testing environment alive.
# Called synchronously by devcontainer.json postStartCommand on every boot.
#
# The devcontainer lifecycle runner kills the postStart process GROUP when
# the command exits, so a plain `nohup ... &` dies instantly. setsid puts
# the daemon in a fresh session the reaper can't reach.
#
# Daemon does two jobs:
#   1. Autopull loop — origin/dev every 30s, so worker pushes show up on
#      the phone via hot reload.
#   2. Next dev server on :3000 (the forwarded port).
# Logs: /tmp/gtl-pull.log, /tmp/gtl-dev.log. Pidfile: /tmp/gtl-serve.pid

cd "$(dirname "$0")/.." || exit 1

if [ "$1" = "--daemon" ]; then
  (
    while true; do
      git pull --ff-only >> /tmp/gtl-pull.log 2>&1
      sleep 30
    done
  ) &
  exec npx next dev -p 3000 >> /tmp/gtl-dev.log 2>&1
fi

if [ -f /tmp/gtl-serve.pid ] && kill -0 "$(cat /tmp/gtl-serve.pid)" 2>/dev/null; then
  echo "gtl serve already running (pid $(cat /tmp/gtl-serve.pid))"
  exit 0
fi

setsid bash "$0" --daemon < /dev/null > /tmp/gtl-start-daemon.log 2>&1 &
echo $! > /tmp/gtl-serve.pid
echo "gtl serve launched (pid $(cat /tmp/gtl-serve.pid))"
