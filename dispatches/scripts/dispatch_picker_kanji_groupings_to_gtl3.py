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

prompt = "git pull origin dev. Read dispatches/attune_picker_kanji_groupings.md and execute. THREE fixes: (1) PickerSheet.jsx — landscape media query maxHeight 75vh → 60vh (still too tall in landscape; gives 156px of calendar above instead of 98px). Portrait stays 70vh. (2) PickerSheet.jsx — add MUSCLE_KANJI map and prepend the kanji to the picker header so it reads `胸 CHEST` (kanji in Noto Serif JP, red, baseline-aligned with the English label). (3) DayCell.jsx — add UPPER/LOWER/FULL BODY collapse logic via muscleGroupLabel() helper. Exact set equality: ALL 11 → 全 + FULL BODY; exactly the 6 UPPER (chest/back/shoulders/biceps/triceps/forearms) → 上 + UPPER; exactly the 4 LOWER (quads/hamstrings/calves/glutes) → 下 + LOWER; anything else (including partial matches and any abs-included subset that isn't all 11) → current per-muscle stack rendering. Don't touch CycleCalendar, SetChip, or anything else. ASK BEFORE COMMITTING if unclear. Single commit. Push origin/dev. Verify with playwright at 390×844 portrait + 844×390 landscape + a multi-day cycle that includes one full-body day, one upper-only day, one lower-only day, one single-muscle day, one mixed day. 3 screenshots. Report SHA + screenshots + 3 one-line confirmations."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
