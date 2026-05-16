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
    print('no BR pane found'); sys.exit(1)
print(f'GTL 1 (BR): {target.title} at {target.left},{target.top}')

cx = target.left + target.width // 2
cy = target.top + target.height - 30
pyautogui.click(cx, cy); time.sleep(0.4)

prompt = (
    "PRIORITY TASK. `git pull origin dev` first. Then read `dispatches/attune_final_redesign.md` end-to-end "
    "and execute it exactly. The spec contains LITERAL full-file replacements for 4 files plus a 1-line edit "
    "to a 5th — paste them in verbatim, don't reinterpret. The 5 files: "
    "(1) app/attune/page.js — add display:flex flexDirection:column to the parent div around line 306. "
    "(2) components/attune/CycleCalendar.jsx — full replacement (per-weekday vertical columns, sticky DOW header outside TransformWrapper). "
    "(3) components/attune/DayCell.jsx — full replacement (dayNum + kanji + English label + always-visible chip stack). "
    "(4) components/attune/SetChip.jsx — full replacement (inline ⎘⇄✕ icons, tap-body opens action menu, long-press fallback). "
    "(5) components/attune/AutoAttuneButton.jsx — full replacement (always visible, fills only empty days). "
    "All earlier Attune dispatches are SUPERSEDED — ignore them. The 4 file-replacement code blocks in the spec are "
    "marked 'FULL REPLACEMENT' — copy-paste them in. Make TWO commits: (a) per-weekday columns layout (commit changes "
    "to page.js + CycleCalendar.jsx), then (b) cell content + chip icons + auto-attune persistence (commit DayCell.jsx + "
    "SetChip.jsx + AutoAttuneButton.jsx). Push to origin/dev. Then verify with playwright at 390x844 with a multi-week "
    "cycle seeded into localStorage (gtl-active-profile=KING; gtl-KING-active-cycle-id=cyc1; "
    "gtl-KING-cycles=JSON of [{id:'cyc1', name:'KING', days:[7 ISO dates spanning 2 weeks], dailyPlan:{iso→[muscle]}}]). "
    "Take 3 screenshots: cold load with chips visible, after AUTO-ATTUNE on partial cycle, after pinch-zoom in. "
    "Report both SHAs + 3 screenshots + the line: 'per-weekday columns live, chip actions inline, auto-attune persistent.'"
)

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
