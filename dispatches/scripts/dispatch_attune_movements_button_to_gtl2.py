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

prompt = "Read dispatches/attune_movements_button.md (in your repo root) and execute. You are Worker B — adding the Attune Movements entry button on the existing schedule page. Demote the month kanji to a low-opacity background watermark (pointer-events: none, behind buttons), create AttuneMovementsButton mirroring the existing CARVE button visually, day-selection-gated activation matching CARVE exactly (no muscle prerequisite — user discovers empty state inside Attune). On tap, navigate to /attune (Worker A's route — pull origin/dev to confirm path). Don't touch the CARVE button itself or any state writers. Mobile viewport (~390x844). Commit and push to origin/dev. Report: commit hash, 3 screenshots (no days selected with watermark + both buttons inactive / one day selected with both active / navigation to Attune)."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
