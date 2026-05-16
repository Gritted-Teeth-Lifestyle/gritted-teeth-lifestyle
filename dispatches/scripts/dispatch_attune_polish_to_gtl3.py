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
    if w.top < mid_y and w.left < mid_x:   # TL = GTL 3
        target = w; break

if target is None:
    print('no TL pane found'); sys.exit(1)
print(f'GTL 3 (TL): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "git pull origin dev. Read dispatches/attune_polish_freeform_wrap.md and execute. Four polish fixes to the just-landed Attune redesign: (1) move the DOW header from outside TransformWrapper to INSIDE — each column gets its own SUN/MON/TUE label at the top of the column, scaling/panning with everything else, (2) reconfigure TransformWrapper for free-form pan: limitToBounds=false, lockAxisX/Y=false, minScale=0.4, centerOnInit, (3) grid uses fixed-pixel column widths (110px each = 806px total) so it's wider than viewport and horizontal pan has somewhere to go, (4) SetChip label uses whiteSpace:normal + wordBreak:break-word + lineHeight:1.2 so long exercise names wrap to multiple lines instead of ellipsis-truncating; chip alignItems:flex-start so icons stay top-aligned when label wraps; chip fontSize bumped 0.5→0.6rem since columns are wider now. Don't touch DayCell, AutoAttuneButton, page.js, or lib/. Only CycleCalendar.jsx (4 targeted patches) and SetChip.jsx (2 patches). Verify at 390x844 with multi-week cycle (Mon/Wed/Fri carved 2 weeks): take 2 screenshots — cold load with long exercise names visible (verify wrap), and after pinch-zooming out (verify DOW labels scale with content). One commit. Push origin/dev. Report SHA + 2 screenshots + 'DOW labels in-surface, free-form pan, chip text wraps.'"

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
