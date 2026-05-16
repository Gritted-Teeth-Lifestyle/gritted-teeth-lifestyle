# Blocker: TierTag visuals, RibbonRow icon, R7 flourish, AscendPrompt copy, stats progress bar

**Worker:** gtl3
**Affects:** R20 (TierTag, RibbonRow), R20a (stats progress bar + ribbon history strip), R7 (TierUpFlourish), R9 (AscendPrompt copy). Wave 2 commits 3 and 4 — both depend on resolving these before they can land.

**Question:** Five sub-decisions inside commits 3 + 4 are explicit no-discretion items per the wave-2 dispatch's NO-DISCRETION PROTOCOL block. Surfacing them all in one blocker so they can be answered together.

---

### 1. TierTag — kanji per tier + color per tier + font weight

R20 says the TierTag is "kanji + tier name + R7 color treatment". The brainstorm and plan both leave kanji selection and color scale undefined.

**Tier ladder (locked, R5b/R5c):**
RELAXED, BRUSHED, BARED, BRANDISHED, PRIMED, PRESSED, SQUEEZED, LOCKED, DUG, DRIVEN, CLASPED, CLENCHED, CLAMPED, WRENCHED, CALLOUSED, HARDENED, HALLOWED, GNAWED, GNASHED, BLOODIED, GRITTED.

**a. Kanji per tier** — repo currently uses 名 (identity), 設 (settings), 記 (record) as page kanji watermarks. There's no per-tier mapping. Three options:

1. **One canonical kanji per tier** (21 distinct glyphs Jordan supplies). Most identity weight; biggest discretion ask.
2. **One kanji for the *current* tier name's English meaning** (e.g., RELAXED→緩, BRANDISHED→振, GRITTED→噛). Theme-driven, you supply the 21 mappings.
3. **One single kanji that always renders** (e.g., 牙 "fang" or 歯 "teeth") — color/treatment varies per tier instead.

**b. Color per tier** — repo palette: `gtl-red` (#d4181f), `gtl-red-bright` (#ff2a36), `gtl-paper`, `gtl-chalk`, `gtl-ash`, `gtl-smoke`, gold `#e4b022`, void `#070708`. Three options:

1. **Single color across tiers** — gold `#e4b022` (matches RegionBadge mirror). Cheapest, no discretion needed.
2. **Discrete band scale** — e.g., RELAXED-SQUEEZED gtl-ash, LOCKED-WRENCHED gtl-red, CALLOUSED-BLOODIED gold, GRITTED red+gold gradient. You define the bands.
3. **Continuous gradient** — interpolate from gtl-ash → gold → red across the 21 tiers via `getTierIndex(count) / 20`.

**c. Font weight + treatment** — RegionBadge mirrors give us italic Anton on gold parallelogram. TierTag could use the same. Confirm or override.

---

### 2. RibbonRow — Galaxy-Spiral icon glyph + size

R9 grants "Galaxy-Spiral ribbons" — Tengen Toppa cyclone vibe. Repo has no spiral glyph. Three options:

1. **Unicode 🌀 ("cyclone")** — emoji, system-rendered. Simple. Won't match the brand serif/matisse vocabulary perfectly.
2. **Inline SVG spiral** — hand-drawn 24×24 SVG path, gold stroke, mirrors GateScreen's tooth-sparkle ✦ aesthetic. More work, more brand-consistent.
3. **Stacked ★ + ✦ glyphs** — reuse existing tooth-sparkle/star vocabulary. Cheapest. Not literally a spiral.

Plus: row layout — earned ribbons fill left-to-right; unearned slots hidden until first ribbon (per R20). Confirm "hidden until first ribbon" means the entire row hides until count ≥ 1, not just that empty slots within the row are blanked.

---

### 3. R7 TierUpFlourish — kanji + color + animation choreography

R7 says "P5/Gurren rank-up flourish (kanji, color, animation) when the user enters a new named tier." Plan says "Animation choreography mirrors the existing level-up sub-cascade at active/page.js:3486-3640 as a sibling component" — that part is verbatim mirror.

**a. Kanji selection per tier-up** — same question as TierTag's kanji. If same kanji set as TierTag, decision propagates. If different (e.g., showing the tier you're ENTERING), specify.

**b. Color per crossing** — same question as TierTag colors. Could match.

**c. Choreography mirror specifics** — the existing `lvlup-cone-in / lvlup-stream / lvlup-flood-in / lvlup-sparkle-in / lvlup-label / lvlup-num` cascade is the gold-firehose "you reached level N" treatment. The dispatch says "envelope ~1.9s". Confirm: same firehose-from-the-XP-bar geometry, just label changes from "LEVEL UP / N" to "{TIER_NAME} / {kanji}"? Or distinct geometry (e.g., kanji slamming in from above)?

---

### 4. R9 AscendPrompt — modal copy

Two CTAs are explicit (`ASCEND` / `HOLD`). Mount/unmount timings are explicit (250ms in / 200ms out). What's open:

- **Headline** — single line at the top of the modal. Examples in repo: "WHO ARE YOU", "PRESS START", "ATTUNE — FIRST ATTUNEMENT". Need GTL-voice equivalent for the GRITTED + 20 hold prestige unlock.
- **Body line** — short explanation of what ASCEND does (resets counter to RELAXED, awards a Galaxy-Spiral ribbon, +0.10× permanent prestige multiplier). Needed because user may not understand the cost without it.
- **Mount surfaces** — dispatch says "profile page (primary surface) and on hub (secondary, less aggressive)". What does "less aggressive" mean structurally? A smaller chip linking to profile vs. a full-screen modal? A non-blocking banner?

---

### 5. R20a stats progress bar — shape, fill direction, label position

Spec items: "tier progress bar, X/Y SESSIONS TO {NEXT_TIER} text, cumulative 100%-session count, ribbon history strip". Open visuals:

**a. Progress bar shape** — Three options:

1. **Horizontal flat bar** matching the existing XP bar at active page (`xp-bar-pulse / xp-bar-wobble`). Familiar.
2. **Vertical bar** as a sidebar accent next to the BodyStarChart.
3. **Custom** (e.g., notched/segmented bar with one notch per pacing-curve session).

**b. Fill direction** — left-to-right, bottom-to-top, or fills from center outward.

**c. Label position** — `X/Y SESSIONS TO {NEXT_TIER}` above the bar, below, or to the right. Number style — Anton + gold (matches XP bar) or mono red (matches existing labels)?

**d. Ribbon history strip** — same RibbonRow component as R20 (just larger), or a different layout (e.g., dated list "RIBBON 01 — 2026-05-12, RIBBON 02 — 2026-08-03")?

---

**Candidate answers (consolidated minimal-viable):**

1. **Single-color, single-kanji defaults across all five sub-decisions.** TierTag: gold parallelogram mirror of RegionBadge, single kanji 牙 ("fang") fixed across all tiers, tier name in italic Anton. RibbonRow: 🌀 emoji unicode glyph, gold tint via filter or just system-default, row hides at count 0. R7 flourish: same kanji 牙, gold-firehose mirror of level-up cascade with label "{TIER_NAME}". AscendPrompt: minimal copy ("PRESTIGE READY" headline, "Reset to RELAXED. Earn one ribbon. +0.10× forever." body), profile = blocking modal, hub = small chip. Stats progress: horizontal flat bar mirroring active-page XP bar, fills L→R, label below in mono red. Ribbon history = RibbonRow at larger size.

2. **King supplies all five answers verbatim** with the kanji list, color scale, and copy.

3. **Hybrid** — verbatim mirror of existing repo vocabulary for visuals (option 1's defaults for parallelogram, glyph, bar shape), King supplies copy for AscendPrompt + tier-up label only.

**Recommendation:** Option 2 for items 1 (kanji + color), 3 (R7 flourish kanji/color, since they propagate from item 1), and 4 (AscendPrompt copy). Option 1 for items 2 (RibbonRow icon — emoji works as a placeholder Jordan can swap to inline SVG later) and 5 (stats progress bar — horizontal flat bar is the obvious mirror; "ribbon history = RibbonRow at larger size" is the obvious dedup).

**What's blocked:** Wave 2 commits 3 + 4. Commits 1 (R17 + R19) and 2 (R18 cinematic) already landed independently — they don't hit any of these discretion items. Commit 3 needs answers to items 1, 2, 5 to ship TierTag + RibbonRow + profile route + stats extension. Commit 4 needs answers to items 1, 3, 4 to ship TierUpFlourish + AscendPrompt.

## Resolution

Jordan (2026-05-09): "yes minimal" → ship minimal-viable defaults that mirror existing repo vocabulary verbatim. Iterate on polish later in separate commits. None of items 1-5 are prerequisites for other features.

**Item 1 (TierTag):** mirror RegionBadge — gold parallelogram (#e4b022, clipPath polygon) with italic Anton tier name; mono red multiplier label below (`×1.18`) matching the RegionBadge tier label treatment. No per-tier kanji or color.

**Item 2 (RibbonRow):** 🌀 emoji per earned ribbon, gold tint via filter. Entire row hidden at count 0.

**Item 3 (R7 TierUpFlourish):** mirror the existing level-up sub-cascade at `app/fitness/active/page.js:3486-3640` verbatim, swapping the "LEVEL N" label for `{TIER_NAME}`. No per-tier kanji or color treatment.

**Item 4 (AscendPrompt copy):** headline `PRESTIGE READY`, body `Reset to RELAXED. Earn one ribbon. +0.10× forever.`, buttons `ASCEND` / `HOLD`. Profile = blocking modal; hub = small chip linking to profile.

**Item 5 (Stats progress bar):** horizontal flat bar mirroring the active-page XP bar, fills L→R. Label `X / Y SESSIONS TO {NEXT_TIER}` below the bar in mono red. Ribbon history strip = same RibbonRow component at larger size.

Resume Wave 2 commits 3 + 4.
