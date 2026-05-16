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
    if w.top > mid_y and w.left > mid_x:   # BR
        target = w; break

if target is None:
    print('no BR'); sys.exit(1)
print(f'GTL 1 (BR): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/attune_movements_page.md (in your repo root) and execute. You are Worker A — building the new Attune Movements page (Plan Units 1-5 + page-side parts of Unit 6). Step 1 is critical: land the shared attunement store + PickerSheet stub as your FIRST commit so Workers B (GTL 2) and C (GTL 3) can pull and integrate. Use @dnd-kit for chip drag-drop and react-zoom-pan-pinch for the calendar surface — install if not present. Mobile-only viewport (~390x844). Commit and push to origin/dev after each meaningful step. Report: final commit hash, 3 screenshots (far-zoom calendar / picker with multi-day selector / drag-drop in flight), confirmation that store + PickerSheet are exported."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
