"""Generate MUSCLE_FIXUP for exerciseLibrary.js based on biomechanical classifier.
Usage: python scripts/build_muscle_fixup.py [--apply]
Without --apply: prints proposed fixups + unknowns. With --apply: writes the
fixup map to lib/exerciseLibrary.js in place.
"""
import re
import json
import sys

LIB = 'lib/exerciseLibrary.js'

def classify(name):
    n = name.upper()

    # === LEG-specific exercises (handle BEFORE generic CURL/SQUAT patterns) ===
    if 'LEG CURL' in n:
        return ['hamstrings']
    if n.strip() == 'NORDIC CURL' or 'NORDIC CURL' in n and 'REVERSE' not in n:
        return ['hamstrings']
    if 'REVERSE NORDIC' in n:
        return ['quads']
    if 'LEG EXTENSION' in n:
        return ['quads']
    if 'CALF' in n and ('RAISE' in n or 'PRESS' in n or 'TOE PRESS' in n):
        return ['calves']

    # === HIP / GLUTE / BRIDGE (before SQUAT/LUNGE) ===
    if 'HIP THRUST' in n:
        return ['glutes', 'hamstrings']
    if n.strip() == 'THRUSTER' or 'DUMBBELL THRUSTER' in n:
        return ['quads', 'glutes', 'shoulders', 'triceps']
    if 'GLUTE BRIDGE' in n or 'GLUTE DRIVE' in n:
        return ['glutes', 'hamstrings']
    if 'GLUTE KICKBACK' in n or 'CABLE PULL THROUGH' in n:
        return ['glutes', 'hamstrings']
    if 'HIP ABDUCTION' in n:
        return ['glutes']
    if 'HIP ADDUCTION' in n:
        return ['quads', 'glutes']

    # === DEADLIFT ===
    if 'ROMANIAN DEADLIFT' in n or '(RDL)' in n or 'STIFF-LEG' in n or 'STIFF LEG' in n:
        return ['hamstrings', 'glutes', 'back']
    if 'SUMO DEADLIFT' in n:
        return ['glutes', 'hamstrings', 'back', 'quads']
    if 'DEFICIT DEADLIFT' in n:
        return ['back', 'glutes', 'hamstrings', 'quads']
    if 'RACK DEADLIFT' in n:
        return ['back', 'glutes', 'hamstrings']
    if 'SINGLE-LEG DEADLIFT' in n:
        return ['hamstrings', 'glutes', 'back']
    if 'DEADLIFT' in n:
        return ['back', 'glutes', 'hamstrings']

    # === LEG PRESS (must come BEFORE SQUAT; LEG PRESS isn't a squat) ===
    if 'LEG PRESS' in n and 'TOE' in n:
        return ['calves']
    if 'LEG PRESS' in n or 'LEG PRESSES' in n:
        if 'NARROW' in n:
            return ['quads', 'glutes']
        if 'WIDE' in n:
            return ['quads', 'glutes', 'hamstrings']
        return ['quads', 'glutes', 'hamstrings']

    # === SQUAT ===
    if 'HACK SQUAT' in n or 'PENDULUM SQUAT' in n or 'BELT SQUAT' in n or 'BOX SQUAT' in n:
        return ['quads', 'glutes']
    if 'SMITH MACHINE SQUAT' in n:
        return ['quads', 'glutes']
    if 'SMITH MACHINE SPLIT SQUAT' in n or 'SPLIT SQUAT' in n or 'BULGARIAN SQUAT' in n:
        return ['quads', 'glutes']
    if 'GOBLET SQUAT' in n:
        return ['quads', 'glutes']
    if 'FRONT SQUAT' in n:
        return ['quads', 'glutes']
    if 'TRAP BAR SQUAT' in n:
        return ['quads', 'glutes', 'hamstrings']
    if 'SUMO SQUAT' in n:
        return ['quads', 'glutes', 'hamstrings']
    if re.search(r'\bSQUAT(S)?\b', n) and 'BARBELL' in n or n.strip() == 'SQUATS' or n.strip() == 'BARBELL SQUAT':
        return ['quads', 'glutes', 'hamstrings']

    # === LUNGE ===
    if 'LUNGE' in n:
        return ['quads', 'glutes', 'hamstrings']

    # === WRIST CURL ===
    if 'WRIST CURL' in n:
        return ['forearms']

    # === HAMMER / REVERSE / ZOTTMAN curls (forearm bias) ===
    if any(x in n for x in ['HAMMER CURL', 'HAMMERCURL', 'ZOTTMAN', 'OVERHAND CABLE CURL']):
        return ['biceps', 'forearms']
    if 'REVERSE CURL' in n or 'REVERSE EZ BAR' in n or 'REVERSE PREACHER' in n:
        return ['biceps', 'forearms']

    # === Standard bicep curl ===
    if 'CURL' in n and 'PREACHER' in n:
        return ['biceps']
    if 'BAYESIAN' in n:
        return ['biceps']
    if 'CURL' in n:
        return ['biceps']

    # === TRICEP isolation ===
    if 'SKULLCRUSHER' in n or 'SKULL CRUSHER' in n or 'SKULL CRUSH' in n:
        return ['triceps']
    if 'TRICEPS EXTENSION' in n or 'TRICEP EXTENSION' in n or 'TRI EXTENSION' in n:
        return ['triceps']
    if 'LYING TRICEPS' in n or 'OVERHEAD CABLE TRICEP' in n or 'OVERHEAD TRICEPS' in n:
        return ['triceps']
    if 'TRICEPS PRESS' in n or 'TRICEPS DIPS' in n:
        return ['triceps']
    if 'PUSHDOWN' in n:
        return ['triceps']
    if 'JM PRESS' in n:
        return ['triceps', 'chest']
    if 'TRICEP DUMBBELL KICKBACK' in n or 'CABLE TRICEP KICKBACK' in n or 'LYING TRICEPS KICKBACK' in n:
        return ['triceps']

    # === SHOULDER raises / lat / front / rear ===
    if 'LATERAL RAISE' in n or 'LATERAL RAISES' in n or 'SIDE LATERAL' in n or 'SCAPTION' in n:
        return ['shoulders']
    if 'FRONT RAISE' in n or 'FRONT PLATE RAISE' in n:
        return ['shoulders']
    if 'REAR DELT' in n:
        return ['shoulders', 'back']
    if 'REVERSE FLY' in n or 'BUTTERFLY REVERSE' in n:
        return ['shoulders', 'back']
    if 'Y-RAISE' in n or 'W-RAISE' in n or 'T/Y/I' in n or 'TRAP-3 RAISE' in n:
        return ['shoulders', 'back']

    # === Rotator cuff ===
    if 'EXTERNAL ROTATION' in n or 'INTERNAL ROTATION' in n:
        return ['shoulders']

    # === Overhead press / shoulder press / push press ===
    if 'OVERHEAD PRESS' in n or n.strip() == 'OHP':
        return ['shoulders', 'triceps']
    if 'PUSH PRESS' in n:
        return ['shoulders', 'triceps', 'quads']
    if 'INCLINE OHP' in n or 'INCLINE SMITH PRESS' in n or 'HIGH-INCLINE SMITH' in n:
        return ['shoulders', 'chest', 'triceps']
    if 'SHOULDER PRESS' in n:
        return ['shoulders', 'triceps']
    if 'LANDMINE PRESS' in n:
        return ['shoulders', 'triceps', 'chest']

    # === Shrug (traps = back) ===
    if 'SHRUG' in n:
        return ['back']

    # === Upright row (delt-focused) ===
    if 'UPRIGHT' in n and ('ROW' in n or 'PULL' in n):
        return ['shoulders', 'back']

    # === BENCH PRESS / CHEST PRESS ===
    if 'BENCH PRESS' in n and ('CLOSE-GRIP' in n or 'CLOSE GRIP' in n):
        return ['triceps', 'chest', 'shoulders']
    if 'BENCH PRESS' in n or 'CHEST PRESS' in n:
        return ['chest', 'shoulders', 'triceps']
    if 'REVERSE GRIP BENCH PRESS' in n:
        return ['chest', 'triceps', 'shoulders']

    # === FLY / PEC / CROSSOVER ===
    if 'BUTTERFLY' in n:
        return ['chest']
    if 'CABLE FLY' in n or 'INCLINE DUMBBELL FLY' in n or 'FLY WITH' in n or n.endswith(' FLY') or 'INCLINE BENCH REVERSE FLY' in n:
        return ['chest', 'shoulders']
    if 'CROSS-OVER' in n or 'CROSSOVER' in n:
        return ['chest', 'shoulders']
    if 'CABLE PRESS AROUND' in n:
        return ['chest', 'shoulders']

    # === PUSH-UP ===
    if 'PIKE PUSH' in n:
        return ['shoulders', 'triceps']
    if 'PUSH-UP' in n or 'PUSH UP' in n or 'PUSHUP' in n or 'PUSHUPS' in n or 'PRESS-UP' in n or 'PRESS-UPS' in n:
        if 'CLOSE-GRIP' in n or 'DIAMOND' in n or 'CLOSE GRIP' in n:
            return ['triceps', 'chest', 'shoulders']
        return ['chest', 'shoulders', 'triceps']

    # === DIP ===
    if 'DIP' in n:
        return ['chest', 'triceps']

    # === PULL-UP / CHIN-UP ===
    if 'PULL-UP' in n or 'PULL-UPS' in n or 'CHIN-UP' in n or 'CHIN-UPS' in n or 'PULLUP' in n:
        return ['back', 'biceps']
    if 'INVERTED ROW' in n or 'FRONT PULL' in n:
        return ['back', 'biceps']

    # === LAT PULLDOWN (handle both "PULLDOWN" and "PULL DOWN") ===
    if 'LAT PULL' in n or 'PULLDOWN' in n or 'PULL DOWN' in n:
        if 'STRAIGHT-ARM' in n or 'STRAIGHT ARM' in n or 'STRAIGHT-ARM PULL' in n:
            return ['back']
        return ['back', 'biceps']

    # === FACE PULL ===
    if 'FACEPULL' in n or 'FACE PULL' in n:
        return ['back', 'shoulders']

    # === ROWS ===
    if 'KROC ROW' in n or 'PENDELAY' in n or 'BARBELL ROW' in n:
        return ['back', 'biceps']
    if ('BENT' in n and 'ROW' in n) or 'INCLINE' in n and 'ROW' in n:
        return ['back', 'biceps']
    if 'T-BAR ROW' in n or 'HIGH ROW' in n or 'LOW ROW' in n or 'LONG-PULLEY' in n:
        return ['back', 'biceps']
    if 'CABLE ROW' in n or 'SEATED ROW' in n or 'SEATED MACHINE ROW' in n or 'SEATED CABLE' in n:
        return ['back', 'biceps']
    if 'SHOTGUN ROW' in n or 'RENEGADE ROW' in n or 'V-GRIP ROW' in n or 'LATERAL ROWS' in n:
        return ['back', 'biceps']
    if 'ROW' in n and 'ROWING' in n.replace('ROW', '').upper():
        pass
    if 'ROWING SEATED' in n:
        return ['back', 'biceps']
    if 'ALTERNATING HIGH CABLE ROW' in n:
        return ['back', 'biceps']
    if 'LEVERAGE MACHINE ISO ROW' in n:
        return ['back', 'biceps']

    # === PULLOVER ===
    if 'PULLOVER' in n:
        return ['back', 'chest']

    # === ABS ===
    if 'CRUNCH' in n:
        return ['abs']
    if 'SIT-UP' in n or 'SIT UP' in n or 'SIT-UPS' in n:
        return ['abs']
    if 'AB WHEEL' in n or 'AB ROLLOUT' in n or 'ROLLOUT' in n:
        return ['abs']
    if 'LEG RAISE' in n or 'KNEE RAISE' in n:
        return ['abs']
    if 'HANGING LEG' in n:
        return ['abs']
    if 'FLUTTER' in n:
        return ['abs']
    if 'PALLOF' in n or 'WOODCHOPPER' in n or 'WOOD CHOP' in n or 'TRUNK ROTATION' in n or 'ROTARY TORSO' in n:
        return ['abs']
    if 'TRUNK FLEXION' in n or 'SIDE BEND' in n:
        return ['abs']
    if 'SEATED KNEE TUCK' in n:
        return ['abs']

    # === BACK extension / hyper / good morning / superman ===
    if 'HYPEREXTENSION' in n:
        return ['back', 'glutes', 'hamstrings']
    if 'BACK EXTENSION' in n:
        return ['back', 'glutes']
    if 'GOOD MORNING' in n:
        return ['hamstrings', 'glutes', 'back']
    if 'SUPERMAN' in n:
        return ['back', 'glutes']
    if 'NECK EXTENSION' in n:
        return ['back']

    return None


def main():
    with open(LIB, encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'export const ALL_EXERCISES = (\[.*?\n\])', src, re.DOTALL)
    data = json.loads(m.group(1))

    fixups = {}
    unknowns = []
    unchanged = 0

    for e in data:
        new = classify(e['id'])
        if new is None:
            unknowns.append(e)
            continue
        if set(new) != set(e['muscles']):
            fixups[e['id']] = (e['muscles'], new)
        else:
            unchanged += 1

    print(f'Total: {len(data)}')
    print(f'Unchanged: {unchanged}')
    print(f'Fixups proposed: {len(fixups)}')
    print(f'Unknown (kept as-is): {len(unknowns)}')

    print('\n=== FIXUPS ===')
    for name, (old, new) in sorted(fixups.items()):
        print(f'  {name:<55}  {old} -> {new}')

    print('\n=== UNKNOWN ===')
    for e in unknowns:
        print(f'  {e["id"]:<55}  current: {e["muscles"]}')

    if '--apply' in sys.argv:
        # Build MUSCLE_FIXUP dict (just the new lists, not the diff)
        out = {name: new for name, (_, new) in fixups.items()}
        # Apply directly to library file
        new_data = []
        for e in data:
            new_e = {**e}
            if e['id'] in out:
                new_e['muscles'] = out[e['id']]
            new_data.append(new_e)
        m = re.search(r'(// AUTO-GENERATED.*?Exercise count: )(\d+)(\n\n)export const ALL_EXERCISES = (\[.*?\n\])(\n)(.*)', src, re.DOTALL)
        header_pre, _, header_post, arr_text, sep, tail = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6)
        new_arr = json.dumps(new_data, indent=2, ensure_ascii=False)
        new_src = header_pre + str(len(new_data)) + header_post + 'export const ALL_EXERCISES = ' + new_arr + sep + tail
        with open(LIB, 'w', encoding='utf-8') as f:
            f.write(new_src)
        print(f'\nApplied {len(out)} fixups to {LIB}')
        # Write dict entries to a file for inclusion in exerciseAliases.js
        with open('scripts/fixup_entries.txt', 'w', encoding='utf-8') as out_file:
            for k in sorted(out):
                out_file.write(f"  {k!r:<60}: {out[k]!r},\n")
        print(f'Wrote dict entries to scripts/fixup_entries.txt')


if __name__ == '__main__':
    main()
