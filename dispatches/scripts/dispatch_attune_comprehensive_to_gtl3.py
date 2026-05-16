import sys, time
sys.stdout.reconfigure(encoding='utf-8')
import pygetwindow as gw
import pyautogui, pyperclip

# GTL 3 = TL.
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
    print('no TL pane found'); sys.exit(1)
print(f'GTL 3 (TL): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/attune_comprehensive_redesign.md and execute. This SUPERSEDES the calendar height fix and the DOW/label fix you may have already worked on. Three core changes plus polish: (1) CycleCalendar.jsx becomes a Sun→Sat 7-column week-aligned grid with empty-day placeholder cells in non-carved slots — drop the per-tier rendering branches, (2) DayCell.jsx always shows DOW + day-number header, kanji + English label paired, AND the full chip stack (no tier gating), (3) SetChip.jsx exposes inline ⎘ ⇄ ✕ icons on each chip plus tap opens the full action menu — long-press still works as fallback. Also: app/attune/page.js parent wrapper at line ~306 needs display:flex flexDirection:column added so the calendar fills the viewport height. Use the literal full-file replacements in the spec — they are complete drop-ins. Two commits: (1) week-aligned grid, (2) always-visible chip stack with inline icons. Verify at 390x844 with a populated cycle in localStorage (gtl-KING-active-cycle-id + gtl-KING-cycles). Take 3 screenshots: cold load, after 3 chips placed, after one chip drag-moved. Push to origin/dev. Report SHAs + screenshots + 'tier-gated rendering removed, week-aligned grid live, chip actions inline.'"

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
