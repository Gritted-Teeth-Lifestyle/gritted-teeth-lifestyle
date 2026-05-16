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
    if w.top < mid_y and w.left < mid_x:
        target = w; break

if target is None:
    print('no TL pane'); sys.exit(1)
print(f'GTL 3 (TL): {target.title}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "git pull origin dev. Re-read dispatches/attune_cycles_appear_same_bug.md — it was AUGMENTED with a much more specific symptom: every cycle reads as 'one week of glutes' regardless of what the user actually carved. That points to either (a) loadActiveCycle() short-circuiting to a hardcoded fallback, (b) a default seed cycle being used instead of the saved one, or (c) the schedule-page CARVE write-side writing only 'glutes' regardless of muscle pick. To disambiguate read vs write: open DevTools, run `JSON.parse(localStorage.getItem('gtl-KING-cycles'))`, inspect a cycle's dailyPlan. If dailyPlan stores actual muscle names like ['chest'] / ['back'] but the UI still shows glutes everywhere → read-path bug in /attune or /fitness/load. If dailyPlan literally says ['glutes'] for every day even when user picked chest/back → write-path bug in app/fitness/new/branded/page.js's CARVE commit logic. Fix the layer that's wrong. Don't touch the Attune redesign files (CycleCalendar, DayCell, SetChip, AutoAttuneButton). One commit. Push origin/dev. Report SHA + 1-line root cause + screenshot showing 3 visibly distinct cycles."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
