// lib/exerciseAliases.js
//
// Hand-curated overlays consumed by scripts/import-wger.js to enrich the
// generated lib/exerciseLibrary.js. Three independent maps:
//
//   EXERCISE_ALIASES   — exerciseId -> abbreviations the search box should match
//   FOREARMS_OVERLAY   — exercise IDs that should have 'forearms' added to muscles[]
//                        (wger doesn't tag forearms cleanly)
//   EQUIPMENT_OVERRIDE — exerciseId -> equipment enum override (for cable /
//                        kettlebell / band exercises wger doesn't categorize)
//
// Grow these freely — re-running `npm run import:exercises` picks up any edits.

// Strength-relative XP normalization anchor (R1a). REFERENCE_BW is the body-
// weight at which the IPF GL Points coefficient = 1.0 in our normalization.
// A user at REFERENCE_BW sees no XP scaling; lighter users get a boost and
// heavier users a reduction, calibrated to IPF GL Points (the modern
// powerlifting strength-relative formula, which replaced Wilks in 2020).
//
// Normalization: norm_factor = ipfGL(user_BW_kg) / ipfGL(REFERENCE_BW_kg)
// Where ipfGL(bw_kg) = 100 / (a - b * exp(-c * bw_kg))
export const REFERENCE_BW = 180  // lb (≈ 81.65 kg)

export const LB_TO_KG = 0.45359237

// IPF GL Points formula parameters per (sex, equipment, lift) — the formula:
//   ipfGL(bw_kg) = 100 / (a - b * exp(-c * bw_kg))
// Higher GL value = stronger lifter for their bodyweight. We use the ratio
// vs the reference (180 lb / 81.65 kg) as our XP normalization factor.
//
// Defaults below are for male raw total — covers all strength lifts
// reasonably well as a single coefficient. Lift-specific parameters can be
// added later (squat / bench / deadlift have slightly different curves).
// Source: official IPF GL coefficient table (2020).
export const IPF_GL_PARAMS = {
  male:   { a: 1199.72839, b: 1025.18162, c: 0.00921 },
  female: { a:  610.32796, b: 1045.59282, c: 0.03048 },
}

export const EXERCISE_ALIASES = {
  'DEADLIFT':                  ['DL'],
  'ROMANIAN DEADLIFT':         ['RDL'],
  'STIFF-LEG DEADLIFT':        ['SLDL'],
  'OVERHEAD PRESS':            ['OHP', 'STRICT PRESS'],
  'BARBELL ROW':               ['BBR', 'BENT-OVER ROW'],
  'CLOSE-GRIP BENCH PRESS':    ['CGBP'],
  'BENCH PRESS':               ['BP', 'BENCH'],
  'INCLINE BENCH PRESS':       ['INCLINE BP'],
  'INCLINE DUMBBELL PRESS':    ['IDP'],
  'BARBELL CURL':              ['BBC'],
  'DUMBBELL CURL':             ['DBC'],
  'TRICEP PUSHDOWN':           ['PUSHDOWN'],
  'PULL-UP':                   ['PU', 'CHIN-UP'],
  'CHIN-UP':                   ['CU', 'PULL-UP'],
  'LAT PULLDOWN':              ['LPD', 'PULLDOWN'],
  'BULGARIAN SPLIT SQUAT':     ['BSS'],
  'GLUTE-HAM RAISE':           ['GHR'],
  'NORDIC CURL':               ['NORDIC'],
  'STANDING CALF RAISE':       ['SCR'],
  'SEATED CALF RAISE':         ['SCR-SEATED'],
  'HIP THRUST':                ['HT', 'BARBELL HIP THRUST'],
  'HACK SQUAT':                ['HS'],
  'LEG PRESS':                 ['LP'],
  'LEG EXTENSION':             ['LE'],
  'LEG CURL':                  ['LC', 'HAMSTRING CURL'],
  'AB WHEEL ROLLOUT':          ['ABWR', 'AB WHEEL'],
  'HANGING LEG RAISE':         ['HLR'],
  'CABLE CROSSOVER':           ['CC'],
  'CABLE FLY':                 ['CF'],
  'PLANK':                     ['FRONT PLANK'],
  'SIDE PLANK':                ['SP'],
  'LATERAL RAISE':             ['LR', 'SIDE RAISE'],
  'FACE PULL':                 ['FP'],
  'WRIST CURL':                ['WC'],
  'REVERSE WRIST CURL':        ['RWC'],
  'FARMER CARRY':              ['FARMER WALK'],
  'HAMMER CURL':               ['HC'],
}

// Substrings that, when found in an exercise's normalized name, cause
// 'forearms' to be added to that exercise's muscles[] at import time.
// wger doesn't have a clean forearms muscle tag — substring matching catches
// ALL wrist-curl / hammer-curl / farmer-carry variants regardless of the
// specific wger naming (BARBELL WRIST CURL, WRIST CURL CABLE, ALTERNATING
// DUMBBELL HAMMER CURL, etc.).
export const FOREARMS_OVERLAY = [
  'WRIST CURL',
  'REVERSE WRIST CURL',
  'HAMMER CURL',
  'HAMMERCURL',         // catches HAMMERCURLS ON CABLE
  'FARMER CARRY',
  'FARMER WALK',
]

// wger doesn't categorize cable, kettlebell, or band exercises cleanly.
// These overrides force a specific equipment enum value on import for
// the listed IDs. Equipment enum values: 'barbell', 'dumbbell', 'cable',
// 'machine', 'bodyweight', 'kettlebell', 'band', 'other'.
//
// Grow this list as new wger items appear in the imported data.
export const EQUIPMENT_OVERRIDE = {
  'CABLE CROSSOVER':       'cable',
  'CABLE FLY':             'cable',
  'CABLE ROW':             'cable',
  'TRICEP PUSHDOWN':       'cable',
  'FACE PULL':             'cable',
  'LAT PULLDOWN':          'cable',
}

// Regex patterns applied to exercise IDs at import time. Any wger entry whose
// normalized name matches ANY pattern below is dropped from the library
// (does not enter ALL_EXERCISES). The library is curated for hypertrophic
// strength training only — bands, isometrics, cardio, plyometrics, Olympic
// lifts, calisthenic max-strength skills, and conditioning movements are all
// excluded.
//
// Intentionally preserved despite seeming matches:
//   - LEVERAGE MACHINE ISO ROW (ISO = isolateral, not isometric)
//   - HANGING LEG RAISE (HANGING != HANG due to word-boundary rule)
export const EXERCISE_DENYLIST_PATTERNS = [
  // Bands / elastic resistance
  /\b(?:BAND|BANDED|ELASTIC|MONSTER\sWALK)\b/i,

  // Isometric: planks (strict, includes dynamic plank variants), holds,
  // hangs, stretches, wall-sits, L-sits, horse stances
  /\b(?:PLANK|WALL[- ]SIT|HOLLOW\sHOLD|L[- ]SIT|DEAD\s?HANG|ISOMETRIC|HORSE\sSTANCE|STRETCH|HOLD|HANG|BRIDGE\sHOLD)\b/i,

  // Cardio / mobility / movement drills
  /\b(?:JUMPING\sJACKS?|SQUAT\sTHRUST|BEAR\sCRAWL|BEAR\sWALK|CRAB\sWALK|INCHWORM|LATERAL\sPUSH\sOFF|WALL\sDRILL|SNAP\sDOWN|ELEPHANT\sWALK|SIDE\sSLIDES|FOAM\sROLLER|FOAM\sROLLING|DORSIFLEXION|PLANTARFLEXION|ANKLE\sROCKS|LEG\sSWINGS)\b/i,

  // Cardio machines / running / cycling
  /\b(?:RUN|RUNNING|SPRINT|JOG|JOGGING|TREADMILL|ELLIPTICAL|STAIR\sCLIMBER|CYCLE|CYCLING|BIKE|BIKING)\b/i,

  // Plyometrics (power, not hypertrophic). JUMPS? matches both JUMP and JUMPS.
  /\b(?:SKATER|JUMPS?)\b/i,

  // Junk / non-strength residuals that survive other patterns. TRX is a
  // suspension trainer (not in our 5 equipment categories). ISOMETRIA and
  // TRAZIONI are Italian isometric/pull names. MULTI(PRESS) covers wonky
  // multipurpose-rack-named entries. Others are mobility drills and generic
  // body-part labels that don't describe an exercise.
  /\b(?:TRX|BLACK\sWIDOW|BUS\sDRIVERS?|HERCULES\sPILLARS?|LATERAL\sWALK|WALL\sBALLS?|UPPER\sBACK|UPPER\sEXTERNAL|HORIZONTAL\sTRACTION|ISOMETRIA|TRAZIONI|REMADA|PULLBACK|MP|MULTIPRESS|MULTI\sPRESS)\b/i,

  // Partial-ROM oddities: floor presses (FLOOR BENCH PRESS family + DUMBBELL
  // FLOOR PRESS) and pin-press variants (PIN BENCH PRESS, PIN OHP, PIN SQUAT,
  // PIN PRESS). FLOOR SKULL CRUSHER is intentionally not matched — it's a
  // different exercise (lying tricep extension on the floor).
  /\b(?:FLOOR\s(?:DUMBBELL\s)?BENCH\sPRESS|DUMBBELL\sFLOOR\sPRESS|PIN\s(?:BENCH\sPRESS|OHP|SQUAT|PRESS))\b/i,

  // Olympic lifts (power, not hypertrophic)
  /\b(?:CLEAN|SNATCH|JERK|HIGH\sPULL)\b/i,

  // Calisthenic max-strength skills (skill-heavy, not hypertrophic)
  /\b(?:MUSCLE.UP|HANDSTAND|DRAGON.FLAG|FRONT\sLEVER|BACK\sLEVER|HUMAN\sFLAG|PISTOL\sSQUAT|PLANCHE)\b/i,

  // Rotational core + conditioning (Russian twist, med ball, Turkish get-up,
  // KB swing — borderline core/conditioning, not hypertrophic)
  /\b(?:RUSSIAN\sTWIST|MEDICINE\sBALL|MED\sBALL|TURKISH|GET[- ]UP|KETTLEBELL\sSWING)\b/i,

  // wger metadata leaks: HD suffix entries are duplicates of cleaner-named
  // exercises (BENCH DIPS ON FLOOR HD vs BENCH DIPS ON FLOOR, etc.)
  /\bHD\b/i,

  // wger metadata leaks: " - NB" suffix entries are duplicates of cleaner-named
  // exercises (BARBELL BENCH PRESS - NB vs BENCH PRESS, etc.)
  /\s-\s*NB\s*$/i,

  // wger ID-disambiguated duplicates: when two wger entries share a normalized
  // name, the import appends "(wgerId)" to the second. The suffixed copy
  // always points at the same concept as the clean-name version.
  /\(\d{3,5}\)\s*$/,

  // Spanish-but-ASCII duplicates: Spanish-language wger entries that escape
  // the non-ASCII filter and duplicate clean English entries. Note: FLEXION
  // is intentionally excluded — it's also an English medical term (e.g.,
  // "TRUNK FLEXION" is a valid oblique exercise).
  /\b(?:POLEA|JALONES|JALON|REMO|SENTADILLA|MANCUERNA|ESTIRAMIENTO|EXTENSION\sDE|ELEVACION|EMPUJE|PATADA|PIERNAS|PECHO\sNEUTRO|AGARRE\sPRONO|AGARRE\sSUPINO|POLEA\sALTA|POLEA\sBAJA)\b/i,

  // FFLY typo of FLY (CABLE FLY and LOW PULLEY CABLE FLY exist clean)
  /\bFFLY\b/i,

  // Non-ASCII names: broken-encoding Spanish/German wger entries that
  // duplicate clean-English entries already in the library
  /[^\x00-\x7f]/,

  // Kettlebell entries: kettlebell isn't in the 5-equipment library
  // (machine/cable/dumbbell/barbell/bodyweight), so all KB-named exercises
  // are dropped regardless of how wger tagged them.
  /\bKETTLEBELL\b/i,

  // Niche curl techniques most lifters never program: drop-set, cheat-rep,
  // drag-curl, kong-curl, seated-W, bicep-curl-to-press, shoulder-elevated,
  // wide-grip, and German "BIZEPS" naming.
  /\b(?:BIZEPS|TRIFECTA|DROP\sCURL|CHEAT\sCURL|DRAG\sCURLS?|KONG\sCURL|SEATED\sW\sCURL|CURL\sTO\sPRESS|SHOULDER\sELEVATED|WIDE\sBICEP\sCURLS?)\b/i,
]

// Exact-match denylist for entries that don't fit a regex category and need
// removal. Currently scoped to plural duplicates and oddly-named entries that
// have cleaner-named equivalents in the library. Consumed by import-wger.js
// alongside EXERCISE_DENYLIST_PATTERNS.
export const EXERCISE_DENYLIST_EXACT = new Set([
  // Curl dupes / niche
  'HAMMER CURLS',                // plural dup of HAMMER CURL
  'LYING DUMBBELL CURLS',        // odd lying-position dup
  'LYING BICEP CURL',            // dup of spider curl
  'BICEPS CURLS WITH DUMBBELL',  // dup of DUMBBELL CURL
  'STANDING BICEP CURL',         // dup of DUMBBELL CURL
  'CONCENTRATION CURL',          // dup of DUMBBELL CONCENTRATION CURL
  'REVERSE BAR CURL',            // dup of REVERSE CURL
  'REVERSE GRIP BARBELL CURLS',  // dup of REVERSE CURL
  'BICEPS CURL WITH CABLE',      // dup of CABLE CURLS
  'STRAIGHT BAR CABLE CURLS',    // dup of CABLE CURLS
  'LEG CURL',                    // ambiguous; dup of LEG CURLS (LAYING|SITTING|STANDING)

  // Press dupes
  'BENCH PRESS NARROW GRIP',                 // dup of CLOSE-GRIP BENCH PRESS
  'BENCHPRESS DUMBBELLS',                    // dup of DUMBBELL BENCH PRESS
  'INCLINE DUMBBELL BENCH PRESS',            // dup of INCLINE BENCH PRESS - DUMBBELL
  'INCLINE DUMBBELL PRESS',                  // dup
  'INCLINE CHEST PRESS DB',                  // dup
  'DUMBBELL CHEST PRESS',                    // dup of DUMBBELL BENCH PRESS
  'FLAT MACHINE PRESS',                      // dup of MACHINE CHEST PRESS
  'CHEST PRESS',                             // generic dup
  'MACHINE CHEST PRESS EXERCISE',            // dup with redundant suffix
  'LEVERAGE MACHINE CHEST PRESS',            // brand prefix dup; MACHINE CHEST PRESS canonical
  'OVERHEAD BARBELL PRESS',                  // dup of OVERHEAD PRESS
  'SHOULDER PRESS, BARBELL',                 // dup of OVERHEAD PRESS
  'SHOULDER PRESS, DUMBBELLS',               // dup of SHOULDER PRESS (DUMBBELL)
  'LEG PRESS ON HACKENSCHMIDT MACHINE',      // dup of HACK SQUATS
  'SUPINE PRESS',                            // dup of bench press
  'SEATED BENCH PRESS',                      // mis-named; CHEST PRESS already covers
  'SMITH MACHINE SLIGHT INCLINE PRESS',      // dup of HIGH-INCLINE SMITH MACHINE PRESS
  'SHOULDER PRESS, ON MULTI PRESS',          // multipress junk

  // Press niche / cues
  'DB UNDERHAND BENCH PRESS',
  'ELBOWS TUCKED DB BENCH PRESS',
  'NO LEG DRIVE DUMBBELL CHEST PRESS',
  'LARSEN PRESS',
  'DUMBELL TATE PRESS',
  'DUMBBELL BRADFORD PRESS',
  'DUMBBELL FROG PRESS',
  'KREIS PRESS DB',
  'INCLINE SHOULDER PRESS UP',
  'SMITH PRESS',                  // too generic
  'TRAP PRESS',                   // niche, dropped per Jordan call

  // Press combos (compound combo movements, same rule as CURL TO PRESS)
  'LANDMINE SQUAT TO PRESS',
  'GLUTE BRIDGE SINGLE-ARM PRESS',

  // Multipress junk
  'SHRUGS ON MULTIPRESS',
  'SQUATS ON MULTIPRESS',
  'UPRIGHT ROW, ON MULTI PRESS',

  // Niche bodyweight presses
  'DOUBLE-LEG ABDOMINAL PRESS',
  'SINGLE-LEG SIDE GLUTE PRESS',

  // Row dupes
  'BENT OVER DUMBBELL ROWS',                  // dup of DUMBBELL BENT OVER ROW (and mistagged barbell)
  'BENT OVER ROWING',                         // dup of BARBELL ROW (OVERHAND)
  'BENT OVER ROWING REVERSE',                 // dup of BARBELL ROW (UNDERHAND)
  'ROW',                                      // generic; BARBELL ROW (OVERHAND/UNDERHAND) cover
  'SEATED ROW (MACHINE)',                     // dup of SEATED MACHINE ROW
  'SINGLE ARM ROW',                           // generic; KROC ROW / SHOTGUN ROW cover
  'UNILATERAL CABLE ROW',                     // dup of LATERAL ROWS ON CABLE / SHOTGUN ROW
  'UPRIGHT ROW W/ DUMBBELLS',                 // dup of DUMBBELL UPRIGHT-ROW
  'ONE-ARM HEAVY ROW',                        // dup of KROC ROW
  'ROPE PULLOVER/ROW',                        // combo name
  'ROWING, T-BAR',                            // dup of T-BAR ROW (per Jordan call)
  'ROWING, LYING ON BENCH',                   // dup of INCLINE CHEST-SUPPORTED DUMBBELL ROW (per Jordan call)
  'LONG-PULLEY, NARROW',                      // dup of ROWING SEATED, NARROW GRIP
  // Row niche
  'ALTERNATIVE DB GORILLA ROWS',              // niche
  'DUMBBELL UNDERHAND DEAD ROW',              // niche
  'LYING DUMBBELL ROW SS SEATED SHRUG',       // superset combo
  'PERPENDICULAR UNILATERAL LANDMINE ROW',    // niche
  'HELMS ROW',                                // named-after niche (per Jordan call)
  'MEADOWS ROW',                              // named-after niche (per Jordan call)

  // Raise dupes
  'CALF RAISE USING HACK SQUAT MACHINE',      // niche; DOUBLE LEG CALF RAISE covers
  'CALF RAISES ON HACKENSCHMITT MACHINE',     // dup of CALF RAISE USING HACK SQUAT MACHINE
  'CALF RAISES, LEFT LEG',                    // single-leg already covered by CALF RAISES, ONE LEGGED
  'FRONT RAISES WITH PLATES',                 // dup of FRONT PLATE RAISE
  'SCHOULDER RAISE (DUMBBELL)',               // typo of SHOULDER, dup of LATERAL RAISES
  'SHOULDER RAISE SIDE AND FRONT DB',         // combo movement
  'LEG RAISES, LYING',                        // dup of LEG RAISE
  'LEG RAISES PULL UP BAR',                   // dup of HANGING LEG RAISES
  'LYING LEG RAISE',                          // dup of LEG RAISE
  'QUADRIPED ARM AND LEG RAISE',              // niche bird-dog
  'CABLE FRONT RAISE WITH A SMALL BAR',       // dup of STRAIGHT BAR CABLE FRONT RAISE (per Jordan call)

  // Squat dupes / niche
  '1 LEG BOX SQUAT',                          // niche
  'COSSACK SQUAT',                            // niche bodyweight
  'DUMBBELL SIDE SQUAT',                      // niche
  'HINDU SQUATS',                             // niche bodyweight
  'PAUSE HACK SQUATS',                        // technique not movement
  'SQUATS',                                   // generic dup of BARBELL SQUAT
  'WALL SQUAT',                               // isometric (wall sit)
  'BRACED SQUAT',                             // niche (per Jordan call)
  'DRAGON SQUAT',                             // niche (per Jordan call)
  'LOW BOX SQUAT - WIDE STANCE',              // niche (per Jordan call)
  'BARBELL FULL SQUAT',                       // dup of BARBELL SQUAT (per Jordan call)

  // Fly dupes
  'BENT OVER CABLE FLYE',                     // dup of CABLE REAR DELT FLY
  'BUTTERFLY SIT UP',                         // not a fly (ab exercise)
  'BUTTERFLY SUPERMAN',                       // not a fly (superman variant)
  'CABLE FLY MIDDLE CHEST',                   // dup of CABLE FLY
  'DUMBBELL INCLINE FLY',                     // dup of INCLINE DUMBBELL FLY
  'FLY WITH CABLE',                           // dup of CABLE FLY
  'REVERSE CABLE FLYE',                       // dup of CABLE REAR DELT FLY
  'SEATED CABLE CHEST FLY',                   // dup of CABLE FLY
  'MACHINE CHEST FLY',                        // dup of BUTTERFLY (pec deck)

  // Extension dup
  'TRICEPS EXTENSIONS ON CABLE WITH BAR',     // dup of TRICEPS EXTENSIONS ON CABLE

  // Shrug dupes / niche
  'SHOULDER SHRUG',                           // generic dup of SHRUGS, BARBELLS / DUMBBELLS
  'BARBELL SILVERBACK SHRUG',                 // niche (per Jordan call)

  // Pulldown dupes
  'MODIFIED PULLDOWN',                        // generic
  'WIDE-GRIP PULLDOWN',                       // dup of LAT PULLDOWN (WIDE GRIP)

  // Pushdown dupes / niche
  'ROCKING TRICEPS PUSHDOWN',                 // niche
  'TRICEP PUSHDOWN ON CABLE',                 // dup of TRICEPS PUSHDOWN

  // Pullover dup
  'PULLOVER',                                 // generic dup of DUMBBELL PULLOVER

  // Dip
  'RING DIPS',                                // rings not in 5-equipment library

  // Crunch dupes / niche
  '3008 ABDOMINAL CRUNCH',                    // wger ID prefix leak; ABDOMINAL CRUNCH covers
  'CRUNCHES',                                 // dup of ABDOMINAL CRUNCH
  'NEGATIVE CRUNCHES',                        // niche technique
  'WEIGHTED CRUNCH',                          // dup of DUMBBELL CRUNCHES
  'LEVITATION CRUNCH',                        // niche (per Jordan call)

  // Deadlift dupes
  'ROMANIAN DEADLIFT',                        // generic dup of BARBELL ROMANIAN DEADLIFT (RDL) / DUMBBELL ROMANIAN DEADLIFT
  'ROMANIAN DEADLIFT, SINGLE LEG',            // dup of SINGLE-LEG DEADLIFT WITH DUMBBELL

  // Lunge dupes / niche
  'ALTERNATE BACK LUNGES',                    // generic mistagged; DUMBBELL REAR LUNGE / BARBELL STEP BACK LUNGE cover
  'SLIDING LATERAL LUNGE',                    // niche (cossack-style)
  'UNILATERAL LUNGES',                        // generic dup

  // Bridge dupes / non-strength
  'BACK BRIDGE',                              // gymnastics back bridge, not strength
  'HIP BRIDGE',                               // dup of GLUTE BRIDGE
  'WALKING BRIDGE',                           // niche

  // Thrust dupes / niche
  'HIP THRUST',                               // generic dup of BARBELL HIP THRUST
  'SIT UP ELBOW THRUST',                      // niche ab
  'UNILATERAL HIP THRUST',                    // dup of DUMBBELL SINGLE-LEG HIP THRUST

  // Good morning dupes / niche
  'GOOD MORNING',                             // generic dup of GOOD MORNINGS
  'SEATED PANCAKE GOOD MORNING',              // niche
  'STANDING PANCAKE GOOD MORNING',            // niche

  // Junk / mobility / drills / typos
  'ARABESQUE',                                // ballet, not strength
  'DB UCV',                                   // unknown abbreviation
  'FROG STAND',                               // gymnastics balance
  'LEG WHEEL',                                // wger oddity
  'PAUSE BENCH',                              // technique not movement
  'PLATE TWIST',                              // niche rotational
  'PUNCHES',                                  // boxing drill
  'PUSH OHP',                                 // generic / dup of PUSH PRESS
  'REACH UPS',                                // mobility drill
  'ROLL DOWN',                                // pilates mobility
  'SCISSORS',                                 // bodyweight conditioning
  'SNACH',                                    // typo of SNATCH (Olympic anyway)
  'SPHINX',                                   // yoga/mobility
  'TOE TAPS',                                 // drill
  'TOE TOUCH',                                // generic / drill
  'TORSO TWIST',                              // generic rotational
  'VPUSHUP',                                  // typo of V PUSHUP, niche
  'WALL DRILLS',                              // running drill
  'WALL PUSHUP',                              // niche pushup variant
  'WALL SLIDES',                              // mobility drill
  'WALL ANGELS',                              // mobility drill
  'KNEELING SUPERMAN',                        // niche superman variant
  'TOWEL SUPERMAN',                           // niche superman variant
  'PRONE SCAPULAR RETRACTION - ARMS AT SIDE', // mobility
  'SCAPULA PULLS',                            // niche scap activation
  'HIP HINGE',                                // movement-pattern cue, not an exercise
  'BIRD DOG',                                 // mobility / stability, not hypertrophic
  'CLAMSHELL',                                // hip mobility / glute med isolation, niche

  // Rotation dupes
  'DUMBBELL SHOULDER ROTATIONS',              // generic dup
  'SHOULDER EXTERNAL ROTATION (CABLE)',       // dup of CABLE EXTERNAL ROTATION

  // Pec deck dup
  'PEC DECK',                                 // dup of BUTTERFLY

  // Round 5 — residuals from full-library scan
  // Foreign-language / typo dups
  'ARCO FEMORALE UNA GAMBA',                  // Italian (femoral arc one leg)
  'PATADAS TRASERAS',                         // Spanish (back kicks); plural-S escaped PATADA pattern
  'SEATED REAR DELT RISE',                    // typo of RAISE; dup of REAR DELT RAISE
  'MACHINE LATERAL WISE',                     // typo of RAISE; dup of MACHINE SIDE LATERAL RAISES
  // Mobility / stretches / flexibility tests
  'ABDOMINAL DRAW-IN',                        // bracing/breathing exercise
  'ABDOMINAL STABILIZATION',                  // generic mobility
  'SEATED FIGURE FOUR',                       // yoga stretch pose
  'STANDING PANCAKE',                         // pancake forward fold (mobility)
  'SIT & REACH',                              // flexibility test, not strength
  'YOGA EXERCISE: COW-CAT',                   // yoga mobility
  'REVERSE SNOW ANGEL',                       // mobility/scap activation
  'SHOULDER DUMBBELL PENDULAR EXERCISE',      // rotator-cuff pendulum warmup
  'SIDE-LAYING INTERIOR ROTATION',            // mobility/RC; dup-ish of SHOULDER INTERNAL ROTATION
  'ELEPHANT WALKS',                           // hamstring mobility drill (plural-S escaped pattern)
  // Plyometrics (escaped JUMP pattern)
  'CLAP PUSH-UP',                             // plyometric pushup
  'CLAPS OVER THE HEAD',                      // overhead clap drill
  // Niche / made-up / odd
  'COPENHAGEN ADDUCTION EXERCISE',            // isometric copenhagen plank
  'SUPINE HIP ABDUCTION',                     // niche side-lying glute med
  'FULL SIT OUTS',                            // generic conditioning
  'HAMSTRING CHOKES',                         // odd name
  'HAMSTRING KICKS',                          // drill
  'HEEL TOUCHES',                             // bodyweight ab drill
  'HYPER Y W COMBO',                          // niche combo on hyper bench
  'ICE SCREAM MAKER',                         // made-up name
  'HINDU PUSHUPS',                            // yoga-flow pushup
  'KICKSTAND RDL',                            // niche unilateral RDL
  'SEATED CORKSCREW',                         // niche ab machine
  'CORE ROTATION',                            // generic mobility
  'DB UPPER CHEST VARIATION',                 // generic name
  'DUMBBELLS ON SCOTT MACHINE',               // niche preacher dup
  'WINDSHIELD WIPERS',                        // niche rotational (per Jordan call)
  'SIDE TO SIDE PUSH UPS',                    // niche pushup variant
  'SPLINTER SIT-UPS',                         // niche sit-up variant
  'TYPEWRITER PULL-UPS',                      // bodyweight skill move
  'YTWL EXERCISE',                            // dup of W-RAISE / ARM RAISES (T/Y/I)
  // Generic dups / mistagged
  'LAT PULL DB',                              // ambiguous "DB lat pull"
  'LAT PULL DOWN (LEANING BACK)',             // body-position cue dup of LAT PULL DOWN
  'LAT PULL DOWN (STRAIGHT BACK)',            // body-position cue dup of LAT PULL DOWN
  'PULL UPS ON MACHINE',                      // dup of ASSISTED PULL-UP
  'PUSH-UP',                                  // singular dup of PUSH-UPS
  'SIDE BENDS ON MACHINE',                    // dup of DUMBBELL SIDE BEND
  'SINGLE LEG RDL',                           // dup of SINGLE-LEG DEADLIFT WITH DUMBBELL
  'TRICEPS ON MACHINE',                       // generic dup
  'TRICEPS OVERHEAD (DUMBBELL)',              // dup of OVERHEAD TRICEPS EXTENSION
  'UNILATERAL CROSS BODY CABLE PULL DOWN',    // dup of LAT PULLDOWN - CROSS BODY SINGLE ARM
  'WIDE GRIP PULL UP',                        // dup of PULL-UPS (WIDE GRIP)
  'WIDE PULL UP',                             // dup of PULL-UPS (WIDE GRIP)
  'WEIGHTED PUSH-UPS',                        // generic loaded pushup

  // Round-6 dupes
  'LOW PULLEY CABLE FLY',                     // dup of CABLE FLY LOWER CHEST (low-pulley pull-up = lower-chest fly)
  'BICEPS CLOSE GRIP PULL DOWN',              // dup of CLOSE-GRIP LAT PULL DOWN
  'STRAIGHT-ARM PULLDOWN (CABLE)',            // generic; BAR ATTACHMENT / ROPE ATTACHMENT cover specifics

  // Round-7 niche pull-up variants and named-machine
  'AUSTRALIAN PULL-UPS',                      // dup of INVERTED ROWS
  'COMMANDO PULL-UPS',                        // niche side-to-side pull-up
  'ARCHER PULL UP',                           // niche bodyweight skill (one-arm progression)
  'BENT HIGH PULLS',                          // Olympic-adjacent niche
  'LATERAL-TO-FRONT RAISES',                  // combo movement (same rule as CURL TO PRESS)
  'SKULLCRUSHER DUMBBELLS',                   // dup of DB SKULL CRUSHERS
  'LEGEND INCLINE BENCH PRESS',               // brand-specific machine; HIGH-INCLINE SMITH MACHINE / INCLINE SMITH cover

  // Round-8 bodyweight oddities (per Jordan)
  'SUPERMAN',                                 // mobility/scap activation, not hypertrophic
  'GLUTE BRIDGE',                             // beginner; HIP THRUST family covers
  'SINGLE LEG GLUTE BRIDGE',                  // beginner; HIP THRUST family covers
])

// King Compound exercises (R12b) — heavy bilateral lower-body compounds that
// award 1★ each to the top 3 wger-weight regions instead of top 2, AND use
// `king_compound_mult` (1.75) on the Total XP track instead of `compound_mult`
// (1.5). Single-leg variants are NOT King (they cut intensity).
//
// Each King's MUSCLE_FIXUP entry has been deliberately curated to span 3
// distinct regions so the top-3 rule actually awards 3 stars.
export const KING_COMPOUNDS = new Set([
  // Squats (bilateral, heavy)
  'BARBELL SQUAT', 'FRONT SQUATS', 'SUMO SQUATS', 'BOX SQUAT', 'BELT SQUAT',
  'HACK SQUATS', 'TRAP BAR SQUAT', 'SMITH MACHINE SQUAT', 'PENDULUM SQUAT',
  // Deadlifts (bilateral, heavy)
  'DEADLIFTS', 'SUMO DEADLIFT', 'BARBELL ROMANIAN DEADLIFT (RDL)',
  'STIFF-LEGGED DEADLIFTS', 'DEFICIT DEADLIFT', 'RACK DEADLIFT',
  // Leg press (bilateral, heavy)
  'LEG PRESS', 'LEG PRESSES (NARROW)', 'LEG PRESSES (WIDE)',
])

// Curator overrides for R14 compound-vs-isolation auto-classifier. Listed
// exercises are Isolation regardless of region distribution. Catches cases
// where the auto-rule (100%-one-region = isolation) misses single-target
// exercises that happen to spread across two regions.
//
// Examples:
//   - Rear delt fly variants: 60% ARMS / 40% BACK -> auto says compound,
//     but training intent is rear delt isolation.
//   - Hip thrust family: 60% LEGS / 40% BACK -> auto says compound,
//     but it's a glute isolation (R14 example).
export const ISOLATION_OVERRIDE = new Set([
  // Rear delt isolation (60/40 ARMS/BACK split)
  'CABLE REAR DELT FLY', 'REAR DELT RAISE', 'INCLINE BENCH REVERSE FLY',
  'REVERSE FLY STANDING', 'CHEST-SUPPORTED REAR DELT RAISE', 'BUTTERFLY REVERSE',
  'DUMBBELL REAR DELT ROW',
  // Glute isolation (60/40 LEGS/BACK split)
  'BARBELL HIP THRUST', 'DUMBBELL HIP THRUST', 'DUMBBELL SINGLE-LEG HIP THRUST',
  'GLUTE KICKBACK (MACHINE)', 'GLUTE DRIVE', 'CABLE PULL THROUGH',
])

// Heavy-lift bonus thresholds per exercise (R18a). When entered_weight / user_BW
// exceeds the threshold, the cinematic shows a HEAVY LIFT bonus line. Each
// threshold is calibrated to "advanced" 1RM relative-load levels per exercise
// family (advanced bench ~1.5x BW, advanced DL ~2x BW, advanced curl ~0.45x BW,
// etc., per strengthlevel.com / legionathletics.com strength standards).
//
// Generated by scripts/build_heavy_lift_thresholds.py.
// Generated by scripts/build_heavy_lift_thresholds.py
export const HEAVY_LIFT_THRESHOLDS = {
  "1-ARM HALF-KNEELING LAT PULLDOWN": 1.0,
  "AB WHEEL": 0.5,
  "ABDOMINAL CRUNCH": 0.5,
  "ALTERNATING BICEPS CURLS WITH DUMBBELL": 0.45,
  "ALTERNATING DUMBBELL HAMMER CURL": 0.4,
  "ALTERNATING HIGH CABLE ROW": 1.2,
  "ARM RAISES (T/Y/I)": 0.35,
  "ASSISTED PULL-UP": 1.5,
  "BARBELL AB ROLLOUT": 0.5,
  "BARBELL HIP THRUST": 2.0,
  "BARBELL LUNGES STANDING": 0.75,
  "BARBELL ROMANIAN DEADLIFT (RDL)": 1.75,
  "BARBELL ROW (OVERHAND)": 1.2,
  "BARBELL ROW (UNDERHAND)": 1.2,
  "BARBELL SQUAT": 1.75,
  "BARBELL STEP BACK LUNGE": 0.75,
  "BARBELL TRICEPS EXTENSION": 0.5,
  "BARBELL WRIST CURL": 0.3,
  "BAYESIAN CURL": 0.45,
  "BEHIND THE BACK CABLE LATERAL RAISE": 0.4,
  "BELT SQUAT": 2.0,
  "BENCH PRESS": 1.5,
  "BICEPS CURL MACHINE": 0.45,
  "BICEPS CURLS WITH BARBELL": 0.45,
  "BICEPS CURLS WITH SZ-BAR": 0.45,
  "BICYCLE CRUNCHES": 0.5,
  "BODYWEIGHT BICEPS CURL": 0.45,
  "BOX SQUAT": 1.75,
  "BULGARIAN SQUAT WITH DUMBBELLS": 1.0,
  "BUTTERFLY": 0.5,
  "BUTTERFLY NARROW GRIP": 1.2,
  "BUTTERFLY REVERSE": 0.5,
  "CABLE CHEST PRESS - DECLINE": 1.5,
  "CABLE CHEST PRESS - INCLINE": 1.5,
  "CABLE CONCENTRATION CURL": 0.45,
  "CABLE CROSS-OVER": 0.5,
  "CABLE CURLS": 0.45,
  "CABLE EXTERNAL ROTATION": 0.25,
  "CABLE FLY": 0.5,
  "CABLE FLY LOWER CHEST": 0.5,
  "CABLE FLY UPPER CHEST": 0.5,
  "CABLE LATERAL RAISES (SINGLE ARM)": 0.4,
  "CABLE PRESS AROUND": 0.5,
  "CABLE PULL THROUGH": 2.0,
  "CABLE REAR DELT FLY": 0.35,
  "CABLE SHRUG-IN": 1.5,
  "CABLE TRI EXTENSION - EXTERNAL ROTATION": 0.5,
  "CABLE TRI EXTENSION - INTERNAL ROTATION": 0.5,
  "CABLE TRICEP KICKBACK": 0.4,
  "CABLE TRICEPS PRESS": 0.5,
  "CABLE WOODCHOPPERS": 0.5,
  "CALF PRESS USING LEG PRESS MACHINE": 1.5,
  "CALF RAISES, ONE LEGGED": 1.5,
  "CHEST-SUPPORTED REAR DELT RAISE": 0.35,
  "CHIN-UPS": 1.5,
  "CLOSE-GRIP BENCH PRESS": 1.5,
  "CLOSE-GRIP LAT PULL DOWN": 1.0,
  "CLOSE-GRIP PRESS-UPS": 1.0,
  "CROSS-BENCH DUMBBELL PULLOVERS": 0.6,
  "CROSS-BODY CABLE Y-RAISE": 0.35,
  "CRUNCHES ON MACHINE": 0.5,
  "CRUNCHES WITH CABLE": 0.5,
  "CRUNCHES WITH LEGS UP": 0.5,
  "DB CROSS BODY HAMMER CURLS": 0.4,
  "DB SKULL CRUSHERS": 0.5,
  "DEADLIFTS": 2.0,
  "DECLINE BENCH LEG RAISE": 1.0,
  "DECLINE BENCH PRESS BARBELL": 1.5,
  "DECLINE BENCH PRESS DUMBBELL": 1.5,
  "DECLINE PUSHUPS": 1.0,
  "DEFICIT DEADLIFT": 2.0,
  "DEFICIT PUSH UPS": 1.0,
  "DIAMOND PUSH UPS": 1.0,
  "DIPS": 1.5,
  "DIPS BETWEEN TWO BENCHES": 1.5,
  "DOUBLE LEG CALF RAISE": 1.5,
  "DRAG PUSHDOWN": 0.5,
  "DUMBBELL BENCH PRESS": 1.5,
  "DUMBBELL BENT OVER FACE PULL": 0.5,
  "DUMBBELL BENT OVER ROW": 1.2,
  "DUMBBELL CLOSE GRIP BENCH PRESS": 1.5,
  "DUMBBELL CONCENTRATION CURL": 0.45,
  "DUMBBELL CRUNCHES": 0.5,
  "DUMBBELL CURL": 0.45,
  "DUMBBELL FRONT SQUAT": 1.5,
  "DUMBBELL GOBLET SQUAT": 1.0,
  "DUMBBELL HIP THRUST": 2.0,
  "DUMBBELL INCLINE CURL": 0.45,
  "DUMBBELL LUNGES STANDING": 0.75,
  "DUMBBELL LUNGES WALKING": 0.75,
  "DUMBBELL PULLOVER": 0.6,
  "DUMBBELL REAR DELT ROW": 1.2,
  "DUMBBELL REAR LUNGE": 0.75,
  "DUMBBELL ROMANIAN DEADLIFT": 1.0,
  "DUMBBELL SCAPTION": 0.4,
  "DUMBBELL SIDE BEND": 0.5,
  "DUMBBELL SINGLE-LEG HIP THRUST": 2.0,
  "DUMBBELL THRUSTER": 1.0,
  "DUMBBELL TRICEPS EXTENSION": 0.5,
  "DUMBBELL UPRIGHT-ROW": 0.7,
  "FACEPULL": 0.5,
  "FLOOR SKULL CRUSHER": 0.5,
  "FLUTTER KICKS": 0.5,
  "FLY WITH DUMBBELLS": 0.5,
  "FLY WITH DUMBBELLS, DECLINE BENCH": 0.5,
  "FRONT PLATE RAISE": 0.3,
  "FRONT PULL NARROW": 1.2,
  "FRONT PULL WIDE": 1.5,
  "FRONT RAISE (CABLE)": 0.3,
  "FRONT RAISES": 0.3,
  "FRONT SQUATS": 1.5,
  "GLUTE DRIVE": 2.0,
  "GLUTE KICKBACK (MACHINE)": 2.0,
  "GOOD MORNINGS": 0.75,
  "HACK SQUATS": 2.0,
  "HAMMER CURL": 0.4,
  "HAMMERCURLS ON CABLE": 0.4,
  "HAMMERSTRENGTH DECLINE CHEST PRESS": 1.5,
  "HANGING LEG RAISES": 1.0,
  "HIGH ROW": 1.2,
  "HIGH-CABLE LATERAL RAISE": 0.4,
  "HIGH-INCLINE SMITH MACHINE PRESS": 1.25,
  "HYPEREXTENSIONS": 0.5,
  "INCLINE BENCH PRESS - BARBELL": 1.5,
  "INCLINE BENCH PRESS - DUMBBELL": 1.5,
  "INCLINE BENCH REVERSE FLY": 0.35,
  "INCLINE CHEST-SUPPORTED DUMBBELL ROW": 1.2,
  "INCLINE CLOSE GRIP BARBELL BENCH PRESS": 1.5,
  "INCLINE CRUNCHES": 0.5,
  "INCLINE DB Y-RAISE": 0.35,
  "INCLINE DUMBBELL FLY": 0.5,
  "INCLINE DUMBBELL ROW": 1.2,
  "INCLINE OHP DB": 1.25,
  "INCLINE PUSH UP": 1.0,
  "INCLINE SKULL CRUSH": 0.5,
  "INCLINE SMITH PRESS": 1.25,
  "INVERTED LAT PULL DOWN": 1.0,
  "INVERTED ROWS": 1.2,
  "JM PRESS": 0.75,
  "KNEE PUSH-UPS": 1.0,
  "KNEE RAISES": 1.0,
  "KROC ROW": 1.2,
  "LANDMINE PRESS": 1.0,
  "LAT PULL DOWN": 1.0,
  "LAT PULLDOWN (WIDE GRIP)": 1.0,
  "LAT PULLDOWN - CROSS BODY SINGLE ARM": 1.0,
  "LATERAL RAISES": 0.4,
  "LATERAL ROWS ON CABLE, ONE ARMED": 1.2,
  "LEG CURLS (LAYING)": 0.7,
  "LEG CURLS (SITTING)": 0.7,
  "LEG CURLS (STANDING)": 0.7,
  "LEG EXTENSION": 0.7,
  "LEG PRESS": 2.5,
  "LEG PRESS TOE PRESS": 0.4,
  "LEG PRESSES (NARROW)": 2.5,
  "LEG PRESSES (WIDE)": 2.5,
  "LEG RAISE": 1.0,
  "LEG RAISES, STANDING": 1.0,
  "LEVERAGE MACHINE ISO ROW": 1.2,
  "LONG-PULLEY (LOW ROW)": 1.2,
  "LYING TRICEPS EXTENSIONS": 0.5,
  "LYING TRICEPS KICKBACK": 0.4,
  "MACHINE CHEST PRESS": 1.5,
  "MACHINE HIP ABDUCTION": 0.5,
  "MACHINE SIDE LATERAL RAISES": 0.4,
  "NECK EXTENSION": 0.3,
  "NEUTRAL GRIP LAT PULLDOWN": 1.0,
  "NORDIC CURL": 0.7,
  "OMNI CABLE CROSS-OVER": 0.5,
  "ONE ARM OVERHEAD CABLE TRICEP EXTENSION": 0.5,
  "ONE ARMED PUSH-UPS": 1.0,
  "OVERHAND CABLE CURL": 0.45,
  "OVERHEAD CABLE TRICEP EXTENSION": 0.5,
  "OVERHEAD PRESS": 1.0,
  "OVERHEAD TRICEPS EXTENSION": 0.5,
  "PALLOF PRESS": 0.5,
  "PENDELAY ROWS": 1.2,
  "PENDULUM SQUAT": 2.0,
  "PIKE PUSH UPS": 1.0,
  "PREACHER CURL - EXTERNALLY ROTATED": 0.45,
  "PREACHER CURL - INTERNALLY ROTATED": 0.45,
  "PREACHER CURLS": 0.45,
  "PULL-UPS": 1.5,
  "PULL-UPS (NEUTRAL GRIP)": 1.5,
  "PULL-UPS (WIDE GRIP)": 1.5,
  "PULLOVER MACHINE": 0.6,
  "PUSH PRESS": 1.0,
  "PUSH-UPS": 1.0,
  "PUSH-UPS | DECLINE": 1.0,
  "PUSH-UPS | INCLINE": 1.0,
  "PUSH-UPS | PARALLETTES": 1.0,
  "RACK DEADLIFT": 2.0,
  "REAR DELT RAISE": 0.35,
  "RENEGADE ROW": 1.2,
  "REVERSE CRUNCH": 0.5,
  "REVERSE CURL": 0.45,
  "REVERSE EZ BAR CABLE CURLS": 0.45,
  "REVERSE FLY STANDING": 0.35,
  "REVERSE GRIP BENCH PRESS": 1.5,
  "REVERSE HYPEREXTENSION": 0.5,
  "REVERSE NORDIC CURL": 0.7,
  "REVERSE PREACHER CURL (CLOSE GRIP)": 0.45,
  "REVERSE WOOD CHOPS": 0.5,
  "ROTARY TORSO MACHINE": 0.5,
  "ROWING SEATED, NARROW GRIP": 1.2,
  "SEATED CABLE MID TRAP SHRUG": 1.5,
  "SEATED CABLE ROWS": 1.2,
  "SEATED DUMBBELL CALF RAISE": 1.5,
  "SEATED DUMBBELL CURLS": 0.45,
  "SEATED DUMBBELL SIDE LATERAL": 0.4,
  "SEATED HIP ABDUCTION": 0.5,
  "SEATED HIP ADDUCTION": 0.5,
  "SEATED KNEE TUCK": 0.5,
  "SEATED MACHINE ROW": 1.2,
  "SEATED TRICEPS PRESS": 0.5,
  "SEATED V-GRIP ROW": 1.2,
  "SHOTGUN ROW": 1.2,
  "SHOULDER EXTERNAL ROTATION WITH DUMBBELL": 0.25,
  "SHOULDER INTERNAL ROTATION (CABLE)": 0.25,
  "SHOULDER PRESS (DUMBBELL)": 1.0,
  "SHOULDER PRESS, ON MACHINE": 1.0,
  "SHRUGS, BARBELLS": 1.5,
  "SHRUGS, DUMBBELLS": 1.5,
  "SIDE CRUNCH": 0.5,
  "SIDE DUMBBELL TRUNK FLEXION": 0.5,
  "SIDE LATERAL RAISE (CABLE)": 0.4,
  "SIDE LATERAL RAISE - BACK (CABLE)": 0.4,
  "SIDE LATERAL RAISE - FRONT (CABLE)": 0.4,
  "SIDE STRAIGHT-ARM PULLDOWN (CABLE)": 1.0,
  "SINGLE LEG EXTENSION": 0.7,
  "SINGLE-ARM PREACHER CURL": 0.45,
  "SINGLE-LEG DEADLIFT WITH DUMBBELL": 1.0,
  "SIT-UPS": 0.5,
  "SITTING CALF RAISES": 1.5,
  "SKULLCRUSHER SZ-BAR": 0.5,
  "SMITH MACHINE CLOSE-GRIP BENCH PRESS": 1.5,
  "SMITH MACHINE SPLIT SQUAT": 1.0,
  "SMITH MACHINE SQUAT": 1.75,
  "SPIDER CURL": 0.45,
  "STANDING CALF RAISES": 1.5,
  "STANDING SIDE CRUNCHES": 0.5,
  "STIFF-LEGGED DEADLIFTS": 1.75,
  "STRAIGHT BAR CABLE FRONT RAISE": 0.3,
  "STRAIGHT-ARM PULL DOWN (BAR ATTACHMENT)": 1.0,
  "STRAIGHT-ARM PULL DOWN (ROPE ATTACHMENT)": 1.0,
  "SUMO DEADLIFT": 2.0,
  "SUMO SQUATS": 1.75,
  "T-BAR ROW": 1.2,
  "THRUSTER": 1.0,
  "TRAP BAR SQUAT": 2.0,
  "TRAP-3 RAISE": 0.35,
  "TRICEP DUMBBELL KICKBACK": 0.4,
  "TRICEP ROPE PUSHDOWNS": 0.5,
  "TRICEPS DIPS (ASSISTED)": 1.5,
  "TRICEPS EXTENSIONS ON CABLE": 0.5,
  "TRICEPS PUSHDOWN": 0.5,
  "TRUNK ROTATION WITH CABLE": 0.5,
  "UNDERHAND LAT PULL DOWN": 1.0,
  "UPRIGHT ROW, SZ-BAR": 0.7,
  "W-RAISE": 0.35,
  "WALKING LUNGES": 0.75,
  "WRIST CURL, CABLE": 0.3,
  "ZOTTMAN CURL": 0.4,
}

// Class-level scale on heavy-lift bonus magnitude. Isolation gets the biggest
// scale because relatively-heavy isolation lifts are rarer and more notable;
// King Compounds get the smallest because they already get heavier
// king_compound_mult on the Total XP track.
export const HEAVY_LIFT_CLASS_SCALES = {
  'isolation':      1.5,
  'compound':       1.0,
  'king_compound':  0.7,
}

// Class-level fallback thresholds used for any exercise not in
// HEAVY_LIFT_THRESHOLDS (e.g., new wger entries imported later).
export const HEAVY_LIFT_CLASS_DEFAULTS = {
  'isolation':      0.4,
  'compound':       1.5,
  'king_compound':  2.0,
}

// Star-earning floor (R12c). Sets only earn region stars if their relative
// load is at least this fraction of the exercise's heavy_lift_threshold.
// Filters out warm-ups and rep-out endurance work; only genuine working sets
// count toward the region-star track. XP is still awarded for sub-floor sets;
// stars are the only thing gated.
//
// Example: BENCH PRESS heavy_lift_threshold = 1.5× BW.
//   star_floor = 0.75 × 1.5 = 1.125× BW required to earn stars.
//   A 200 lb user benching 225 lb = 1.125× BW exactly → stars earned.
//   A 200 lb user benching 135 lb (warm-up) = 0.675× BW → no stars.
export const STAR_FLOOR_FRACTION = 0.75

// Per-exercise bodyweight coefficient — what fraction of user's bodyweight is
// the prime mover lifting? Used by R1a's bodyweight load formula:
//   effective_load = user_BW × bw_coefficient + entered_weight
// Defaults to 1.00 for any bodyweight exercise not in this map.
export const BW_COEFFICIENT = {
  // Pull-up family — full BW on the bar
  'PULL-UPS': 1.00, 'CHIN-UPS': 1.00,
  'PULL-UPS (NEUTRAL GRIP)': 1.00, 'PULL-UPS (WIDE GRIP)': 1.00,
  // Full dips
  'DIPS': 1.00,
  // Assisted (band/bench) — half load
  'ASSISTED PULL-UP': 0.50,
  'TRICEPS DIPS (ASSISTED)': 0.50,
  'DIPS BETWEEN TWO BENCHES': 0.50,
  // Standard push-ups (~65% BW on hands)
  'PUSH-UPS': 0.65, 'DEFICIT PUSH UPS': 0.65,
  'DIAMOND PUSH UPS': 0.65, 'ONE ARMED PUSH-UPS': 0.65,
  'CLOSE-GRIP PRESS-UPS': 0.65,
  // Decline (feet elevated, more load on hands)
  'DECLINE PUSHUPS': 0.75, 'PUSH-UPS | DECLINE': 0.75,
  // Incline (hands elevated, less load)
  'INCLINE PUSH UP': 0.50, 'PUSH-UPS | INCLINE': 0.50,
  // Pike / parallettes (more vertical, more shoulder load)
  'PUSH-UPS | PARALLETTES': 0.75,
  'PIKE PUSH UPS': 0.75,
  // Knee push-up regression
  'KNEE PUSH-UPS': 0.50,
  // Inverted rows (~55% BW)
  'INVERTED ROWS': 0.55,
  // Bodyweight lunge (most BW above hips)
  'WALKING LUNGES': 0.85,
  // Hamstring/quad eccentric
  'NORDIC CURL': 0.90,
  'REVERSE NORDIC CURL': 0.50,
  // Hanging ab work
  'HANGING LEG RAISES': 0.50,
  'KNEE RAISES': 0.50,
  'LEG RAISE': 0.50,
  // Floor / decline ab work
  'ABDOMINAL CRUNCH': 0.35, 'BICYCLE CRUNCHES': 0.35,
  'CRUNCHES WITH LEGS UP': 0.35, 'DECLINE BENCH LEG RAISE': 0.35,
  'FLUTTER KICKS': 0.35, 'INCLINE CRUNCHES': 0.35,
  'LEG RAISES, STANDING': 0.35, 'REVERSE CRUNCH': 0.35,
  'SIDE CRUNCH': 0.35, 'SIT-UPS': 0.35,
  // TRX/suspension biceps
  'BODYWEIGHT BICEPS CURL': 0.70,
}

// Equipment overrides for entries where the auto-classified or wger-supplied
// equipment value is wrong. Applied AFTER EQUIPMENT_OVERRIDE and the wger
// equipment map but BEFORE the name-based fallback. Use this for known
// mistags that don't fit a regex pattern.
export const EQUIPMENT_FIXUP = {
  'CABLE CURLS':                            'cable',       // wger tagged 'machine'
  'BODYWEIGHT BICEPS CURL':                 'bodyweight',  // wger tagged 'machine'
  'SPIDER CURL':                            'dumbbell',    // wger tagged 'bodyweight' (spider curl is dumbbell on incline bench)
  'INCLINE SMITH PRESS':                    'machine',     // wger tagged 'bodyweight' (Smith machine = machine)
  'MACHINE CHEST PRESS':                    'machine',     // wger tagged 'barbell'
  'CLOSE-GRIP PRESS-UPS':                   'bodyweight',  // wger tagged 'machine' (close-grip pushups)
  'INCLINE CHEST-SUPPORTED DUMBBELL ROW':   'dumbbell',    // wger tagged 'barbell'
  'INVERTED ROWS':                          'bodyweight',  // wger tagged 'machine'
  'SEATED V-GRIP ROW':                      'cable',       // wger tagged 'bodyweight'
  'CHEST-SUPPORTED REAR DELT RAISE':        'dumbbell',    // wger tagged 'barbell'
  'BOX SQUAT':                              'barbell',     // wger tagged 'machine'
  'SMITH MACHINE SPLIT SQUAT':              'machine',     // wger tagged 'barbell'
  'SUMO SQUATS':                            'barbell',     // wger tagged 'machine'
  'REVERSE FLY STANDING':                   'dumbbell',    // wger tagged 'bodyweight'
  'ONE ARM OVERHEAD CABLE TRICEP EXTENSION':'cable',       // wger tagged 'bodyweight'
  'REVERSE HYPEREXTENSION':                 'machine',     // wger tagged 'barbell'
  'DIPS':                                   'bodyweight',  // wger tagged 'machine'
  'DIPS BETWEEN TWO BENCHES':               'bodyweight',  // wger tagged 'barbell'
  'BICYCLE CRUNCHES':                       'bodyweight',  // wger tagged 'machine'
  'REVERSE CRUNCH':                         'bodyweight',  // wger tagged 'machine'
  'SINGLE LEG GLUTE BRIDGE':                'bodyweight',  // wger tagged 'machine'
  'DUMBBELL SINGLE-LEG HIP THRUST':         'dumbbell',    // wger tagged 'barbell'
  'REVERSE WOOD CHOPS':                     'cable',       // wger tagged 'machine'
  // Pushup variants — wger mistags many bodyweight pushups as 'machine' or 'barbell'
  'DECLINE PUSHUPS':                        'bodyweight',
  'DEFICIT PUSH UPS':                       'bodyweight',
  'DIAMOND PUSH UPS':                       'bodyweight',
  'KNEE PUSH-UPS':                          'bodyweight',
  'ONE ARMED PUSH-UPS':                     'bodyweight',
  'PIKE PUSH UPS':                          'bodyweight',
  'PUSH-UPS':                               'bodyweight',
  'PUSH-UPS | DECLINE':                     'bodyweight',
  'PUSH-UPS | INCLINE':                     'bodyweight',
  // Pull-up wide grip wrong-tagged
  'PULL-UPS (WIDE GRIP)':                   'bodyweight',
  // Standing oblique cable crunch wrong-tagged
  'STANDING SIDE CRUNCHES':                 'cable',
}

// Hand-curated muscle split for every exercise. Each entry has
// `primary` (60% of weight, split evenly) and `secondary` (40%
// of weight, split evenly). Used by R10's wger-weight model
// to compute per-region weights for star awards.
//
// Generated by scripts/build_muscle_split.py.
export const MUSCLE_FIXUP = {
  "1-ARM HALF-KNEELING LAT PULLDOWN": { primary: ["back"], secondary: ["biceps"] },
  "AB WHEEL": { primary: ["abs"], secondary: [] },
  "ABDOMINAL CRUNCH": { primary: ["abs"], secondary: [] },
  "ALTERNATING BICEPS CURLS WITH DUMBBELL": { primary: ["biceps"], secondary: [] },
  "ALTERNATING DUMBBELL HAMMER CURL": { primary: ["biceps"], secondary: ["forearms"] },
  "ALTERNATING HIGH CABLE ROW": { primary: ["back"], secondary: ["biceps"] },
  "ARM RAISES (T/Y/I)": { primary: ["shoulders"], secondary: ["back"] },
  "ASSISTED PULL-UP": { primary: ["back"], secondary: ["biceps"] },
  "BARBELL AB ROLLOUT": { primary: ["abs"], secondary: [] },
  "BARBELL HIP THRUST": { primary: ["glutes"], secondary: ["hamstrings"] },
  "BARBELL LUNGES STANDING": { primary: ["quads"], secondary: ["glutes"] },
  "BARBELL ROMANIAN DEADLIFT (RDL)": { primary: ["hamstrings"], secondary: ["glutes", "back", "abs"] },
  "BARBELL ROW (OVERHAND)": { primary: ["back"], secondary: ["biceps"] },
  "BARBELL ROW (UNDERHAND)": { primary: ["back"], secondary: ["biceps"] },
  "BARBELL SQUAT": { primary: ["quads"], secondary: ["glutes", "back"] },
  "BARBELL STEP BACK LUNGE": { primary: ["quads"], secondary: ["glutes"] },
  "BARBELL TRICEPS EXTENSION": { primary: ["triceps"], secondary: [] },
  "BARBELL WRIST CURL": { primary: ["forearms"], secondary: [] },
  "BAYESIAN CURL": { primary: ["biceps"], secondary: [] },
  "BEHIND THE BACK CABLE LATERAL RAISE": { primary: ["shoulders"], secondary: [] },
  "BELT SQUAT": { primary: ["quads"], secondary: ["glutes", "hamstrings"] },
  "BENCH PRESS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "BICEPS CURL MACHINE": { primary: ["biceps"], secondary: [] },
  "BICEPS CURLS WITH BARBELL": { primary: ["biceps"], secondary: [] },
  "BICEPS CURLS WITH SZ-BAR": { primary: ["biceps"], secondary: [] },
  "BICYCLE CRUNCHES": { primary: ["abs"], secondary: [] },
  "BODYWEIGHT BICEPS CURL": { primary: ["biceps"], secondary: [] },
  "BOX SQUAT": { primary: ["quads"], secondary: ["glutes", "back"] },
  "BULGARIAN SQUAT WITH DUMBBELLS": { primary: ["quads"], secondary: ["glutes"] },
  "BUTTERFLY": { primary: ["chest"], secondary: [] },
  "BUTTERFLY NARROW GRIP": { primary: ["chest"], secondary: [] },
  "BUTTERFLY REVERSE": { primary: ["shoulders"], secondary: ["back"] },
  "CABLE CHEST PRESS - DECLINE": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "CABLE CHEST PRESS - INCLINE": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "CABLE CONCENTRATION CURL": { primary: ["biceps"], secondary: [] },
  "CABLE CROSS-OVER": { primary: ["chest"], secondary: ["shoulders"] },
  "CABLE CURLS": { primary: ["biceps"], secondary: [] },
  "CABLE EXTERNAL ROTATION": { primary: ["shoulders"], secondary: [] },
  "CABLE FLY": { primary: ["chest"], secondary: ["shoulders"] },
  "CABLE FLY LOWER CHEST": { primary: ["chest"], secondary: ["shoulders"] },
  "CABLE FLY UPPER CHEST": { primary: ["chest"], secondary: ["shoulders"] },
  "CABLE LATERAL RAISES (SINGLE ARM)": { primary: ["shoulders"], secondary: [] },
  "CABLE PRESS AROUND": { primary: ["chest"], secondary: ["shoulders"] },
  "CABLE PULL THROUGH": { primary: ["glutes"], secondary: ["hamstrings"] },
  "CABLE REAR DELT FLY": { primary: ["shoulders"], secondary: ["back"] },
  "CABLE SHRUG-IN": { primary: ["back"], secondary: [] },
  "CABLE TRI EXTENSION - EXTERNAL ROTATION": { primary: ["triceps"], secondary: [] },
  "CABLE TRI EXTENSION - INTERNAL ROTATION": { primary: ["triceps"], secondary: [] },
  "CABLE TRICEP KICKBACK": { primary: ["triceps"], secondary: [] },
  "CABLE TRICEPS PRESS": { primary: ["triceps"], secondary: [] },
  "CABLE WOODCHOPPERS": { primary: ["abs"], secondary: [] },
  "CALF PRESS USING LEG PRESS MACHINE": { primary: ["calves"], secondary: [] },
  "CALF RAISES, ONE LEGGED": { primary: ["calves"], secondary: [] },
  "CHEST-SUPPORTED REAR DELT RAISE": { primary: ["shoulders"], secondary: ["back"] },
  "CHIN-UPS": { primary: ["back"], secondary: ["biceps"] },
  "CLOSE-GRIP BENCH PRESS": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
  "CLOSE-GRIP LAT PULL DOWN": { primary: ["back"], secondary: ["biceps"] },
  "CLOSE-GRIP PRESS-UPS": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
  "CROSS-BENCH DUMBBELL PULLOVERS": { primary: ["back"], secondary: ["chest"] },
  "CROSS-BODY CABLE Y-RAISE": { primary: ["shoulders"], secondary: ["back"] },
  "CRUNCHES ON MACHINE": { primary: ["abs"], secondary: [] },
  "CRUNCHES WITH CABLE": { primary: ["abs"], secondary: [] },
  "CRUNCHES WITH LEGS UP": { primary: ["abs"], secondary: [] },
  "DB CROSS BODY HAMMER CURLS": { primary: ["biceps"], secondary: ["forearms"] },
  "DB SKULL CRUSHERS": { primary: ["triceps"], secondary: [] },
  "DEADLIFTS": { primary: ["back"], secondary: ["glutes", "hamstrings", "abs"] },
  "DECLINE BENCH LEG RAISE": { primary: ["abs"], secondary: [] },
  "DECLINE BENCH PRESS BARBELL": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "DECLINE BENCH PRESS DUMBBELL": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "DECLINE PUSHUPS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "DEFICIT DEADLIFT": { primary: ["back"], secondary: ["glutes", "hamstrings", "abs"] },
  "DEFICIT PUSH UPS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "DIAMOND PUSH UPS": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
  "DIPS": { primary: ["chest"], secondary: ["triceps"] },
  "DIPS BETWEEN TWO BENCHES": { primary: ["chest"], secondary: ["triceps"] },
  "DOUBLE LEG CALF RAISE": { primary: ["calves"], secondary: [] },
  "DRAG PUSHDOWN": { primary: ["triceps"], secondary: [] },
  "DUMBBELL BENCH PRESS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "DUMBBELL BENT OVER FACE PULL": { primary: ["back"], secondary: ["shoulders"] },
  "DUMBBELL BENT OVER ROW": { primary: ["back"], secondary: ["biceps"] },
  "DUMBBELL CLOSE GRIP BENCH PRESS": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
  "DUMBBELL CONCENTRATION CURL": { primary: ["biceps"], secondary: [] },
  "DUMBBELL CRUNCHES": { primary: ["abs"], secondary: [] },
  "DUMBBELL CURL": { primary: ["biceps"], secondary: [] },
  "DUMBBELL FRONT SQUAT": { primary: ["quads"], secondary: ["glutes"] },
  "DUMBBELL GOBLET SQUAT": { primary: ["quads"], secondary: ["glutes"] },
  "DUMBBELL HIP THRUST": { primary: ["glutes"], secondary: ["hamstrings"] },
  "DUMBBELL INCLINE CURL": { primary: ["biceps"], secondary: [] },
  "DUMBBELL LUNGES STANDING": { primary: ["quads"], secondary: ["glutes"] },
  "DUMBBELL LUNGES WALKING": { primary: ["quads"], secondary: ["glutes"] },
  "DUMBBELL PULLOVER": { primary: ["back"], secondary: ["chest"] },
  "DUMBBELL REAR DELT ROW": { primary: ["shoulders"], secondary: ["back"] },
  "DUMBBELL REAR LUNGE": { primary: ["quads"], secondary: ["glutes"] },
  "DUMBBELL ROMANIAN DEADLIFT": { primary: ["hamstrings"], secondary: ["glutes", "back"] },
  "DUMBBELL SCAPTION": { primary: ["shoulders"], secondary: [] },
  "DUMBBELL SIDE BEND": { primary: ["abs"], secondary: [] },
  "DUMBBELL SINGLE-LEG HIP THRUST": { primary: ["glutes"], secondary: ["hamstrings"] },
  "DUMBBELL THRUSTER": { primary: ["quads", "shoulders"], secondary: ["glutes", "triceps"] },
  "DUMBBELL TRICEPS EXTENSION": { primary: ["triceps"], secondary: [] },
  "DUMBBELL UPRIGHT-ROW": { primary: ["shoulders"], secondary: ["back"] },
  "FACEPULL": { primary: ["back"], secondary: ["shoulders"] },
  "FLOOR SKULL CRUSHER": { primary: ["triceps"], secondary: [] },
  "FLUTTER KICKS": { primary: ["abs"], secondary: [] },
  "FLY WITH DUMBBELLS": { primary: ["chest"], secondary: ["shoulders"] },
  "FLY WITH DUMBBELLS, DECLINE BENCH": { primary: ["chest"], secondary: ["shoulders"] },
  "FRONT PLATE RAISE": { primary: ["shoulders"], secondary: [] },
  "FRONT PULL NARROW": { primary: ["back"], secondary: ["biceps"] },
  "FRONT PULL WIDE": { primary: ["back"], secondary: ["biceps"] },
  "FRONT RAISE (CABLE)": { primary: ["shoulders"], secondary: [] },
  "FRONT RAISES": { primary: ["shoulders"], secondary: [] },
  "FRONT SQUATS": { primary: ["quads"], secondary: ["glutes", "abs"] },
  "GLUTE BRIDGE": { primary: ["glutes"], secondary: ["hamstrings"] },
  "GLUTE DRIVE": { primary: ["glutes"], secondary: ["hamstrings"] },
  "GLUTE KICKBACK (MACHINE)": { primary: ["glutes"], secondary: ["hamstrings"] },
  "GOOD MORNINGS": { primary: ["hamstrings"], secondary: ["glutes", "back"] },
  "HACK SQUATS": { primary: ["quads"], secondary: ["glutes", "hamstrings"] },
  "HAMMER CURL": { primary: ["biceps"], secondary: ["forearms"] },
  "HAMMERCURLS ON CABLE": { primary: ["biceps"], secondary: ["forearms"] },
  "HAMMERSTRENGTH DECLINE CHEST PRESS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "HANGING LEG RAISES": { primary: ["abs"], secondary: [] },
  "HIGH ROW": { primary: ["back"], secondary: ["biceps"] },
  "HIGH-CABLE LATERAL RAISE": { primary: ["shoulders"], secondary: [] },
  "HIGH-INCLINE SMITH MACHINE PRESS": { primary: ["shoulders"], secondary: ["chest", "triceps"] },
  "HYPEREXTENSIONS": { primary: ["back"], secondary: ["glutes", "hamstrings"] },
  "INCLINE BENCH PRESS - BARBELL": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "INCLINE BENCH PRESS - DUMBBELL": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "INCLINE BENCH REVERSE FLY": { primary: ["shoulders"], secondary: ["back"] },
  "INCLINE CHEST-SUPPORTED DUMBBELL ROW": { primary: ["back"], secondary: ["biceps"] },
  "INCLINE CLOSE GRIP BARBELL BENCH PRESS": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
  "INCLINE CRUNCHES": { primary: ["abs"], secondary: [] },
  "INCLINE DB Y-RAISE": { primary: ["shoulders"], secondary: ["back"] },
  "INCLINE DUMBBELL FLY": { primary: ["chest"], secondary: ["shoulders"] },
  "INCLINE DUMBBELL ROW": { primary: ["back"], secondary: ["biceps"] },
  "INCLINE OHP DB": { primary: ["shoulders"], secondary: ["chest", "triceps"] },
  "INCLINE PUSH UP": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "INCLINE SKULL CRUSH": { primary: ["triceps"], secondary: [] },
  "INCLINE SMITH PRESS": { primary: ["shoulders"], secondary: ["chest", "triceps"] },
  "INVERTED LAT PULL DOWN": { primary: ["back"], secondary: ["biceps"] },
  "INVERTED ROWS": { primary: ["back"], secondary: ["biceps"] },
  "JM PRESS": { primary: ["triceps"], secondary: ["chest"] },
  "KNEE PUSH-UPS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "KNEE RAISES": { primary: ["abs"], secondary: [] },
  "KROC ROW": { primary: ["back"], secondary: ["biceps"] },
  "LANDMINE PRESS": { primary: ["shoulders"], secondary: ["triceps", "chest"] },
  "LAT PULL DOWN": { primary: ["back"], secondary: ["biceps"] },
  "LAT PULLDOWN (WIDE GRIP)": { primary: ["back"], secondary: ["biceps"] },
  "LAT PULLDOWN - CROSS BODY SINGLE ARM": { primary: ["back"], secondary: ["biceps"] },
  "LATERAL RAISES": { primary: ["shoulders"], secondary: [] },
  "LATERAL ROWS ON CABLE, ONE ARMED": { primary: ["back"], secondary: ["biceps"] },
  "LEG CURLS (LAYING)": { primary: ["hamstrings"], secondary: [] },
  "LEG CURLS (SITTING)": { primary: ["hamstrings"], secondary: [] },
  "LEG CURLS (STANDING)": { primary: ["hamstrings"], secondary: [] },
  "LEG EXTENSION": { primary: ["quads"], secondary: [] },
  "LEG PRESS": { primary: ["quads"], secondary: ["glutes", "hamstrings"] },
  "LEG PRESS TOE PRESS": { primary: ["calves"], secondary: [] },
  "LEG PRESSES (NARROW)": { primary: ["quads"], secondary: ["glutes", "hamstrings"] },
  "LEG PRESSES (WIDE)": { primary: ["quads"], secondary: ["glutes", "hamstrings"] },
  "LEG RAISE": { primary: ["abs"], secondary: [] },
  "LEG RAISES, STANDING": { primary: ["abs"], secondary: [] },
  "LEVERAGE MACHINE ISO ROW": { primary: ["back"], secondary: ["biceps"] },
  "LONG-PULLEY (LOW ROW)": { primary: ["back"], secondary: ["biceps"] },
  "LYING TRICEPS EXTENSIONS": { primary: ["triceps"], secondary: [] },
  "LYING TRICEPS KICKBACK": { primary: ["triceps"], secondary: [] },
  "MACHINE CHEST PRESS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "MACHINE HIP ABDUCTION": { primary: ["glutes"], secondary: [] },
  "MACHINE SIDE LATERAL RAISES": { primary: ["shoulders"], secondary: [] },
  "NECK EXTENSION": { primary: ["back"], secondary: [] },
  "NEUTRAL GRIP LAT PULLDOWN": { primary: ["back"], secondary: ["biceps"] },
  "NORDIC CURL": { primary: ["hamstrings"], secondary: [] },
  "OMNI CABLE CROSS-OVER": { primary: ["chest"], secondary: ["shoulders"] },
  "ONE ARM OVERHEAD CABLE TRICEP EXTENSION": { primary: ["triceps"], secondary: [] },
  "ONE ARMED PUSH-UPS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "OVERHAND CABLE CURL": { primary: ["biceps"], secondary: ["forearms"] },
  "OVERHEAD CABLE TRICEP EXTENSION": { primary: ["triceps"], secondary: [] },
  "OVERHEAD PRESS": { primary: ["shoulders"], secondary: ["triceps"] },
  "OVERHEAD TRICEPS EXTENSION": { primary: ["triceps"], secondary: [] },
  "PALLOF PRESS": { primary: ["abs"], secondary: [] },
  "PENDELAY ROWS": { primary: ["back"], secondary: ["biceps"] },
  "PENDULUM SQUAT": { primary: ["quads"], secondary: ["glutes", "hamstrings"] },
  "PIKE PUSH UPS": { primary: ["shoulders"], secondary: ["triceps"] },
  "PREACHER CURL - EXTERNALLY ROTATED": { primary: ["biceps"], secondary: [] },
  "PREACHER CURL - INTERNALLY ROTATED": { primary: ["biceps"], secondary: [] },
  "PREACHER CURLS": { primary: ["biceps"], secondary: [] },
  "PULL-UPS": { primary: ["back"], secondary: ["biceps"] },
  "PULL-UPS (NEUTRAL GRIP)": { primary: ["back"], secondary: ["biceps"] },
  "PULL-UPS (WIDE GRIP)": { primary: ["back"], secondary: ["biceps"] },
  "PULLOVER MACHINE": { primary: ["back"], secondary: ["chest"] },
  "PUSH PRESS": { primary: ["shoulders"], secondary: ["triceps", "quads"] },
  "PUSH-UPS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "PUSH-UPS | DECLINE": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "PUSH-UPS | INCLINE": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "PUSH-UPS | PARALLETTES": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "RACK DEADLIFT": { primary: ["back"], secondary: ["glutes", "hamstrings", "abs"] },
  "REAR DELT RAISE": { primary: ["shoulders"], secondary: ["back"] },
  "RENEGADE ROW": { primary: ["back"], secondary: ["biceps"] },
  "REVERSE CRUNCH": { primary: ["abs"], secondary: [] },
  "REVERSE CURL": { primary: ["biceps"], secondary: ["forearms"] },
  "REVERSE EZ BAR CABLE CURLS": { primary: ["biceps"], secondary: ["forearms"] },
  "REVERSE FLY STANDING": { primary: ["shoulders"], secondary: ["back"] },
  "REVERSE GRIP BENCH PRESS": { primary: ["chest"], secondary: ["shoulders", "triceps"] },
  "REVERSE HYPEREXTENSION": { primary: ["back"], secondary: ["glutes", "hamstrings"] },
  "REVERSE NORDIC CURL": { primary: ["quads"], secondary: [] },
  "REVERSE PREACHER CURL (CLOSE GRIP)": { primary: ["biceps"], secondary: ["forearms"] },
  "REVERSE WOOD CHOPS": { primary: ["abs"], secondary: [] },
  "ROTARY TORSO MACHINE": { primary: ["abs"], secondary: [] },
  "ROWING SEATED, NARROW GRIP": { primary: ["back"], secondary: ["biceps"] },
  "SEATED CABLE MID TRAP SHRUG": { primary: ["back"], secondary: [] },
  "SEATED CABLE ROWS": { primary: ["back"], secondary: ["biceps"] },
  "SEATED DUMBBELL CALF RAISE": { primary: ["calves"], secondary: [] },
  "SEATED DUMBBELL CURLS": { primary: ["biceps"], secondary: [] },
  "SEATED DUMBBELL SIDE LATERAL": { primary: ["shoulders"], secondary: [] },
  "SEATED HIP ABDUCTION": { primary: ["glutes"], secondary: [] },
  "SEATED HIP ADDUCTION": { primary: ["quads"], secondary: ["glutes"] },
  "SEATED KNEE TUCK": { primary: ["abs"], secondary: [] },
  "SEATED MACHINE ROW": { primary: ["back"], secondary: ["biceps"] },
  "SEATED TRICEPS PRESS": { primary: ["triceps"], secondary: [] },
  "SEATED V-GRIP ROW": { primary: ["back"], secondary: ["biceps"] },
  "SHOTGUN ROW": { primary: ["back"], secondary: ["biceps"] },
  "SHOULDER EXTERNAL ROTATION WITH DUMBBELL": { primary: ["shoulders"], secondary: [] },
  "SHOULDER INTERNAL ROTATION (CABLE)": { primary: ["shoulders"], secondary: [] },
  "SHOULDER PRESS (DUMBBELL)": { primary: ["shoulders"], secondary: ["triceps"] },
  "SHOULDER PRESS, ON MACHINE": { primary: ["shoulders"], secondary: ["triceps"] },
  "SHRUGS, BARBELLS": { primary: ["back"], secondary: [] },
  "SHRUGS, DUMBBELLS": { primary: ["back"], secondary: [] },
  "SIDE CRUNCH": { primary: ["abs"], secondary: [] },
  "SIDE DUMBBELL TRUNK FLEXION": { primary: ["abs"], secondary: [] },
  "SIDE LATERAL RAISE (CABLE)": { primary: ["shoulders"], secondary: [] },
  "SIDE LATERAL RAISE - BACK (CABLE)": { primary: ["shoulders"], secondary: [] },
  "SIDE LATERAL RAISE - FRONT (CABLE)": { primary: ["shoulders"], secondary: [] },
  "SIDE STRAIGHT-ARM PULLDOWN (CABLE)": { primary: ["back"], secondary: [] },
  "SINGLE LEG EXTENSION": { primary: ["quads"], secondary: [] },
  "SINGLE LEG GLUTE BRIDGE": { primary: ["glutes"], secondary: ["hamstrings"] },
  "SINGLE-ARM PREACHER CURL": { primary: ["biceps"], secondary: [] },
  "SINGLE-LEG DEADLIFT WITH DUMBBELL": { primary: ["hamstrings"], secondary: ["glutes", "back"] },
  "SIT-UPS": { primary: ["abs"], secondary: [] },
  "SITTING CALF RAISES": { primary: ["calves"], secondary: [] },
  "SKULLCRUSHER SZ-BAR": { primary: ["triceps"], secondary: [] },
  "SMITH MACHINE CLOSE-GRIP BENCH PRESS": { primary: ["triceps"], secondary: ["chest", "shoulders"] },
  "SMITH MACHINE SPLIT SQUAT": { primary: ["quads"], secondary: ["glutes"] },
  "SMITH MACHINE SQUAT": { primary: ["quads"], secondary: ["glutes", "back"] },
  "SPIDER CURL": { primary: ["biceps"], secondary: [] },
  "STANDING CALF RAISES": { primary: ["calves"], secondary: [] },
  "STANDING SIDE CRUNCHES": { primary: ["abs"], secondary: [] },
  "STIFF-LEGGED DEADLIFTS": { primary: ["hamstrings"], secondary: ["glutes", "back", "abs"] },
  "STRAIGHT BAR CABLE FRONT RAISE": { primary: ["shoulders"], secondary: [] },
  "STRAIGHT-ARM PULL DOWN (BAR ATTACHMENT)": { primary: ["back"], secondary: [] },
  "STRAIGHT-ARM PULL DOWN (ROPE ATTACHMENT)": { primary: ["back"], secondary: [] },
  "SUMO DEADLIFT": { primary: ["glutes", "hamstrings"], secondary: ["back", "abs"] },
  "SUMO SQUATS": { primary: ["quads"], secondary: ["glutes", "hamstrings"] },
  "SUPERMAN": { primary: ["back"], secondary: ["glutes"] },
  "T-BAR ROW": { primary: ["back"], secondary: ["biceps"] },
  "THRUSTER": { primary: ["quads", "shoulders"], secondary: ["glutes", "triceps"] },
  "TRAP BAR SQUAT": { primary: ["quads"], secondary: ["glutes", "back"] },
  "TRAP-3 RAISE": { primary: ["shoulders"], secondary: ["back"] },
  "TRICEP DUMBBELL KICKBACK": { primary: ["triceps"], secondary: [] },
  "TRICEP ROPE PUSHDOWNS": { primary: ["triceps"], secondary: [] },
  "TRICEPS DIPS (ASSISTED)": { primary: ["triceps"], secondary: [] },
  "TRICEPS EXTENSIONS ON CABLE": { primary: ["triceps"], secondary: [] },
  "TRICEPS PUSHDOWN": { primary: ["triceps"], secondary: [] },
  "TRUNK ROTATION WITH CABLE": { primary: ["abs"], secondary: [] },
  "UNDERHAND LAT PULL DOWN": { primary: ["back"], secondary: ["biceps"] },
  "UPRIGHT ROW, SZ-BAR": { primary: ["shoulders"], secondary: ["back"] },
  "W-RAISE": { primary: ["shoulders"], secondary: ["back"] },
  "WALKING LUNGES": { primary: ["quads"], secondary: ["glutes"] },
  "WRIST CURL, CABLE": { primary: ["forearms"], secondary: [] },
  "ZOTTMAN CURL": { primary: ["biceps"], secondary: ["forearms"] },
}
