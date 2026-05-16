import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

cands = []
for w in gw.getAllWindows():
    try:
        t = w.title.lower()
        if 'chrome' in t or 'firefox' in t or 'edge' in t: continue
        if any(s in t for s in ['claude', 'flame', 'flickering', 'session', 'refactor', 'ouroboros', 'cycle', 'drill', 'palette', 'scroll', 'rolodex', 'gtl', 'gritted', 'fitness', 'attune', 'exercise']):
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
    if w.top > mid_y and w.left > mid_x:   # BR = GTL 1
        target = w; break

if target is None:
    print('no BR pane'); sys.exit(1)
print(f'GTL 1 (BR): {target.title}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "git pull origin dev. Read dispatches/attune_cycles_appear_same_bug.md and execute. Bug: on the cycle-list page (likely /fitness/load — the REVIEW/EDIT cycle list), every cycle row/preview shows the same data even though the underlying localStorage cycles differ in days/dailyPlan/chips. Investigate likely causes: (1) per-row component reads a fixed cycleId hook (useChipsForDay etc.) instead of the row's cycle.id, (2) per-row reads from a globally-keyed localStorage entry (e.g. pk('daily-plan') without cycleId) instead of cycle.dailyPlan, (3) wrong React key. Repro by seeding 3 cycles with distinct days arrays into gtl-KING-cycles and visit the list page. Apply the smallest fix. Don't touch the Attune calendar redesign files (CycleCalendar.jsx, DayCell.jsx, SetChip.jsx, AutoAttuneButton.jsx, app/attune/page.js). Don't change storage keys. One commit, push origin/dev. Report SHA + 1-line root cause + 1 screenshot showing 3 visibly distinct cycle rows."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
