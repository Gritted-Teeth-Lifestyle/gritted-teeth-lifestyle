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
