/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // P5 core palette — red, black, white, with gold as a secondary accent.
        // Naming uses "gtl" (Gritted Teeth Lifestyle) so we don't conflict with
        // tailwind defaults or Kami's earlier "brand-*" tokens, which we keep
        // around so existing pages don't break while we migrate.
        gtl: {
          // Backgrounds
          void:    '#070708', // deepest black, page background
          ink:     '#0e0e10', // primary surface
          surface: '#161618', // raised surface
          edge:    '#26262a', // borders, dividers (subtle)

          // Reds — the primary signature color
          'red-deep':  '#4a0a0e', // shadow / deep accent
          red:         '#d4181f', // primary red, P5 calling-card red
          'red-bright':'#ff2a36', // hot red for highlights, hover, glow
          blood:       '#7a0e14', // muted blood red for backgrounds

          // Off-whites & paper
          paper:       '#f4ede0', // aged paper background for calling cards
          'paper-deep':'#e6dcc6', // shadowed paper
          bone:         '#ece4d2', // warmer paper variant
          ivory:       '#f8f3e6', // brightest paper

          // Foreground white
          white:       '#ffffff', // pure white for text on dark
          chalk:       '#f1eee5', // soft white, primary body text on dark

          // Gold (used sparingly — accents only)
          gold:        '#e4b022', // signature stamp, special highlights
          'gold-deep': '#8a6612',

          // Muted / secondary text
          ash:         '#7d7d83', // muted text
          smoke:       '#4a4a4f', // very muted text
        },

        // Keep Kami's original brand-* tokens around so pages we haven't
        // migrated yet still render. We'll remove these once everything moves.
        brand: {
          dark: '#0a0a0a',
          card: '#141414',
          border: '#2a2a2a',
          accent: '#e63946',
          gold: '#f4a261',
          text: '#f1faee',
          muted: '#8a8a8a',
        }
      },
      fontFamily: {
        // Display face — used for big headlines, button labels, calling-card
        // primary text. Heavy, condensed, all-caps energy.
        display: ['Anton', 'Impact', 'sans-serif'],
        // Athletic display face — secondary headlines and ransom-note mixing.
        // Wider, more athletic feel than Anton.
        athletic: ['"Big Shoulders Display"', 'Anton', 'sans-serif'],
        // Body face — clean geometric grotesque. Used for everything that
        // isn't a display element.
        body: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // Numerals & stat readouts — monospace for that "instrument panel"
        // feel and so numbers don't shift width as they tick.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // Matisse — locally hosted Japanese display serif (Fontworks Inc).
        // Used for English page titles, breadcrumb labels, and decorative
        // background text. NOT for buttons. License caveat in globals.css.
        matisse: ['"FOT-Matisse Pro EB"', '"Noto Serif JP"', 'serif'],
      },
      boxShadow: {
        // Aggressive layered shadows. P5 cards always feel like they're sitting
        // on top of something — never floating. These mimic torn paper drop
        // shadows and pinned-to-corkboard depth.
        'card-pin':  '0 1px 0 rgba(0,0,0,0.4), 0 12px 24px -8px rgba(0,0,0,0.7), 0 4px 10px -4px rgba(0,0,0,0.6)',
        'card-lift': '0 2px 0 rgba(0,0,0,0.5), 0 24px 48px -10px rgba(0,0,0,0.85), 0 8px 16px -6px rgba(0,0,0,0.7)',
        'red-glow':  '0 0 0 1px rgba(255,42,54,0.6), 0 0 24px rgba(255,42,54,0.4), 0 0 56px rgba(255,42,54,0.18)',
        'inset-edge':'inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 0 32px rgba(0,0,0,0.5)',
      },
      keyframes: {
        // The slash wipe — used in heist transitions
        'slash-wipe': {
          '0%':   { transform: 'translateX(-120%) skewX(-18deg)', opacity: '0' },
          '15%':  { opacity: '1' },
          '85%':  { opacity: '1' },
          '100%': { transform: 'translateX(120%) skewX(-18deg)', opacity: '0' },
        },
        // Element snap-in — used as elements assemble after a transition
        'snap-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '60%':  { opacity: '1', transform: 'translateY(-2px) scale(1.005)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Subtle pulse for calling card hover state and active buttons
        'pulse-red': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,42,54,0.5)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(255,42,54,0)' },
        },
        // Stamp impact — for insignias and confirmation marks
        'stamp': {
          '0%':   { transform: 'scale(2.5) rotate(-15deg)', opacity: '0' },
          '60%':  { transform: 'scale(0.95) rotate(-3deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-2deg)', opacity: '1' },
        },
        // Per-character stamp — MEGA version. Each character starts at scale
        // 30+ (visually fills the screen) and crashes down to inline size.
        // The landing happens at ~70% of the animation; that's where the
        // sound + screen shake should be timed to fire.
        'char-stamp': {
          '0%':   { transform: 'scale(38)', opacity: '0', filter: 'blur(20px)' },
          '6%':   { transform: 'scale(34)', opacity: '1', filter: 'blur(16px)' },
          '25%':  { transform: 'scale(18)', opacity: '1', filter: 'blur(8px)' },
          '50%':  { transform: 'scale(6)',  opacity: '1', filter: 'blur(2px)' },
          '70%':  { transform: 'scale(1.5)', opacity: '1', filter: 'blur(0)' },
          '82%':  { transform: 'scale(0.82)', opacity: '1', filter: 'blur(0)' },
          '92%':  { transform: 'scale(1.06)', opacity: '1', filter: 'blur(0)' },
          '100%': { transform: 'scale(1)',  opacity: '1', filter: 'blur(0)' },
        },
        // Screen shake — applied to <main> when a character lands. Short,
        // sharp, multiple-axis jitter.
        'screen-shake': {
          '0%':   { transform: 'translate(0, 0)' },
          '10%':  { transform: 'translate(-8px, 4px)' },
          '20%':  { transform: 'translate(7px, -6px)' },
          '30%':  { transform: 'translate(-6px, -3px)' },
          '40%':  { transform: 'translate(5px, 5px)' },
          '50%':  { transform: 'translate(-4px, 2px)' },
          '60%':  { transform: 'translate(3px, -4px)' },
          '70%':  { transform: 'translate(-2px, 3px)' },
          '85%':  { transform: 'translate(1px, -1px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        // Terminal-style blinking cursor — used in the name input
        'cursor-blink': {
          '0%, 49%':   { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        // Branding animation — letters heat to white-hot, then cool through
        // yellow → orange → red → charred. Used on confirm of the name
        // input. Each letter gets a staggered animation-delay so the brand
        // sweeps left-to-right across the slot.
        'brand-letter': {
          '0%':   { color: '#f1eee5', textShadow: 'none', filter: 'brightness(1)', transform: 'scale(1)' },
          '4%':   { color: '#ffffff', textShadow: '0 0 16px #ffffff, 0 0 32px #ffe066, 0 0 64px #ff8c00', filter: 'brightness(1.8)', transform: 'scale(1.08)' },
          '12%':  { color: '#ffffff', textShadow: '0 0 30px #ffffff, 0 0 60px #ffb84d, 0 0 120px #ff6600, 0 0 200px #ff2a36', filter: 'brightness(2.4)', transform: 'scale(1.12)' },
          '25%':  { color: '#fff2a8', textShadow: '0 0 28px #ffe066, 0 0 56px #ff9500, 0 0 110px #ff4400', filter: 'brightness(2.2)', transform: 'scale(1.08)' },
          '40%':  { color: '#ffd24a', textShadow: '0 0 24px #ffc733, 0 0 48px #ff6600', filter: 'brightness(1.9)', transform: 'scale(1.04)' },
          '55%':  { color: '#ff9a1a', textShadow: '0 0 20px #ff7a00, 0 0 40px #d4181f', filter: 'brightness(1.5)', transform: 'scale(1.02)' },
          '70%':  { color: '#ff3b2a', textShadow: '0 0 14px #d4181f, 0 0 28px #7a0e14', filter: 'brightness(1.2)', transform: 'scale(1.01)' },
          '85%':  { color: '#b8151c', textShadow: '0 0 8px #7a0e14', filter: 'brightness(1.05)', transform: 'scale(1)' },
          '100%': { color: '#7a0e14', textShadow: 'none', filter: 'brightness(1)', transform: 'scale(1)' },
        },
        // Branding glow on the slot bar — parallel to letter branding
        'brand-slot': {
          '0%':   { boxShadow: 'none', background: '#ff2a36' },
          '10%':  { boxShadow: '0 0 30px #ffffff, 0 0 60px #ffe066, 0 0 120px #ff8c00', background: '#ffffff' },
          '25%':  { boxShadow: '0 0 40px #ffd24a, 0 0 80px #ff6600', background: '#ffe066' },
          '50%':  { boxShadow: '0 0 24px #ff9a1a, 0 0 48px #d4181f', background: '#ff8c00' },
          '75%':  { boxShadow: '0 0 12px #d4181f', background: '#d4181f' },
          '100%': { boxShadow: 'none', background: '#7a0e14' },
        },
        // Ignition flash — brief red pulse across the entire screen when
        // the brand fires.
        'ignition-flash': {
          '0%':   { opacity: '0' },
          '8%':   { opacity: '0.6' },
          '22%':  { opacity: '0.35' },
          '50%':  { opacity: '0.15' },
          '100%': { opacity: '0' },
        },
        // Heat ripple — expands from the center of the screen outward,
        // like the heat shockwave from a brand being struck. Used as the
        // first phase of the fire transition.
        'heat-ripple': {
          '0%':   { transform: 'scale(0)', opacity: '0' },
          '10%':  { transform: 'scale(0.4)', opacity: '1' },
          '60%':  { transform: 'scale(6)', opacity: '0.85' },
          '100%': { transform: 'scale(14)', opacity: '0' },
        },
        // Fire flames rising — starts below the viewport, rises up to fill
        // the screen, then STAYS there flickering. Does NOT translate off
        // screen. Used as the main fire transition phase.
        'flame-rise': {
          '0%':   { transform: 'translateY(100%) scaleY(0.4)', opacity: '0' },
          '15%':  { transform: 'translateY(60%) scaleY(0.7)', opacity: '0.6' },
          '40%':  { transform: 'translateY(20%) scaleY(1.0)', opacity: '0.9' },
          '70%':  { transform: 'translateY(0%) scaleY(1.15)', opacity: '1' },
          '100%': { transform: 'translateY(0%) scaleY(1.15)', opacity: '1' },
        },
        // Flame tongue — individual licking flame element. Each tongue uses
        // this with a different delay so the flame wall feels organic.
        'flame-tongue': {
          '0%':   { transform: 'translateY(100%) scaleY(0.3) scaleX(0.9)', opacity: '0' },
          '20%':  { transform: 'translateY(50%) scaleY(0.7) scaleX(1.0)', opacity: '0.7' },
          '50%':  { transform: 'translateY(10%) scaleY(1.1) scaleX(1.05)', opacity: '0.95' },
          '70%':  { transform: 'translateY(-5%) scaleY(1.25) scaleX(0.95)', opacity: '1' },
          '100%': { transform: 'translateY(-5%) scaleY(1.25) scaleX(0.95)', opacity: '1' },
        },
        // Fire fade-out — used on the destination page to fade the fire
        // overlay away as the new page reveals. Inverse of flame-rise.
        'fire-fadeout': {
          '0%':   { opacity: '1' },
          '40%':  { opacity: '0.7' },
          '100%': { opacity: '0' },
        },
        // Ember rise — small bright dots flying upward from the bottom
        // with random horizontal drift and rotation. Used in the fire
        // transition for particle texture.
        'ember-rise': {
          '0%':   { transform: 'translate(0, 0) scale(0)', opacity: '0' },
          '8%':   { transform: 'translate(0, -5vh) scale(1)', opacity: '1' },
          '60%':  { transform: 'translate(var(--drift, 20px), -65vh) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translate(var(--drift, 20px), -110vh) scale(0.2)', opacity: '0' },
        },
        // Shockwave — a ring expanding outward from a point. Used for the
        // initial brand impact in the fire transition.
        'shockwave': {
          '0%':   { transform: 'scale(0)', opacity: '0', borderWidth: '12px' },
          '5%':   { transform: 'scale(0.1)', opacity: '1', borderWidth: '12px' },
          '60%':  { transform: 'scale(8)', opacity: '0.6', borderWidth: '4px' },
          '100%': { transform: 'scale(20)', opacity: '0', borderWidth: '1px' },
        },
        // Fireball bloom — a massive central explosion that grows from
        // a point and fills the screen with bright fire colors.
        'fireball-bloom': {
          '0%':   { transform: 'scale(0)', opacity: '0', filter: 'blur(4px) brightness(2)' },
          '15%':  { transform: 'scale(0.3)', opacity: '1', filter: 'blur(2px) brightness(3)' },
          '60%':  { transform: 'scale(4)', opacity: '0.95', filter: 'blur(8px) brightness(2)' },
          '100%': { transform: 'scale(10)', opacity: '0.85', filter: 'blur(20px) brightness(1.5)' },
        },
        // White flash — full-screen blinding pulse used for impact peaks
        'white-flash': {
          '0%':   { opacity: '0' },
          '20%':  { opacity: '1' },
          '100%': { opacity: '0' },
        },
        // Big kanji slam — a single character that stamps into the center
        // of the screen at the peak of the conflagration.
        'kanji-slam': {
          '0%':   { transform: 'scale(8) rotate(-15deg)', opacity: '0', filter: 'blur(20px)' },
          '30%':  { transform: 'scale(1.3) rotate(-3deg)', opacity: '1', filter: 'blur(0)' },
          '50%':  { transform: 'scale(0.92) rotate(-2deg)', opacity: '1', filter: 'blur(0)' },
          '70%':  { transform: 'scale(1.05) rotate(-2deg)', opacity: '1', filter: 'blur(0)' },
          '100%': { transform: 'scale(1) rotate(-2deg)', opacity: '1', filter: 'blur(0)' },
        },
        // Source-page consume — applied to <main> on the source page when
        // the fire fires. Tints the page orange, zooms slightly, blurs.
        'page-consume': {
          '0%':   { filter: 'none', transform: 'scale(1)' },
          '40%':  { filter: 'sepia(0.4) hue-rotate(-15deg) brightness(1.2) contrast(1.1)', transform: 'scale(1.02)' },
          '100%': { filter: 'sepia(0.9) hue-rotate(-25deg) brightness(1.5) contrast(1.4) blur(2px)', transform: 'scale(1.08)' },
        },
        // Flame flicker — overlays the rising fire with a rapid horizontal
        // jitter to make the flames feel alive.
        'flame-flicker': {
          '0%':   { transform: 'translateX(0) skewX(0deg)', filter: 'hue-rotate(0deg) brightness(1)' },
          '20%':  { transform: 'translateX(-6px) skewX(-2deg)', filter: 'hue-rotate(-8deg) brightness(1.1)' },
          '40%':  { transform: 'translateX(4px) skewX(1deg)', filter: 'hue-rotate(4deg) brightness(1.2)' },
          '60%':  { transform: 'translateX(-3px) skewX(-1deg)', filter: 'hue-rotate(-4deg) brightness(1.05)' },
          '80%':  { transform: 'translateX(5px) skewX(2deg)', filter: 'hue-rotate(6deg) brightness(1.15)' },
          '100%': { transform: 'translateX(0) skewX(0deg)', filter: 'hue-rotate(0deg) brightness(1)' },
        },
        // Full-screen consume — the final phase, where the fire saturates
        // everything before navigation.
        'fire-consume': {
          '0%':   { opacity: '0' },
          '30%':  { opacity: '0.4' },
          '70%':  { opacity: '0.95' },
          '100%': { opacity: '1' },
        },
        // Ash fade — the new page emerges from the fire.
        'ash-reveal': {
          '0%':   { opacity: '1', filter: 'brightness(3) contrast(0.4) sepia(0.8) hue-rotate(-20deg)' },
          '40%':  { opacity: '1', filter: 'brightness(1.5) contrast(0.8) sepia(0.3)' },
          '100%': { opacity: '1', filter: 'brightness(1) contrast(1) sepia(0)' },
        },
        // Flicker — for the kanji watermark and other atmospheric elements
        'flicker': {
          '0%, 100%': { opacity: '0.08' },
          '50%':      { opacity: '0.12' },
        },
        // Checkbox stamp — used when ALL is selected. Crashes a small element
        // in from scale(10) with a hard squash at 72% for clear stamp impact.
        // Smaller starting scale than char-stamp so the shape stays readable.
        // Gate cover — fades the void over the exit slashes for a clean cut
        'gate-cover': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Card launch — calling card explosive zoom-out on activation.
        // Anticipation squash at 38%, then rockets out with brightness flare.
        // Starts at scale(1.04) to match the hover scale so there's no jump.
        'card-launch': {
          '0%':   { transform: 'scale(1.04)',                   opacity: '1', filter: 'brightness(1)' },
          '20%':  { transform: 'scale(1.13) rotate(-1.5deg)',  opacity: '1', filter: 'brightness(1.15)' },
          '38%':  { transform: 'scale(0.95) rotate(0.5deg)',   opacity: '1', filter: 'brightness(1.3)' },
          '57%':  { transform: 'scale(1.24) rotate(-2deg)',    opacity: '1', filter: 'brightness(1.6)' },
          '76%':  { transform: 'scale(3.4) rotate(-4.5deg)',   opacity: '0.45', filter: 'brightness(2.2)' },
          '100%': { transform: 'scale(8) rotate(-7deg)',       opacity: '0', filter: 'brightness(3.5)' },
        },
        // Gate reveal — main content emerges from the void after gate exits.
        // Brightness 3+blur collapses to normal rather than translating position.
        'gate-reveal': {
          '0%':   { opacity: '0', filter: 'brightness(3.5) blur(6px)', transform: 'scale(1.04)' },
          '30%':  { opacity: '1', filter: 'brightness(1.6) blur(0px)',  transform: 'scale(1.01)' },
          '100%': { opacity: '1', filter: 'brightness(1) blur(0px)',    transform: 'scale(1)' },
        },
        // Forge entry — slashes in from the left like a card thrown onto a board.
        // Arrives fast (ease-out), overshoots, settles at a permanent tilt.
        'forge-entry': {
          '0%':   { transform: 'translateX(-130%) rotate(-20deg) skewX(-12deg)', opacity: '0', filter: 'blur(8px)' },
          '55%':  { transform: 'translateX(4%) rotate(-8deg) skewX(2deg)',       opacity: '1', filter: 'blur(0)' },
          '72%':  { transform: 'translateX(-2%) rotate(-11deg) skewX(-1deg)',    opacity: '1', filter: 'blur(0)' },
          '86%':  { transform: 'translateX(1%) rotate(-9.5deg) skewX(0deg)',     opacity: '1', filter: 'blur(0)' },
          '100%': { transform: 'translateX(0) rotate(-10deg) skewX(0deg)',       opacity: '1', filter: 'blur(0)' },
        },
        // Neon flicker — simulates a real neon tube
        'neon-flicker': {
          '0%, 18%, 22%, 26%, 55%, 59%, 100%': { opacity: '1' },
          '20%, 24%, 57%':                      { opacity: '0.6' },
        },
        // Neon wobble — periodic physical shake every 10s
        'neon-wobble': {
          '0%, 88%, 100%': { transform: 'rotate(0deg) translateX(0px)' },
          '89.5%':         { transform: 'rotate(-1.5deg) translateX(-4px)' },
          '91%':           { transform: 'rotate(1.5deg) translateX(5px)' },
          '92.5%':         { transform: 'rotate(-1.2deg) translateX(-3px)' },
          '94%':           { transform: 'rotate(1deg) translateX(3px)' },
          '95.5%':         { transform: 'rotate(-0.6deg) translateX(-2px)' },
          '97%':           { transform: 'rotate(0.3deg) translateX(1px)' },
          '98.5%':         { transform: 'rotate(0deg) translateX(0px)' },
        },
        // Slow clockwise / counter-clockwise spin — for decorative shapes
        'spin-cw':  { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        'spin-ccw': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(-360deg)' } },
        // Forge button slam — drops in from above, bounces to rest
        'forge-slam': {
          '0%':   { opacity: '0', transform: 'translateY(-60px) scale(0.95)' },
          '60%':  { opacity: '1', transform: 'translateY(8px) scale(1.01)' },
          '78%':  { opacity: '1', transform: 'translateY(-4px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Row wobble — applied to the muscle row on stamp impact
        'row-wobble': {
          '0%':   { transform: 'translate(0, 0) rotate(0deg)' },
          '15%':  { transform: 'translate(-6px, 2px) rotate(-1.5deg)' },
          '30%':  { transform: 'translate(5px, -2px) rotate(1.2deg)' },
          '45%':  { transform: 'translate(-4px, 1px) rotate(-0.8deg)' },
          '60%':  { transform: 'translate(3px, -1px) rotate(0.5deg)' },
          '75%':  { transform: 'translate(-2px, 1px) rotate(-0.3deg)' },
          '88%':  { transform: 'translate(1px, 0px) rotate(0.1deg)' },
          '100%': { transform: 'translate(0, 0) rotate(0deg)' },
        },
        'checkbox-stamp': {
          '0%':   { transform: 'scale(10) rotate(-8deg)', opacity: '0', filter: 'blur(8px)' },
          '8%':   { transform: 'scale(9) rotate(-7deg)',  opacity: '1', filter: 'blur(6px)' },
          '40%':  { transform: 'scale(7) rotate(-5deg)',  opacity: '1', filter: 'blur(4px)' },
          '58%':  { transform: 'scale(5) rotate(-3deg)',  opacity: '1', filter: 'blur(2px)' },
          '68%':  { transform: 'scale(2) rotate(-1deg)',  opacity: '1', filter: 'blur(0)' },
          '74%':  { transform: 'scale(0.35) rotate(0deg)', opacity: '1', filter: 'blur(0)' },
          '82%':  { transform: 'scale(1.5) rotate(0deg)', opacity: '1', filter: 'blur(0)' },
          '91%':  { transform: 'scale(0.88) rotate(0deg)', opacity: '1', filter: 'blur(0)' },
          '100%': { transform: 'scale(1) rotate(0deg)',    opacity: '1', filter: 'blur(0)' },
        },
        // Mobile pill ignition — percussive strike: scale snap + X/Y shake.
        // Runs on a wrapper div so the button's own pressed-state translateY is
        // unaffected. Feels like each muscle is being struck individually.
        'pill-ignite': {
          '0%':   { transform: 'scale(1) translate(0, 0)' },
          '8%':   { transform: 'scale(1.22) translate(-4px, -4px)' },
          '18%':  { transform: 'scale(0.84) translate(4px, 3px)' },
          '32%':  { transform: 'scale(1.10) translate(-3px, -2px)' },
          '46%':  { transform: 'scale(0.94) translate(2px, 1px)' },
          '62%':  { transform: 'scale(1.04) translate(-1px, -1px)' },
          '78%':  { transform: 'scale(0.98) translate(1px, 0)' },
          '100%': { transform: 'scale(1) translate(0, 0)' },
        },
        // Body pulse — radial red bloom that fires once all muscles are lit
        'body-pulse': {
          '0%':   { opacity: '0', transform: 'scale(0.7)' },
          '25%':  { opacity: '1', transform: 'scale(1.0)' },
          '65%':  { opacity: '0.6', transform: 'scale(1.1)' },
          '100%': { opacity: '0', transform: 'scale(1.3)' },
        },
      },
      animation: {
        'slash-wipe': 'slash-wipe 700ms cubic-bezier(0.7, 0, 0.2, 1) forwards',
        'snap-in':    'snap-in 400ms cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards',
        'pulse-red':  'pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'stamp':        'stamp 500ms cubic-bezier(0.2, 1.4, 0.4, 1) forwards',
        /* fill-mode 'both': also holds the 0% keyframe (scale 38, opacity 0)
           BEFORE the animation starts, so characters with a non-zero
           animationDelay stay invisible during their wait — without this
           they paint at their default (scale 1, opacity 1) for the duration
           of the delay, so the user sees the full word in the input before
           the stamp cascade even begins. */
        'char-stamp':   'char-stamp 480ms cubic-bezier(0.18, 1.4, 0.4, 1) both',
        'screen-shake': 'screen-shake 280ms cubic-bezier(0.4, 0, 0.6, 1) both',
        'cursor-blink':   'cursor-blink 1s steps(2, end) infinite',
        'brand-letter':   'brand-letter 1600ms cubic-bezier(0.3, 0, 0.4, 1) forwards',
        'brand-slot':     'brand-slot 1600ms cubic-bezier(0.3, 0, 0.4, 1) forwards',
        'ignition-flash': 'ignition-flash 1400ms cubic-bezier(0.2, 0, 0.6, 1) forwards',
        'heat-ripple':    'heat-ripple 1400ms cubic-bezier(0.2, 0.6, 0.2, 1) forwards',
        'flame-rise':     'flame-rise 1100ms cubic-bezier(0.3, 0.5, 0.3, 1) forwards',
        'flame-tongue':   'flame-tongue 1000ms cubic-bezier(0.25, 0.5, 0.3, 1) forwards',
        'fire-fadeout':   'fire-fadeout 800ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'ember-rise':     'ember-rise 1300ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'shockwave':      'shockwave 900ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
        'fireball-bloom': 'fireball-bloom 900ms cubic-bezier(0.25, 0.6, 0.35, 1) forwards',
        'white-flash':    'white-flash 220ms cubic-bezier(0.3, 0, 0.4, 1) forwards',
        'kanji-slam':     'kanji-slam 500ms cubic-bezier(0.2, 1.4, 0.4, 1) forwards',
        'page-consume':   'page-consume 1300ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'flame-flicker':  'flame-flicker 220ms steps(4, end) infinite',
        'fire-consume':   'fire-consume 1800ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'ash-reveal':     'ash-reveal 900ms cubic-bezier(0.3, 0, 0.5, 1) forwards',
        'flicker':        'flicker 4s ease-in-out infinite',
        'checkbox-stamp': 'checkbox-stamp 1000ms cubic-bezier(0.18, 1.4, 0.4, 1) both',
        'row-wobble':     'row-wobble 400ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'pill-ignite':    'pill-ignite 420ms cubic-bezier(0.18, 1.4, 0.4, 1) both',
        'body-pulse':     'body-pulse 700ms cubic-bezier(0.3, 0, 0.5, 1) forwards',
        'card-launch':    'card-launch 560ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'gate-reveal':    'gate-reveal 650ms cubic-bezier(0.3, 0, 0.4, 1) both',
        'forge-entry':    'forge-entry 650ms cubic-bezier(0.15, 0, 0.1, 1) forwards',
        'forge-slam':     'forge-slam 700ms cubic-bezier(0.2, 1.2, 0.4, 1) forwards',
        'neon-flicker':   'neon-flicker 3s linear infinite',
        'neon-wobble':    'neon-wobble 10s ease-in-out infinite',
      },
      // Custom rotation values for tilted layouts
      rotate: {
        '1.5': '1.5deg',
        '2.5': '2.5deg',
        '3.5': '3.5deg',
        '5.5': '5.5deg',
      },
    },
  },
  plugins: [],
}
