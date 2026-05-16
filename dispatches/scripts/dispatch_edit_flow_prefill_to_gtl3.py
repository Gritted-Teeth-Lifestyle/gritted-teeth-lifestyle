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

prompt = "git pull origin dev. Read dispatches/attune_edit_flow_prefill.md and execute. The bug: /fitness/load handleReview correctly writes the cycle's training-days/daily-plan/etc to localStorage AND sets editing-cycle-id, but /fitness/new/branded never reads any of that on mount — it starts blank. So coming from edit hub → schedule starts empty, user can't actually edit, /attune never sees the user's edits because nothing gets re-committed against the same cycle. Fix: in app/fitness/new/branded/page.js add a useEffect (mount-only, []) that checks if pk('editing-cycle-id') is set; if yes, reads pk('training-days') + pk('daily-plan') and seeds selectedDays = new Set(daysArr) and assignments = { iso: new Set(muscles) }. Also setDisplayDate to the month of the first carved day. Don't touch ANY other file. Don't hydrate when not in edit mode (keep new-cycle flow starting blank). Don't break the existing Quick-Forge useEffect. ASK BEFORE COMMITTING if unclear. Single commit. Verify with playwright by seeding gtl-KING-editing-cycle-id + gtl-KING-training-days + gtl-KING-daily-plan and navigating to /fitness/new/branded — the calendar should show the cycle's days pre-selected with their muscle highlights. Compare to a non-edit-mode visit (no editing-cycle-id seeded) — should be blank. 2 screenshots. Push origin/dev. Report SHA + 2 screenshots."

pyperclip.copy(prompt); time.sleep(0.2)
pyautogui.hotkey('ctrl', 'v'); time.sleep(0.6)
pyautogui.press('enter')
print('sent')
