#!/usr/bin/env bash
# wake-codespace.sh — one-shot, deterministic wakeup for the GTL phone
# server. Encodes every failure mode learned 2026-07-23 so waking the
# codespace is ONE command instead of an exploration:
#
#   1. ssh (implicitly boots the codespace) + ensure the serve daemon
#      is running and the dev server answers on :3000 inside.
#   2. Port visibility resets to private on EVERY stop/start → set
#      public.
#   3. Verify the PUBLIC url serves real app CONTENT (grep GRITTED —
#      status codes lie: GitHub's sign-in page is a 200 too).
#   4. If the edge 404s: that's the lost-forward failure. The CLI
#      cannot fix it — only a real browser session can. Print the one
#      human step and exit 2.
#
# Run from any machine with gh + curl (Git Bash on Windows works):
#   bash scripts/wake-codespace.sh
#
# Exit codes: 0 = LIVE, 1 = server/boot failure, 2 = needs browser tap.

set -u
CS="gtl-dev-phone-pjvx5q5grwwhj66"
URL="https://${CS}-3000.app.github.dev"

# PROVEN 2026-07-23 (Jordan's phone, empirically): the public edge only
# re-registers the port when GitHub's CONTROL PLANE boots the machine —
# an ssh-initiated boot leaves the edge 404 forever. So: if it's down,
# start it via the API and wait for Available BEFORE ssh-ing in. The
# edge registration then lands within a few minutes (poll patiently —
# 80s is not enough; that false negative burned a whole evening).
echo "[0/3] control-plane boot..."
state=$(gh api "user/codespaces/${CS}" --jq '.state' 2>/dev/null)
if [ "$state" != "Available" ]; then
  gh api -X POST "user/codespaces/${CS}/start" >/dev/null 2>&1
  for i in $(seq 1 40); do
    state=$(gh api "user/codespaces/${CS}" --jq '.state' 2>/dev/null)
    [ "$state" = "Available" ] && break
    sleep 10
  done
fi
[ "$state" = "Available" ] || { echo "FAIL: codespace did not reach Available"; exit 1; }

echo "[1/3] ensuring dev server..."
gh codespace ssh -c "$CS" -- "
  # Cold-boot race: ssh can land before the workspace is mounted — wait
  # for the repo dir or the serve launch silently no-ops (bit 2026-07-23).
  for i in \$(seq 1 24); do
    [ -d /workspaces/gritted-teeth-lifestyle ] && break
    sleep 5
  done
  pgrep -f 'codespace-ser[v]e' >/dev/null || {
    rm -f /tmp/gtl-serve.pid
    cd /workspaces/gritted-teeth-lifestyle && git pull --ff-only >/dev/null 2>&1
    bash scripts/codespace-serve.sh
  }
  for i in \$(seq 1 40); do
    c=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 --max-time 8)
    [ \"\$c\" = 200 ] && break
    sleep 5
  done
  echo inside=\$c
" 2>&1 | tail -1 | grep -q 'inside=200' || { echo "FAIL: dev server did not come up inside the codespace"; exit 1; }

echo "[2/3] setting port 3000 public (resets on every restart)..."
gh codespace ports visibility 3000:public -c "$CS" >/dev/null 2>&1

echo "[3/3] verifying public URL serves the real app (edge can lag minutes)..."
for attempt in $(seq 1 20); do
  if curl -s --max-time 30 "$URL" | grep -q "GRITTED"; then
    echo "LIVE: $URL"
    exit 0
  fi
  sleep 15
done

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL")
if [ "$code" = "404" ]; then
  echo "EDGE STILL 404 AFTER 5 MIN OF A CONTROL-PLANE BOOT."
  echo "FALLBACK: stop the codespace (gh codespace stop -c $CS), rerun this"
  echo "script so the boot is control-plane again, and poll patiently."
  echo "Tunnel backup URL: grep trycloudflare /tmp/gtl-tunnel.log in the codespace."
  exit 2
fi
echo "UNEXPECTED: public URL returned $code with no app content. Investigate before improvising."
exit 1
