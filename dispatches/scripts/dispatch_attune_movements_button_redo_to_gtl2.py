import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 2 = TR.
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
    if w.top <= mid_y and w.left > mid_x:   # TR
        target = w; break

if target is None:
    print('no TR'); sys.exit(1)
print(f'GTL 2 (TR): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/attune_movements_button_redo.md (in your repo root) and execute. Visual redo of the Attune Movements button on app/fitness/new/branded/page.js. Diagnosis: first pass put the button as a thin strip BELOW the calendar instead of overlaying it on the calendar's top-row empty cells where the bold 五月 kanji used to render. Fix: (1) delete the standalone horizontal-strip Attune button block below the calendar, (2) revert the muscle grid from 3-col x 4-row back to 2-col x 6-row (matches production layout, restores CARVE to its proper cell-12 prominence), (3) place AttuneMovementsButton OVER the calendar's row-1 empty cells (where targetSlots already render the watermarked kanji) so the button visually occupies the calendar header band with the kanji as background, (4) make button always-visible (not sheetOpen-gated) with enabled=true once any day is selected. Don't touch CARVE, kanji opacity (0.12 is correct), calendar day rendering, or anything in app/attune/. Compare visually to https://gritthoseteeth.com/fitness/new/branded after. Commit and push to origin/dev. Report: commit hash + 2 screenshots (no day selected / one day selected)."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
