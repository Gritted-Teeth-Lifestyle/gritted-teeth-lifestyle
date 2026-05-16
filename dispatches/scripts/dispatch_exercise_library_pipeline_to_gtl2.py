import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 2 = TR per feedback_dispatch_multi_worker_layout.md.
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
    if w.top < mid_y and w.left > mid_x:   # TR = GTL 2
        target = w; break

if target is None:
    print('no TR pane found'); sys.exit(1)
print(f'GTL 2 (TR): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/exercise_library_data_pipeline_to_gtl2.md and execute. You are Worker A for the GTL Curated Exercise Library feature (plan: dispatches/2026-05-02-002-feat-gtl-exercise-library-plan.md). Four tasks: (1) scripts/wgerMap.js with WGER_MUSCLE_MAP + WGER_EQUIPMENT_MAP + CANONICAL_EXERCISE — write now. (2) LICENSE-thirdparty.md + README mention — write now. Land both as your first commit immediately. (3) scripts/import-wger.js — WAIT for Worker B's lib/exerciseAliases.js to land on origin/dev (auto-pull every 30s) before writing this. (4) Run npm run import:exercises (after adding it to package.json scripts) to generate lib/exerciseLibrary.js, commit + push. Backward-compat: Exercise.id stays uppercase label string; muscle singular = muscles[0]; public API surface unchanged. Filter wger to strength-only. Don't touch PickerSheet or any Attune UI. Three commits total, push to origin/dev. Report all SHAs + exercise count + muscles covered + npm run import:exercises reproducibility."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
