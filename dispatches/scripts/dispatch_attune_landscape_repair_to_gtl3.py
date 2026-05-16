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

prompt = "git pull origin dev. Read dispatches/attune_landscape_repair.md and execute. THREE fixes: (1) PickerSheet.jsx — add drag-resize via top-edge handle (16px hit area, grey pill affordance), pointer-capture handlers compute new height from dy, clamp 180..92vh, override class max-height with inline style when userHeight set, reset on sourceDayId change. (2) CycleCalendar.jsx contentStyle padding-bottom 7rem→9rem AND AutoAttuneButton.jsx bottom 1rem→1.5rem so the floating AUTO-ATTUNE button doesn't overlap chips in landscape (currently does at 390px viewport). (3) app/fitness/new/branded/page.js ATTUNE MOVEMENTS button — restyle so the button itself is a red-bordered solid-void tile (#0a0a0c bg + #d4181f border, clip-path skewed, white Anton 0.7rem text, 3x3 shadow) instead of bare text overlaid on the red kanji watermark. Currently in landscape it's unreadable red-on-red. Preserve existing positioning. Don't touch other files. ASK BEFORE COMMITTING if unclear. Single commit. Verify with playwright at both portrait 390x844 and landscape 844x390. 4 screenshots: portrait /attune with picker dragged halfway, landscape /attune populated (no chip overlap), portrait + landscape schedule page with the new tile button clearly visible. Push origin/dev. Report SHA + 4 screenshots + 3 confirmations."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
