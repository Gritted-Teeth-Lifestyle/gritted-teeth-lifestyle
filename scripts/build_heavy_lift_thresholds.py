"""Generate heavy_lift_threshold per exercise based on name patterns and class.

Output: writes HEAVY_LIFT_THRESHOLDS dict to scripts/heavy_lift_output.txt
        and updates lib/exerciseLibrary.js entries with heavy_lift_threshold field.
"""
import re
import json
import sys

LIB = 'lib/exerciseLibrary.js'

# Class defaults (used if no specific pattern matches)
CLASS_DEFAULTS = {
    'KING': 2.0,
    'CMP': 1.5,
    'ISO': 0.4,
}

# Class-level magnitude scaling (already locked)
CLASS_SCALES = {
    'KING': 0.7,
    'CMP': 1.0,
    'ISO': 1.5,
}

KING_COMPOUNDS = {
    'BARBELL SQUAT', 'FRONT SQUATS', 'SUMO SQUATS', 'BOX SQUAT', 'BELT SQUAT',
    'HACK SQUATS', 'TRAP BAR SQUAT', 'SMITH MACHINE SQUAT', 'PENDULUM SQUAT',
    'DEADLIFTS', 'SUMO DEADLIFT', 'BARBELL ROMANIAN DEADLIFT (RDL)',
    'STIFF-LEGGED DEADLIFTS', 'DEFICIT DEADLIFT', 'RACK DEADLIFT',
    'LEG PRESS', 'LEG PRESSES (NARROW)', 'LEG PRESSES (WIDE)',
}

ISOLATION_OVERRIDE = {
    'CABLE REAR DELT FLY','REAR DELT RAISE','INCLINE BENCH REVERSE FLY','REVERSE FLY STANDING',
    'CHEST-SUPPORTED REAR DELT RAISE','BUTTERFLY REVERSE','DUMBBELL REAR DELT ROW',
    'BARBELL HIP THRUST','DUMBBELL HIP THRUST','DUMBBELL SINGLE-LEG HIP THRUST',
    'GLUTE KICKBACK (MACHINE)','GLUTE DRIVE','CABLE PULL THROUGH',
}

REGION = {'chest':'FRONT','quads':'FRONT','back':'BACK','hamstrings':'BACK',
          'shoulders':'ARMS','biceps':'ARMS','triceps':'ARMS','forearms':'ARMS',
          'abs':'CORE','glutes':'LEGS','calves':'LEGS'}

def rw_(p, s):
    rw = {}
    if p and not s:
        sh = 1.0 / len(p)
        for m in p: rw[REGION[m]] = rw.get(REGION[m], 0) + sh
        return rw
    pi = 0.6 / len(p) if p else 0
    si = 0.4 / len(s) if s else 0
    for m in p: rw[REGION[m]] = rw.get(REGION[m], 0) + pi
    for m in s: rw[REGION[m]] = rw.get(REGION[m], 0) + si
    return rw

def classify(e):
    if e['id'] in KING_COMPOUNDS:
        return 'KING'
    if e['id'] in ISOLATION_OVERRIDE:
        return 'ISO'
    rw = rw_(e.get('primaryMuscles', []), e.get('secondaryMuscles', []))
    return 'ISO' if len(rw) == 1 else 'CMP'


def threshold(name, cls):
    """Return the heavy_lift_threshold for this exercise based on name patterns."""
    n = name.upper()

    # Bench press family — 1.5× BW (advanced bench)
    if 'BENCH PRESS' in n or 'CHEST PRESS' in n:
        return 1.5

    # Squat family (Kings — 1.75× advanced squat)
    if cls == 'KING':
        # Specific overrides within King list
        if 'HACK SQUAT' in n or 'TRAP BAR' in n or 'PENDULUM' in n or 'BELT SQUAT' in n:
            return 2.0  # machine squats heavier
        if 'LEG PRESS' in n:
            return 2.5
        if 'FRONT SQUAT' in n:
            return 1.5  # front-loaded, lower
        if 'SQUAT' in n:
            return 1.75  # advanced back squat
        # Deadlifts
        if 'ROMANIAN' in n or '(RDL)' in n or 'STIFF-LEG' in n or 'STIFF LEG' in n:
            return 1.75
        if 'DEADLIFT' in n:
            return 2.0
        return CLASS_DEFAULTS['KING']

    # Front squat (CMP) — 1.5
    if 'FRONT SQUAT' in n:
        return 1.5
    # Squat compounds (DB squats, Bulgarian, split, etc.) — 1.0× (single-leg or DB)
    if 'BULGARIAN' in n or 'SPLIT SQUAT' in n or 'GOBLET' in n or 'DUMBBELL FRONT SQUAT' in n:
        return 1.0

    # Romanian DL (CMP variants — DB RDL, single-leg) — 1.0
    if 'ROMANIAN DEADLIFT' in n or 'SINGLE-LEG DEADLIFT' in n:
        return 1.0

    # OHP / shoulder press — 1.0× advanced
    if 'OVERHEAD PRESS' in n or 'SHOULDER PRESS' in n or 'PUSH PRESS' in n:
        return 1.0
    if 'INCLINE OHP' in n or 'INCLINE SMITH PRESS' in n or 'HIGH-INCLINE SMITH' in n:
        return 1.25  # high-incline somewhere between bench and OHP
    if 'LANDMINE PRESS' in n:
        return 1.0
    if 'JM PRESS' in n:
        return 0.75  # tricep-focused press

    # Row family — 1.2× advanced barbell row
    if 'ROW' in n and 'UPRIGHT' not in n:
        return 1.2

    # Upright row — 0.7 (delts/traps)
    if 'UPRIGHT' in n:
        return 0.7

    # Lat pulldown / pull-up family
    if 'PULL-UP' in n or 'PULL-UPS' in n or 'CHIN-UP' in n or 'CHIN-UPS' in n or 'PULLUP' in n:
        return 1.5  # 1.5x bw incl bodyweight = +0.5 added weight = advanced
    if 'LAT PULL' in n or 'PULLDOWN' in n or 'PULL DOWN' in n:
        return 1.0  # advanced lat pulldown ~1x bw
    if 'FACEPULL' in n or 'FACE PULL' in n:
        return 0.5

    # Dips — 1.5× total load incl BW
    if 'DIP' in n:
        return 1.5

    # Hip thrust family (ISO override but heavy) — 2.0
    if 'HIP THRUST' in n or 'GLUTE DRIVE' in n or 'GLUTE KICKBACK' in n or 'CABLE PULL THROUGH' in n:
        return 2.0

    # Glute bridge family — 1.0
    if 'GLUTE BRIDGE' in n:
        return 1.0

    # Lunge — 0.75× per leg
    if 'LUNGE' in n:
        return 0.75

    # Hyperextensions — 0.5
    if 'HYPEREXTENSION' in n or 'BACK EXTENSION' in n:
        return 0.5
    if 'GOOD MORNING' in n:
        return 0.75

    # Leg curl / extension — 0.7
    if 'LEG CURL' in n or 'NORDIC CURL' in n:
        return 0.7
    if 'LEG EXTENSION' in n or 'REVERSE NORDIC' in n:
        return 0.7

    # Hip abduction / adduction — 0.5
    if 'HIP ABDUCTION' in n or 'HIP ADDUCTION' in n:
        return 0.5

    # Curl family
    if 'WRIST CURL' in n:
        return 0.3
    if 'HAMMER CURL' in n or 'HAMMERCURL' in n or 'ZOTTMAN' in n:
        return 0.4
    if 'PREACHER' in n:
        return 0.45
    if 'CURL' in n:
        return 0.45

    # Tricep family
    if 'SKULL' in n:
        return 0.5
    if 'PUSHDOWN' in n:
        return 0.5
    if 'TRICEP' in n and 'KICKBACK' in n:
        return 0.4
    if 'TRICEP' in n or 'TRICEPS' in n or 'TRI EXTENSION' in n:
        return 0.5

    # Shoulder raises
    if 'LATERAL RAISE' in n or 'SIDE LATERAL' in n or 'SCAPTION' in n:
        return 0.4
    if 'FRONT RAISE' in n or 'FRONT PLATE RAISE' in n:
        return 0.3
    if 'REAR DELT' in n or 'REVERSE FLY' in n:
        return 0.35
    if 'Y-RAISE' in n or 'W-RAISE' in n or 'T/Y/I' in n or 'TRAP-3' in n:
        return 0.35

    # Rotator cuff
    if 'EXTERNAL ROTATION' in n or 'INTERNAL ROTATION' in n:
        return 0.25

    # Calf raise — 1.5
    if 'CALF' in n:
        return 1.5

    # Shrug — 1.5
    if 'SHRUG' in n:
        return 1.5

    # Fly / pec deck — 0.5
    if 'FLY' in n or 'BUTTERFLY' in n:
        return 0.5
    if 'CROSS-OVER' in n or 'CROSSOVER' in n or 'CABLE PRESS AROUND' in n:
        return 0.5

    # Pullover — 0.6
    if 'PULLOVER' in n:
        return 0.6

    # Push-up family — bodyweight, default by class
    if 'PUSH-UP' in n or 'PUSH UP' in n or 'PUSHUP' in n or 'PRESS-UP' in n:
        return 1.0  # weighted pushup ~1x bw incl BW

    # Ab work — 0.5
    if 'CRUNCH' in n or 'SIT-UP' in n or 'AB WHEEL' in n or 'ROLLOUT' in n:
        return 0.5
    if 'LEG RAISE' in n or 'KNEE RAISE' in n or 'HANGING' in n:
        return 1.0  # hanging leg raise = bw + added weight
    if 'FLUTTER' in n or 'TUCK' in n:
        return 0.5
    if 'PALLOF' in n or 'WOOD CHOP' in n or 'WOODCHOP' in n or 'TRUNK' in n or 'ROTARY' in n:
        return 0.5
    if 'SIDE BEND' in n:
        return 0.5

    # Thrusters — 1.0× compound
    if 'THRUSTER' in n:
        return 1.0

    # Neck — 0.3
    if 'NECK EXTENSION' in n:
        return 0.3

    # Superman / mobility — should already be filtered, fallback
    return CLASS_DEFAULTS[cls]


def main():
    with open(LIB, encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'(// AUTO-GENERATED.*?Exercise count: )(\d+)(\n\n)export const ALL_EXERCISES = (\[.*?\n\])(\n)(.*)', src, re.DOTALL)
    header_pre, _, header_post, arr_text, sep, tail = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6)
    data = json.loads(arr_text)

    thresholds = {}
    for e in data:
        cls = classify(e)
        t = threshold(e['id'], cls)
        thresholds[e['id']] = (t, cls)

    print(f'Generated thresholds for {len(thresholds)} exercises')

    if '--apply' in sys.argv:
        # Update library entries
        for e in data:
            t, cls = thresholds[e['id']]
            e['heavy_lift_threshold'] = t
            e['heavy_lift_scale'] = CLASS_SCALES[cls]

        new_arr = json.dumps(data, indent=2, ensure_ascii=False)
        new_src = header_pre + str(len(data)) + header_post + 'export const ALL_EXERCISES = ' + new_arr + sep + tail
        with open(LIB, 'w', encoding='utf-8') as f:
            f.write(new_src)
        print(f'Applied to {LIB}')

        # Write threshold map for lib/exerciseAliases.js
        with open('scripts/heavy_lift_output.txt', 'w', encoding='utf-8') as f:
            f.write('// Generated by scripts/build_heavy_lift_thresholds.py\n')
            f.write('export const HEAVY_LIFT_THRESHOLDS = {\n')
            for name in sorted(thresholds):
                t, _ = thresholds[name]
                f.write(f'  {json.dumps(name)}: {t},\n')
            f.write('}\n')
        print('Wrote threshold map to scripts/heavy_lift_output.txt')

    # Show distribution
    from collections import Counter
    dist = Counter(t for t, _ in thresholds.values())
    print('\nThreshold distribution:')
    for t in sorted(dist, reverse=True):
        print(f'  {t}: {dist[t]} exercises')


if __name__ == '__main__':
    main()
