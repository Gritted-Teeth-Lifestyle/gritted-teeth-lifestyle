import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 1 = BR per feedback_dispatch_multi_worker_layout.md.
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
    print('no BR pane found'); sys.exit(1)
print(f'GTL 1 (BR): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/attune_calendar_height_fix.md and execute. The /attune calendar is collapsing to a 132px strip leaving most of the viewport as dead black void. Single-line fix to app/attune/page.js: the parent wrapper of CycleCalendar (around line 306) needs `display: 'flex', flexDirection: 'column'` added to its style — keep position: relative + flex:1 + minHeight:0 unchanged. Don't touch CycleCalendar.jsx, AutoAttuneButton, or anything else. After fix, screenshot /attune at 390x844 with a populated cycle (gtl-KING-active-cycle-id + gtl-KING-cycles in localStorage) — calendar should fill the available height. Also screenshot /fitness/new/branded as a regression check (button overlay still correct). Commit + push origin/dev. Report SHA + 2 screenshots."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
