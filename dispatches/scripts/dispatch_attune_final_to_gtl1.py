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
    if w.top > mid_y and w.left > mid_x:   # BR = GTL 1
        target = w; break

if target is None:
    print('no BR pane found'); sys.exit(1)
print(f'GTL 1 (BR): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = "Read dispatches/attune_final_redesign.md and execute. SUPERSEDES every prior Attune dispatch (calendar height fix, DOW/label, comprehensive_redesign). Layout is PER-WEEKDAY vertical columns: 7 fixed cols Sun→Sat, each col stacks all carved days matching that weekday chronologically. NO row alignment between cols. NO placeholders for skipped weeks. Empty cols stay empty. Sticky DOW header at top (outside TransformWrapper so it doesn't scale with zoom). Pinch-zoom kept (chip text small at scale 1, user pinches to read). 1-finger drag = vertical scroll via TransformWrapper panning at scale 1. AutoAttuneButton stays visible permanently — fills only days with 0 chips, never overwrites existing. All-uniform red border for source + multi-target selected. Inline ⎘⇄✕ icons on every chip + tap-chip-body opens full action menu + long-press fallback. Files: app/attune/page.js (parent flex column 1-line fix), components/attune/CycleCalendar.jsx (full replacement), components/attune/DayCell.jsx (full replacement), components/attune/SetChip.jsx (full replacement), components/attune/AutoAttuneButton.jsx (full replacement). Two commits: (1) per-weekday columns layout, (2) cell content + chip icons + auto-attune persistence. Verify at 390x844 with multi-week cycle in localStorage (gtl-KING-active-cycle-id + gtl-KING-cycles). Take 3 screenshots: cold load with chips, after AUTO-ATTUNE on partial cycle, after pinch-zoom in. Push origin/dev. Report SHAs + screenshots + 'per-weekday columns live, chip actions inline, auto-attune persistent.'"

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
