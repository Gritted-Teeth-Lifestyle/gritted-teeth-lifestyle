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

prompt = (
    "git pull origin dev. Read dispatches/attune_master_polish.md and execute. SUPERSEDES dispatches/attune_polish_chip_layout.md — do that one's work via this spec instead. SEVEN fixes: "
    "(1) today's day-number renders red (#d4181f) instead of chalk — pass isToday from CycleCalendar through to DayCell. "
    "(2) widen columns 110px → 160px in CycleCalendar grid; TransformWrapper at initialScale 1, no centerOnInit, initialPositionX/Y 0 — page lands on SUN/MON left edge. "
    "(3) PickerSheet exercise list capped at maxHeight 220px (~5 rows visible) with overflowY auto for the rest. "
    "(4) Remove EQUIPMENT_GLYPH constant + glyph rendering from PickerSheet — no more M/B/D/K/C/R/b/· badges. "
    "(5) Chip's three action buttons (⎘⇄✕) move from inline-right to a divider-separated row BELOW the label, BIG (fontSize 1rem, padding 4px 8px, minWidth/Height 28). Chip becomes flex column with full-width multi-line label on top. "
    "(6) Multi-select picker: change selectedExerciseId → selectedExerciseIds[]; tap toggles inclusion; confirm loops onConfirm over each selected ID (so N exercises × M selected days = N×M chips placed). Confirm button label shows the count. "
    "(7) Remove the ★ source-day star from DayCell entirely — selected days are distinguished only by red border. "
    "Don't touch lib/, app/attune/page.js, or any non-listed components. Don't touch the schedule page. "
    "If anything is unclear ASK BEFORE committing. Jordan said: he'd rather wait than re-dispatch. "
    "Verify with playwright at 390x844 with multi-week cycle (today as one carved day). Take 4 screenshots: cold load (wider cols, today red, no ★), picker open showing exactly ~5 rows, picker with 2 exercises multi-selected, after auto-attune showing chips with bigger below-label icons. "
    "Push to origin/dev. Report SHA(s) + 4 screenshots + 7 one-line confirmations."
)

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
