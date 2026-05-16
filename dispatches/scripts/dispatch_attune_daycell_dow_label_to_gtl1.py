import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 1 = BR per feedback_dispatch_multi_worker_layout.md.
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
    if w.top > mid_y and w.left > mid_x:   # BR = GTL 1
        target = w; break

if target is None:
    print('no BR pane found'); sys.exit(1)
print(f'GTL 1 (BR): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/attune_daycell_dow_label.md and execute. /attune cells currently render only the muscle kanji — no day-of-week, no day number, no English pairing. Edit only components/attune/DayCell.jsx: (1) add MUSCLE_LABEL map (chest→CHEST etc.) next to MUSCLE_KANJI, (2) compute dowLabel + dayNum from dayId via local-tz Date, (3) restructure cell to render top header (DOW left + day number right, with ★ inline before DOW for source day), kanji centered (smaller at far tier), English label below kanji, move chip-count badge to bottom-left, bump far minHeight 84→100. Don't touch CycleCalendar.jsx or page.js or anything else. Screenshot /attune at 390x844 with a populated 7-day cycle showing all 11 muscles to verify the kanji↔English pairing. Commit + push origin/dev. Report SHA + screenshot."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
