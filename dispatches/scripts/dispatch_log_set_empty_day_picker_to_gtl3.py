import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 3 = TL.
cands = []
for w in gw.getAllWindows():
    try:
        t = w.title.lower()
        if 'chrome' in t or 'firefox' in t or 'edge' in t: continue
        if any(s in t for s in ['claude', 'gtl', 'gritted', 'flame', 'cycle', 'attune', 'movement', 'forge', 'session', 'refactor', 'fitness']):
            cands.append(w)
    except: pass

if len(cands) < 4:
    print(f'expected 4, found {len(cands)}'); sys.exit(1)

ys = sorted(c.top for c in cands)
xs = sorted(c.left for c in cands)
mid_y = (ys[len(ys)//2 - 1] + ys[len(ys)//2]) / 2
mid_x = (xs[len(xs)//2 - 1] + xs[len(xs)//2]) / 2

target = None
for w in cands:
    is_bottom = w.top > mid_y
    is_right  = w.left > mid_x
    if not is_bottom and not is_right:   # TL
        target = w; break

if target is None:
    print('no TL'); sys.exit(1)
print(f'GTL 3 (TL): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/log_set_empty_day_picker.md (in your repo root) and execute. You are Worker C — wiring R17/R18 on the existing log-set / active-day screen. WAIT for Worker A's first commit on origin/dev (your auto-pull loop runs every 30s) before writing code — you depend on src/state/attunement.ts and src/components/attune/PickerSheet.tsx that Worker A is landing first. Then: when active day has zero attuned chips AND has muscles assigned, surface PickerSheet in mode='in-the-moment' muscle-locked to today's muscle(s). Picking adds one chip via attunementStore.addChip then closes. Don't open if the day has no muscles. Don't reopen on same-visit dismiss. Don't modify attunement.ts or PickerSheet — read-only consumer. Don't touch existing log-set behavior for days that already have chips. Mobile viewport (~390x844). Commit and push to origin/dev. Report: commit hash, 3 screenshots (empty-day picker summon / post-confirm with chip / no-muscles existing empty state)."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
