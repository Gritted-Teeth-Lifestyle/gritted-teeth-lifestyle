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

prompt = "git pull origin dev. Read dispatches/attune_picker_landscape.md and execute. The picker bottom sheet renders too narrow + too tall in iPhone landscape (the maxWidth:430 caps it as a centered band, the 70vh of 390px landscape height = 273px making it dominate the viewport). Add a media-query override: in (orientation: landscape) and (max-height: 500px), the sheet gets max-width: 100% (full width) and max-height: 75vh. Use a <style> block inside the dialog, plus add className='gtl-picker-sheet' to the inner sheet div, moving width/maxWidth/maxHeight from inline style to the class. No JS orientation detection. Don't touch anything else. Verify with playwright at viewport {width:844,height:390} for landscape and {width:390,height:844} for portrait. Take 2 screenshots. ASK BEFORE COMMITTING if unclear. Single commit. Push origin/dev. Report SHA + 2 screenshots."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
