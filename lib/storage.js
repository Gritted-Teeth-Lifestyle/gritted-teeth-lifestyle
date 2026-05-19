/**
 * Profile-scoped localStorage helper.
 * All fitness data is keyed under the active profile name so multiple
 * users on the same device have fully isolated cycles, sets, and XP.
 *
 * pk('cycles') → 'gtl-jordan-cycles'  (when profile = 'jordan')
 */
export function pk(key) {
  try {
    const profile = localStorage.getItem('gtl-active-profile') || 'default'
    return `gtl-${profile}-${key}`
  } catch (_) {
    return `gtl-default-${key}`
  }
}

export function getItem(key) {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(pk(key))) } catch { return null }
}

export function setItem(key, value) {
  if (typeof window === 'undefined') return
  localStorage.setItem(pk(key), JSON.stringify(value))
}

// ── Draft cycle helpers ────────────────────────────────────────────────
// The draft is the single WIP cycle being built across FORGE/HONE/CARVE/
// ATTUNE. ETCH (Summary commit) promotes the draft into pk('cycles') and
// clears the draft slot. See dispatches/draft_cycle_model.md.

const DRAFT_KEY     = 'draft-cycle'
const DRAFT_ATT_KEY = 'draft-attunement'

export function getDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(pk(DRAFT_KEY))
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

// Shallow-merge `patch` over the existing draft (or initialize when none).
// Returns the next draft object, or null if persistence fails.
export function setDraft(patch) {
  if (typeof window === 'undefined') return null
  try {
    const cur = getDraft() || {}
    const next = { ...cur, ...(patch || {}) }
    localStorage.setItem(pk(DRAFT_KEY), JSON.stringify(next))
    return next
  } catch (_) { return null }
}

export function clearDraft() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(pk(DRAFT_KEY))
    localStorage.removeItem(pk(DRAFT_ATT_KEY))
  } catch (_) {}
}

export function getDraftAttunement() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(pk(DRAFT_ATT_KEY))
    return raw ? JSON.parse(raw) : {}
  } catch (_) { return {} }
}

export function setDraftAttunement(state) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(pk(DRAFT_ATT_KEY), JSON.stringify(state || {}))
  } catch (_) {}
}

// Promote draft → pk('cycles') and move chips → pk('attunement-{realId}').
// - If editing-cycle-id is set, replace that cycle in place (realId = the
//   existing cycle's id). Otherwise append a new entry (realId = draft.id).
// Clears draft slot, draft-attunement, editing-cycle-id. Sets active-cycle-id.
// Returns the promoted cycle's id, or null if no draft existed.
export function promoteDraft() {
  if (typeof window === 'undefined') return null
  try {
    const draft = getDraft()
    if (!draft) return null
    const editingId = localStorage.getItem(pk('editing-cycle-id'))
    const realId = editingId || draft.id
    const rawCycles = localStorage.getItem(pk('cycles'))
    const cycles = rawCycles ? JSON.parse(rawCycles) : []
    const list = Array.isArray(cycles) ? cycles : []
    const baseFields = {
      name: draft.name,
      targets: Array.isArray(draft.muscles) ? draft.muscles : [],
      days: Array.isArray(draft.days) ? draft.days : [],
      dailyPlan: draft.dailyPlan && typeof draft.dailyPlan === 'object' ? draft.dailyPlan : {},
    }
    let nextCycles
    if (editingId && list.some((c) => c.id === realId)) {
      nextCycles = list.map((c) => c.id === realId ? { ...c, ...baseFields } : c)
    } else {
      nextCycles = [{ id: realId, ...baseFields, createdAt: new Date().toISOString() }, ...list]
    }
    localStorage.setItem(pk('cycles'), JSON.stringify(nextCycles))
    // Move chips: draft-attunement → attunement-{realId}
    const attRaw = localStorage.getItem(pk(DRAFT_ATT_KEY))
    if (attRaw) {
      localStorage.setItem(pk(`attunement-${realId}`), attRaw)
    }
    localStorage.removeItem(pk(DRAFT_ATT_KEY))
    localStorage.removeItem(pk(DRAFT_KEY))
    localStorage.removeItem(pk('editing-cycle-id'))
    localStorage.setItem(pk('active-cycle-id'), realId)
    return realId
  } catch (_) { return null }
}
