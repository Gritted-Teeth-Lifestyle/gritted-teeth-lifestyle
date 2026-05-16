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

# BR = GTL 1
target = None
for w in cands:
    if w.top > mid_y and w.left > mid_x:
        target = w; break

if target is None:
    print('no BR pane'); sys.exit(1)
print(f'GTL 1 (BR): {target.title}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.press('escape'); time.sleep(0.3)
pyautogui.click(cx, cy); time.sleep(0.4)
pyautogui.press('escape'); time.sleep(0.3)

prompt = "STAND DOWN — Jordan is reassigning the attune_final_redesign.md task to GTL 3 instead. If you have NOT yet started editing files, stop here. If you have started, do NOT commit or push — `git restore .` to discard local changes and stand by. Acknowledge with one line: 'stood down, no commit.'"

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('stand-down sent')
