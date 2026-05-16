// scripts/wgerMap.js
//
// Hand-mapped lookup tables consumed by scripts/import-wger.js.
// wger uses internal IDs for muscles + equipment; GTL uses string keys.
// These maps fold wger's 15 muscle IDs into GTL's 11 muscle keys (with
// a few legitimate drops) and wger's 8 equipment IDs into GTL's 8-value
// equipment enum. Cable / kettlebell / band exercises wger doesn't
// categorize cleanly are handled by the EQUIPMENT_OVERRIDE map in
// lib/exerciseAliases.js.

// wger muscle ID → GTL muscle key (or null to drop the attribution)
// Reference: https://wger.de/api/v2/muscle/
export const WGER_MUSCLE_MAP = {
  1: 'biceps',       // Biceps brachii
  2: 'shoulders',    // Anterior deltoid
  3: null,           // Serratus anterior — no GTL key, drop
  4: 'chest',        // Pectoralis major
  5: 'triceps',      // Triceps brachii
  6: 'abs',          // Rectus abdominis
  7: 'calves',       // Gastrocnemius
  8: 'glutes',       // Gluteus maximus
  9: 'back',         // Trapezius — folds into back
  10: 'quads',       // Quadriceps femoris
  11: 'hamstrings',  // Biceps femoris
  12: 'back',        // Latissimus dorsi — folds into back
  13: 'biceps',      // Brachialis — folds into biceps
  14: 'abs',         // Obliquus externus abdominis — folds into abs
  15: 'calves',      // Soleus — folds into calves
}

// wger equipment ID → GTL equipment enum
// Reference: https://wger.de/api/v2/equipment/
// Anything unmapped or not in this table → 'other'.
export const WGER_EQUIPMENT_MAP = {
  1:  'barbell',     // Barbell
  3:  'dumbbell',    // Dumbbell
  4:  'bodyweight',  // Gym mat (floor work) ≈ bodyweight
  7:  'machine',     // Bench (used standalone)
  8:  'barbell',     // SZ-Bar (EZ curl bar) ≈ barbell variant
  9:  'bodyweight',  // Pull-up bar
  10: 'bodyweight',  // none
  11: 'bodyweight',  // Bodyweight
}

// Canonical exercise per GTL muscle for canonicalExerciseFor().
// Hand-picked stable defaults — these IDs MUST appear in the imported
// data (or normalize to match) or the function falls back to the first
// alphabetical exercise for the muscle.
export const CANONICAL_EXERCISE = {
  chest:      'BENCH PRESS',
  shoulders:  'OVERHEAD PRESS',
  back:       'BARBELL ROW',
  forearms:   'WRIST CURL',
  quads:      'SQUAT',
  hamstrings: 'ROMANIAN DEADLIFT',
  calves:     'STANDING CALF RAISE',
  biceps:     'BARBELL CURL',
  triceps:    'SKULL CRUSHER',
  glutes:     'HIP THRUST',
  abs:        'PLANK',
}
