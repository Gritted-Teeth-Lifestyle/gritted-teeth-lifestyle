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
  # Codespaces can fire postStart while postCreate's npm install is still
  # running (the container reports ready early). Wait for deps so the
  # server doesn't die at first boot and strand a stale pidfile.
  until [ -x node_modules/.bin/next ]; do
    echo "waiting for npm install..." >> /tmp/gtl-dev.log
    sleep 10
  done
  (
    while true; do
      git pull --ff-only >> /tmp/gtl-pull.log 2>&1
      sleep 30
    done
  ) &
  # Cloudflare quick tunnel — public phone URL independent of GitHub's
  # port-forwarding edge (which 404s for this codespace since the repo
  # moved orgs, 2026-07-23). URL is RANDOM per boot: grep
  # /tmp/gtl-tunnel.log for the current https://*.trycloudflare.com.
  if [ ! -x /tmp/cloudflared ]; then
    curl -sL -o /tmp/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
      && chmod +x /tmp/cloudflared
  fi
  if [ -x /tmp/cloudflared ]; then
    (/tmp/cloudflared tunnel --url http://localhost:3000 >> /tmp/gtl-tunnel.log 2>&1) &
  fi
  # -H 0.0.0.0: the codespace tunnel forwarder connects over a
  # non-loopback interface — a localhost-only bind serves 200 inside but
  # 404s at the app.github.dev edge (github community #46468).
  exec npx next dev -p 3000 -H 0.0.0.0 >> /tmp/gtl-dev.log 2>&1
fi

if [ -f /tmp/gtl-serve.pid ] && kill -0 "$(cat /tmp/gtl-serve.pid)" 2>/dev/null; then
  echo "gtl serve already running (pid $(cat /tmp/gtl-serve.pid))"
  exit 0
fi

setsid bash "$0" --daemon < /dev/null > /tmp/gtl-start-daemon.log 2>&1 &
echo $! > /tmp/gtl-serve.pid
echo "gtl serve launched (pid $(cat /tmp/gtl-serve.pid))"
