import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 1 = BR.
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
    if w.top > mid_y and w.left > mid_x:
        target = w; break

if target is None:
    print('no BR pane'); sys.exit(1)
print(f'GTL 1 (BR): {target.title}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
# ESC first to interrupt any in-progress generation, then click + paste
pyautogui.press('escape'); time.sleep(0.3)
pyautogui.click(cx, cy); time.sleep(0.4)
pyautogui.press('escape'); time.sleep(0.3)

prompt = "STAND DOWN — GTL 3 is taking the dispatches/attune_daycell_dow_label.md task instead. If you have not yet started editing DayCell.jsx, stop here. If you have started, do NOT commit or push — discard your local changes (`git restore components/attune/DayCell.jsx`) and stand by. Acknowledge with one line: 'stood down, no commit.'"

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('stand-down sent')
