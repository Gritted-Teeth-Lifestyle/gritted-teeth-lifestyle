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
    print('no TL pane'); sys.exit(1)
print(f'GTL 3 (TL): {target.title}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "git pull origin dev. Read dispatches/attune_polish_chip_layout.md and execute. Two changes: (1) SetChip.jsx — restructure chip from row-layout (label-then-icons-side-by-side) to column-layout (label on top with full width, then thin divider, then right-aligned ⎘⇄✕ icons row beneath). Bump icon font 0.6→0.75rem with minWidth:22 for tap targets. Removes mid-word breaks like KNEELIN/G PULLDOW/N because label now gets the full chip width. (2) CycleCalendar.jsx — TransformWrapper config: initialScale:0.6 (was 1) so ~5 cols visible at default; initialPositionX/Y:0; centerOnInit:false. Page lands on SUN/MON left edge with most columns visible. Don't touch DayCell, AutoAttuneButton, page.js. One commit. Push origin/dev. 2 screenshots: cold load (SUN/MON visible left), after auto-attune (chips show full text, no mid-word splits). Report SHA + screenshots + 'chip icons below label, default view at SUN/MON, no mid-word splits.'"

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
