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

prompt = "git pull origin dev. Read dispatches/attune_polish_round2.md and execute. FIVE fixes: (1) SetChip.jsx — remove the ChipActionMenu pop-up entirely; tap chip body = no-op (inline ⎘⇄✕ icons already cover Copy/Replace/Delete); long-press also no-op; remove the menuOpen state and the <ChipActionMenu> JSX render. Don't delete ChipActionMenu.jsx file. (2) PickerSheet.jsx — picker exercise list maxHeight 220 → 132 (about 3 rows visible, scroll for more). (3) PickerSheet.jsx — strip the picker header to just `{sourceMuscle.toUpperCase()}` on the left and an × close on the right. Remove the 'PICKER · ATTUNE · LOCKED:' prefix and the 'TAP DAYS ON THE CALENDAR...' subtext entirely. (4) DayCell.jsx — day-number font 0.95rem → 1.4rem with fontWeight 900. (5) DayCell.jsx — English muscle label fontSize 0.45rem → 0.7rem, fontWeight 700, color #a8a39a → #f1eee5 (chalk-white). Don't touch lib/, app/attune/page.js, AutoAttuneButton, CycleCalendar, or any other file. ASK BEFORE COMMITTING if anything is unclear. Single commit. Push origin/dev. 3 screenshots: cold load with bigger day-num+labels, picker open with 3 rows + minimal header, chip-icon tap firing without pop-up. Report SHA + screenshots + 5 one-line confirmations."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
