# Dispatch: Gate-Warmup Middleware (Option 1 — Bouncer at the Door)

git fetch && git merge --ff-only origin/dev before starting.

## Why

Hydration mismatch on `/fitness/new` (and a latent class of identical bugs
across the app) only fires because non-gate pages get **SSR'd** with empty
localStorage, then the client re-renders with populated state. The Gate at
`/` is the natural warmup boundary — past it, all navigation should be
client-side, no SSR.

**Fix shape:** make `/` the mandatory entry. Direct deep-links to any
non-gate route get bounced to `/?returnTo=<original>`. The Gate sets a
session cookie, then `router.push()`'s to returnTo. Subsequent navigation
within the session is client-side — no SSR, no mismatch.

This also retires the hydration-mismatch bug on `/fitness/new` without a
per-page patch.

## Storage / cookie contract

- **`gtl-warm`** cookie. Session-scoped (no `max-age`, no `expires`).
  `path=/`, `SameSite=Lax`. Value can be any truthy string, just check
  presence. Cleared on browser close — fresh session re-warms through gate.

## Work units

### 1. Create `middleware.js` at repo root

Next.js 14 conventions. Edge runtime is fine.

```js
import { NextResponse } from 'next/server'

const PASS = NextResponse.next.bind(NextResponse)

export function middleware(req) {
  const { pathname, search } = req.nextUrl

  // The gate itself always passes through.
  if (pathname === '/' || pathname === '') return PASS()

  // Warmed sessions pass through.
  if (req.cookies.get('gtl-warm')) return PASS()

  // Anything else: bounce to the gate with a returnTo param.
  const dest = req.nextUrl.clone()
  dest.pathname = '/'
  dest.search = '' // drop incoming query so we only carry returnTo
  dest.searchParams.set('returnTo', pathname + search)
  return NextResponse.redirect(dest)
}

export const config = {
  // Skip Next internals, API routes, and anything with a file extension
  // (assets: manifest.webmanifest, icon.png, apple-icon.png, /_next/*, etc.).
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
}
```

Verify after adding: `/_next/static/...`, `/manifest.webmanifest`,
`/apple-icon.png`, `/icon.png` all return 200 directly, NOT a redirect.

### 2. Gate (`app/page.js`) — set cookie + read returnTo

Two changes to the gate's React component:

**(a) Set the warm cookie on mount.** Add a `useEffect` that runs once:

```js
useEffect(() => {
  try {
    document.cookie = 'gtl-warm=1; path=/; SameSite=Lax'
  } catch (_) {}
}, [])
```

(Session cookie — no `max-age` or `expires`. Cleared on browser close.)

**(b) Read `returnTo` from searchParams and use it as the post-gate
destination.** Use `useSearchParams()` from `next/navigation`. In the
`activate(kind)` function, AFTER computing the default target
(`/fitness` or `/diet`), check `returnTo` and override iff it's a safe
in-app path:

```js
const isSafeReturnTo = (rt) =>
  typeof rt === 'string' &&
  rt.startsWith('/') &&
  !rt.startsWith('//') &&            // protocol-relative
  !rt.includes('://')                // absolute URL

const searchParams = useSearchParams()
const returnToRaw = searchParams?.get('returnTo')
const returnTo = isSafeReturnTo(returnToRaw) ? returnToRaw : null
```

In `activate(kind)`:
```js
const defaultTarget = kind === 'fitness' ? '/fitness' : '/diet'
const target = returnTo || defaultTarget
setTransitionTarget(target)
targetRef.current = target
```

returnTo wins regardless of fitness/nutrition pick — the user's deep link is
the strongest signal of intent.

### 3. Defense-in-depth: fix the `useState` initializer on `app/fitness/new/page.js`

Even with the middleware in place, the underlying SSR-unsafe pattern is
worth retiring. In `NewCycleNamePage`, the `name` state uses a
`useState(() => { ... localStorage.getItem(...) ... })` initializer at
~line 409. Convert to:

```js
const [name, setName] = useState('')
useEffect(() => {
  try {
    const draftRaw = window.localStorage.getItem(pk('draft-cycle'))
    if (draftRaw) {
      const draft = JSON.parse(draftRaw)
      if (draft && typeof draft.name === 'string' && draft.name.trim().length > 0) {
        setName(draft.name.trim())
        return
      }
    }
    const editingId = window.localStorage.getItem(pk('editing-cycle-id'))
    const savedName = window.localStorage.getItem(pk('cycle-name'))
    if (editingId && savedName && savedName.trim().length > 0) {
      setName(savedName.trim())
      return
    }
    // ... preserve any other branches that were in the original initializer
  } catch (_) {}
}, [])
```

Server now renders `''` always; client populates after hydration. Matches
the contract regardless of whether middleware is active.

## Non-changes (DO NOTs)

- DO NOT add the cookie to other places (no `setCookie` on every page).
- DO NOT make the cookie persistent (no `max-age`). Session-scoped is
  intentional — fresh sessions should always re-warm through gate.
- DO NOT redirect non-GET requests in middleware (the matcher already
  excludes `/api/*` but be aware POST/PUT/DELETE shouldn't loop).
- DO NOT touch `useProfileGuard` or the WHO ARE YOU profile gate — that's
  a separate concern, runs AFTER middleware passes through.
- DO NOT change the manifest, icon, or service worker behavior.
- DO NOT merge to main.

## Verification (mobile 390x844)

1. **Cold session, direct deep-link**: clear cookies; navigate directly to
   `http://localhost:3020/fitness/new`. Browser ends up at
   `/?returnTo=%2Ffitness%2Fnew`. Gate plays. Tap to activate fitness.
   Lands on `/fitness/new` without a hydration warning in the console.
2. **Warm session, direct deep-link**: cookie now set. Navigate directly to
   `/attune`. Loads immediately without bouncing through gate.
3. **Session reset**: close browser, reopen, navigate to `/fitness/active`.
   Bounces through gate again (cookie was cleared).
4. **Assets pass through**: hit `/manifest.webmanifest`,
   `/apple-icon.png`, `/icon.png` — all 200, no redirect.
5. **Gate-honors-returnTo**: land on `/?returnTo=/fitness/new`. Activate
   fitness → land on `/fitness/new`. Then land on `/?returnTo=/attune`.
   Activate fitness → land on `/attune` (returnTo wins).
6. **Hydration warning gone**: with a draft seeded, navigate to
   `/fitness/new` via the gate. Console has NO hydration warnings.
   (Without middleware + with seeded draft, you'd see the
   `Text content did not match` warning every time.)
7. **Playwright test**: run `eval_draft_fixes.py` from the repo root
   (`C:/Users/Jordan/claudesandbox/eval_draft_fixes.py`). Tests must still
   pass — they seed cookies via `context.add_cookies` or navigate through
   the gate to set them.
   - NOTE: if existing playwright tests bypass the gate via direct
     `page.goto()`, they'll now hit the redirect. Either teach them to
     seed `gtl-warm=1` via `context.add_cookies([{name:'gtl-warm', value:'1',
     domain:'localhost', path:'/'}])`, or document this as a test-rig
     change.

## Commit grouping

3 commits:
1. `middleware: gate-warmup bounce for non-gate routes`
2. `Gate: set gtl-warm cookie on mount + honor returnTo searchParam`
3. `NewCycle Name: defer localStorage read to useEffect (SSR-safe)`

## Report format

- 3 commit hashes + files touched
- Verification result per scenario 1-7
- Any blockers as `dispatches/blockers/gtl3_gate_warmup_<topic>.md`
