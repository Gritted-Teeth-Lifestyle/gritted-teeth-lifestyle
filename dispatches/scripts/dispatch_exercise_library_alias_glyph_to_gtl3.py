import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 3 = TL per feedback_dispatch_multi_worker_layout.md.
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
    if w.top < mid_y and w.left < mid_x:   # TL = GTL 3
        target = w; break

if target is None:
    print('no TL pane found'); sys.exit(1)
print(f'GTL 3 (TL): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/exercise_library_alias_glyph_to_gtl3.md and execute. You are Worker B for the GTL Curated Exercise Library feature (plan: dispatches/2026-05-02-002-feat-gtl-exercise-library-plan.md). Two units: (1) lib/exerciseAliases.js — three exports EXERCISE_ALIASES + FOREARMS_OVERLAY + EQUIPMENT_OVERRIDE — push IMMEDIATELY since Worker A's import script reads this file. (2) PickerSheet.jsx equipment glyph: add EQUIPMENT_GLYPH map and small monospace pill on right side of every exercise row, fallback to '·' for backward compat. Do NOT touch lib/exerciseLibrary.js, scripts/import-wger.js, or other Attune components. Two commits, push to origin/dev. Report SHAs + screenshot if possible."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
