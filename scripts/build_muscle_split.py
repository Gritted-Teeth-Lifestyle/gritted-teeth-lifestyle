"""Generate primary/secondary muscle split for every exercise.

Uses biomechanical knowledge to classify each exercise into:
  - primary muscles (60% of total weight, split evenly)
  - secondary muscles (40% of total weight, split evenly)

Output: writes lib/exerciseAliases.js MUSCLE_FIXUP block in the new format
        { 'EXERCISE NAME': { primary: [...], secondary: [...] }, ... }
"""
import re
import json
import sys

LIB = 'lib/exerciseLibrary.js'

def split(name):
    """Return (primary_list, secondary_list) for the exercise. None if uncertain."""
    n = name.upper()

    # === LEG-isolation (single muscle, no secondary) ===
    if 'LEG CURL' in n:
        return (['hamstrings'], [])
    if 'NORDIC CURL' in n and 'REVERSE' not in n:
        return (['hamstrings'], [])
    if 'REVERSE NORDIC' in n:
        return (['quads'], [])
    if 'LEG EXTENSION' in n:
        return (['quads'], [])
    if 'CALF' in n and ('RAISE' in n or 'PRESS' in n or 'TOE PRESS' in n):
        return (['calves'], [])
    if 'HIP ABDUCTION' in n:
        return (['glutes'], [])
    if 'HIP ADDUCTION' in n:
        return (['quads'], ['glutes'])
    if 'GLUTE KICKBACK' in n:
        return (['glutes'], ['hamstrings'])

    # === HIP / GLUTE BRIDGE / THRUST ===
    if 'HIP THRUST' in n:
        return (['glutes'], ['hamstrings'])
    if 'GLUTE BRIDGE' in n:
        return (['glutes'], ['hamstrings'])
    if 'GLUTE DRIVE' in n:
        return (['glutes'], ['hamstrings'])
    if 'CABLE PULL THROUGH' in n:
        # primary glutes (hip extension is glute-dominant); hamstrings as secondary
        return (['glutes'], ['hamstrings'])
    if n.strip() == 'THRUSTER' or 'DUMBBELL THRUSTER' in n:
        return (['quads', 'shoulders'], ['glutes', 'triceps'])

    # === DEADLIFT family ===
    if 'ROMANIAN DEADLIFT' in n or '(RDL)' in n:
        return (['hamstrings'], ['glutes', 'back'])
    if 'STIFF-LEG' in n or 'STIFF LEG' in n:
        return (['hamstrings'], ['glutes', 'back'])
    if 'SUMO DEADLIFT' in n:
        return (['glutes', 'hamstrings'], ['back', 'quads'])
    if 'DEFICIT DEADLIFT' in n:
        # quads marginally more involved at deeper start position, but still
        # back-dominant. Drop quads to break LEGS/FRONT tie.
        return (['back'], ['glutes', 'hamstrings'])
    if 'RACK DEADLIFT' in n:
        return (['back'], ['glutes', 'hamstrings'])
    if 'SINGLE-LEG DEADLIFT' in n:
        return (['hamstrings'], ['glutes', 'back'])
    if 'DEADLIFT' in n:
        return (['back'], ['glutes', 'hamstrings'])

    # === LEG PRESS (before SQUAT) ===
    if 'LEG PRESS' in n and 'TOE' in n:
        return (['calves'], [])
    if 'LEG PRESS' in n:
        # Hamstrings involvement is minor — drop from secondary to break ties.
        # Quad-glute is the primary signal regardless of stance width.
        return (['quads'], ['glutes'])

    # === SQUAT family ===
    if 'HACK SQUAT' in n or 'PENDULUM SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'BELT SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'BOX SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'SMITH MACHINE SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'SMITH MACHINE SPLIT SQUAT' in n or 'SPLIT SQUAT' in n or 'BULGARIAN SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'GOBLET SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'FRONT SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'TRAP BAR SQUAT' in n:
        return (['quads'], ['glutes'])
    if 'SUMO SQUATS' in n:
        # Sumo stance shifts emphasis but quad-glute remains the main signal.
        return (['quads'], ['glutes'])
    if re.search(r'\bSQUAT(S)?\b', n):
        return (['quads'], ['glutes'])

    # === LUNGE — quad-dominant; hamstrings minor; drop hams to break ties ===
    if 'LUNGE' in n:
        return (['quads'], ['glutes'])

    # === WRIST CURL (forearms-only) ===
    if 'WRIST CURL' in n:
        return (['forearms'], [])

    # === Forearm-bias curls ===
    if any(x in n for x in ['HAMMER CURL', 'HAMMERCURL', 'ZOTTMAN', 'OVERHAND CABLE CURL']):
        return (['biceps'], ['forearms'])
    if 'REVERSE CURL' in n or 'REVERSE EZ BAR' in n or 'REVERSE PREACHER' in n:
        return (['biceps'], ['forearms'])

    # === Standard bicep curls (isolation) ===
    if 'BAYESIAN' in n:
        return (['biceps'], [])
    if 'CURL' in n and ('PREACHER' in n or 'CONCENTRATION' in n or 'SPIDER' in n):
        return (['biceps'], [])
    if 'CURL' in n:
        return (['biceps'], [])

    # === Tricep isolation ===
    if 'SKULLCRUSHER' in n or 'SKULL CRUSHER' in n or 'SKULL CRUSH' in n:
        return (['triceps'], [])
    if 'TRICEPS EXTENSION' in n or 'TRICEP EXTENSION' in n or 'TRI EXTENSION' in n:
        return (['triceps'], [])
    if 'LYING TRICEPS' in n or 'OVERHEAD CABLE TRICEP' in n or 'OVERHEAD TRICEPS' in n:
        return (['triceps'], [])
    if 'TRICEPS PRESS' in n or 'TRICEPS DIPS' in n:
        return (['triceps'], [])
    if 'PUSHDOWN' in n:
        return (['triceps'], [])
    if 'JM PRESS' in n:
        return (['triceps'], ['chest'])
    if 'TRICEP DUMBBELL KICKBACK' in n or 'CABLE TRICEP KICKBACK' in n or 'LYING TRICEPS KICKBACK' in n:
        return (['triceps'], [])

    # === Shoulder raises (isolation) ===
    if 'LATERAL RAISE' in n or 'LATERAL RAISES' in n or 'SIDE LATERAL' in n or 'SCAPTION' in n:
        return (['shoulders'], [])
    if 'FRONT RAISE' in n or 'FRONT PLATE RAISE' in n:
        return (['shoulders'], [])
    if 'REAR DELT' in n:
        return (['shoulders'], ['back'])
    if 'REVERSE FLY' in n:
        return (['shoulders'], ['back'])
    if 'BUTTERFLY REVERSE' in n:
        return (['shoulders'], ['back'])
    if 'Y-RAISE' in n or 'W-RAISE' in n or 'T/Y/I' in n or 'TRAP-3 RAISE' in n:
        return (['shoulders'], ['back'])

    # === Rotator cuff (isolation) ===
    if 'EXTERNAL ROTATION' in n or 'INTERNAL ROTATION' in n:
        return (['shoulders'], [])

    # === Overhead press / shoulder press ===
    if 'OVERHEAD PRESS' in n or n.strip() == 'OHP':
        return (['shoulders'], ['triceps'])
    if 'PUSH PRESS' in n:
        return (['shoulders'], ['triceps', 'quads'])
    if 'INCLINE OHP' in n or 'INCLINE SMITH PRESS' in n or 'HIGH-INCLINE SMITH' in n:
        return (['shoulders'], ['chest', 'triceps'])
    if 'SHOULDER PRESS' in n:
        return (['shoulders'], ['triceps'])
    if 'LANDMINE PRESS' in n:
        return (['shoulders'], ['triceps', 'chest'])

    # === Shrug (traps = back) ===
    if 'SHRUG' in n:
        return (['back'], [])

    # === Upright row (delt-focused) ===
    if 'UPRIGHT' in n and ('ROW' in n or 'PULL' in n):
        return (['shoulders'], ['back'])

    # === BENCH PRESS / CHEST PRESS ===
    if 'BENCH PRESS' in n and ('CLOSE-GRIP' in n or 'CLOSE GRIP' in n):
        # Close-grip bench is tricep-dominant
        return (['triceps'], ['chest', 'shoulders'])
    if 'CLOSE-GRIP PRESS-UPS' in n or 'DIAMOND PUSH UP' in n:
        return (['triceps'], ['chest', 'shoulders'])
    if 'BENCH PRESS' in n or 'CHEST PRESS' in n:
        return (['chest'], ['shoulders', 'triceps'])
    if 'REVERSE GRIP BENCH PRESS' in n:
        return (['chest'], ['shoulders', 'triceps'])

    # === FLY / PEC / CROSSOVER (chest-isolation flavor) ===
    if 'BUTTERFLY' in n:
        return (['chest'], [])
    if 'CABLE FLY' in n or n.endswith(' FLY') or 'INCLINE DUMBBELL FLY' in n:
        return (['chest'], ['shoulders'])
    if 'FLY WITH DUMBBELLS' in n or 'FLY WITH CABLE' in n:
        return (['chest'], ['shoulders'])
    if 'CROSS-OVER' in n or 'CROSSOVER' in n:
        return (['chest'], ['shoulders'])
    if 'CABLE PRESS AROUND' in n:
        return (['chest'], ['shoulders'])

    # === PUSH-UP variants ===
    if 'PIKE PUSH' in n:
        return (['shoulders'], ['triceps'])
    if 'PUSH-UP' in n or 'PUSH UP' in n or 'PUSHUP' in n or 'PUSHUPS' in n or 'PRESS-UP' in n or 'PRESS-UPS' in n:
        return (['chest'], ['shoulders', 'triceps'])

    # === DIP ===
    if 'DIP' in n:
        return (['chest'], ['triceps'])

    # === PULL-UP / CHIN-UP ===
    if 'PULL-UP' in n or 'PULL-UPS' in n or 'CHIN-UP' in n or 'CHIN-UPS' in n or 'PULLUP' in n:
        return (['back'], ['biceps'])
    if 'INVERTED ROW' in n or 'FRONT PULL' in n:
        return (['back'], ['biceps'])

    # === LAT PULLDOWN ===
    if 'LAT PULL' in n or 'PULLDOWN' in n or 'PULL DOWN' in n:
        if 'STRAIGHT-ARM' in n or 'STRAIGHT ARM' in n:
            return (['back'], [])
        return (['back'], ['biceps'])

    # === FACE PULL ===
    if 'FACEPULL' in n or 'FACE PULL' in n:
        return (['back'], ['shoulders'])

    # === ROWS ===
    if 'KROC ROW' in n or 'PENDELAY' in n or 'BARBELL ROW' in n:
        return (['back'], ['biceps'])
    if ('BENT' in n and 'ROW' in n) or ('INCLINE' in n and 'ROW' in n):
        return (['back'], ['biceps'])
    if 'T-BAR ROW' in n or 'HIGH ROW' in n or 'LOW ROW' in n or 'LONG-PULLEY' in n:
        return (['back'], ['biceps'])
    if 'CABLE ROW' in n or 'SEATED ROW' in n or 'SEATED MACHINE ROW' in n or 'SEATED CABLE' in n:
        return (['back'], ['biceps'])
    if 'SHOTGUN ROW' in n or 'RENEGADE ROW' in n or 'V-GRIP ROW' in n or 'LATERAL ROWS' in n:
        return (['back'], ['biceps'])
    if 'ROWING SEATED' in n:
        return (['back'], ['biceps'])
    if 'ALTERNATING HIGH CABLE ROW' in n:
        return (['back'], ['biceps'])
    if 'LEVERAGE MACHINE ISO ROW' in n:
        return (['back'], ['biceps'])

    # === PULLOVER ===
    if 'PULLOVER' in n:
        return (['back'], ['chest'])

    # === ABS (isolation) ===
    if 'CRUNCH' in n:
        return (['abs'], [])
    if 'SIT-UP' in n or 'SIT UP' in n or 'SIT-UPS' in n:
        return (['abs'], [])
    if 'AB WHEEL' in n or 'AB ROLLOUT' in n or 'ROLLOUT' in n:
        return (['abs'], [])
    if 'LEG RAISE' in n or 'KNEE RAISE' in n:
        return (['abs'], [])
    if 'HANGING LEG' in n:
        return (['abs'], [])
    if 'FLUTTER' in n:
        return (['abs'], [])
    if 'PALLOF' in n or 'WOODCHOPPER' in n or 'WOOD CHOP' in n or 'TRUNK ROTATION' in n or 'ROTARY TORSO' in n:
        return (['abs'], [])
    if 'TRUNK FLEXION' in n or 'SIDE BEND' in n:
        return (['abs'], [])
    if 'SEATED KNEE TUCK' in n:
        return (['abs'], [])

    # === BACK extension / hyper / good morning / superman ===
    if 'HYPEREXTENSION' in n:
        return (['back'], ['glutes', 'hamstrings'])
    if 'BACK EXTENSION' in n:
        return (['back'], ['glutes'])
    if 'GOOD MORNING' in n:
        return (['hamstrings'], ['glutes', 'back'])
    if 'SUPERMAN' in n:
        return (['back'], ['glutes'])
    if 'NECK EXTENSION' in n:
        return (['back'], [])

    return None


def main():
    with open(LIB, encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'export const ALL_EXERCISES = (\[.*?\n\])', src, re.DOTALL)
    data = json.loads(m.group(1))

    splits = {}
    unknowns = []
    for e in data:
        s = split(e['id'])
        if s is None:
            unknowns.append(e)
        else:
            splits[e['id']] = s

    print(f'Classified: {len(splits)} / {len(data)}')
    print(f'Unknown: {len(unknowns)}')
    for e in unknowns:
        print(f'  {e["id"]}')

    # Compute region weights and find ties
    REGION = {
        'chest':'FRONT', 'quads':'FRONT',
        'back':'BACK', 'hamstrings':'BACK',
        'shoulders':'ARMS', 'biceps':'ARMS', 'triceps':'ARMS', 'forearms':'ARMS',
        'abs':'CORE',
        'glutes':'LEGS', 'calves':'LEGS',
    }

    def region_weights(primary, secondary):
        rw = {}
        if primary:
            p_share = 0.6 / len(primary)
            for m in primary:
                rw[REGION[m]] = rw.get(REGION[m], 0) + p_share
        if secondary:
            s_share = 0.4 / len(secondary)
            for m in secondary:
                rw[REGION[m]] = rw.get(REGION[m], 0) + s_share
        elif not primary:
            return {}
        elif primary and not secondary:
            # If no secondary, primary owns 100%
            rw_norm = {}
            p_share = 1.0 / len(primary)
            for m in primary:
                rw_norm[REGION[m]] = rw_norm.get(REGION[m], 0) + p_share
            return rw_norm
        return rw

    print('\n=== TIES UNDER 60/40 SPLIT ===')
    tie_count = 0
    for name, (p, s) in sorted(splits.items()):
        rw = region_weights(p, s)
        sorted_rw = sorted(rw.items(), key=lambda kv: -kv[1])
        # 1st-slot tie
        if len(sorted_rw) >= 2 and sorted_rw[0][1] == sorted_rw[1][1]:
            tied = [r for r,w in sorted_rw if w == sorted_rw[0][1]]
            print(f'  [1st] {name:<55} tied={tied} @ {sorted_rw[0][1]:.3f}')
            tie_count += 1
            continue
        # 2nd-slot tie (compounds)
        if len(sorted_rw) >= 3 and sorted_rw[1][1] == sorted_rw[2][1]:
            tied = [r for r,w in sorted_rw if w == sorted_rw[1][1]]
            print(f'  [2nd] {name:<55} top={sorted_rw[0][0]}, tied 2nd={tied} @ {sorted_rw[1][1]:.3f}')
            tie_count += 1
        # 3rd-slot tie (King)
        if len(sorted_rw) >= 4 and sorted_rw[2][1] == sorted_rw[3][1]:
            tied = [r for r,w in sorted_rw if w == sorted_rw[2][1]]
            print(f'  [3rd] {name:<55} top2=[{sorted_rw[0][0]},{sorted_rw[1][0]}], tied 3rd={tied} @ {sorted_rw[2][1]:.3f}')
            tie_count += 1
    print(f'\nTotal tied exercises: {tie_count}')

    if '--apply' in sys.argv:
        # Write splits as new MUSCLE_FIXUP block
        with open('lib/exerciseAliases.js', encoding='utf-8') as f:
            aliases_src = f.read()

        lines = []
        lines.append('// Hand-curated muscle split for every exercise. Each entry has')
        lines.append('// `primary` (60% of weight, split evenly) and `secondary` (40%')
        lines.append("// of weight, split evenly). Used by R10's wger-weight model")
        lines.append("// to compute per-region weights for star awards.")
        lines.append('//')
        lines.append('// Generated by scripts/build_muscle_split.py.')
        lines.append('export const MUSCLE_FIXUP = {')
        for name in sorted(splits.keys()):
            p, s = splits[name]
            primary_js = json.dumps(p)
            secondary_js = json.dumps(s)
            lines.append(f'  {json.dumps(name)}: {{ primary: {primary_js}, secondary: {secondary_js} }},')
        lines.append('}')
        new_block = '\n'.join(lines)

        # Replace existing MUSCLE_FIXUP block
        pattern = re.compile(r'// Hand-curated muscle lists for every exercise.*?^}\s*\n', re.MULTILINE | re.DOTALL)
        new_src = pattern.sub(new_block + '\n', aliases_src)
        with open('lib/exerciseAliases.js', 'w', encoding='utf-8') as f:
            f.write(new_src)
        print(f'\nWrote {len(splits)} MUSCLE_FIXUP entries (primary/secondary format) to lib/exerciseAliases.js')


if __name__ == '__main__':
    main()
