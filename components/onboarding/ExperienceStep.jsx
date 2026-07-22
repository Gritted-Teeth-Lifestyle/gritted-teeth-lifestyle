'use client'
/**
 * ExperienceStep — inline onboarding card for first-time profile creation.
 *
 * Mounted by app/fitness/page.js after VitalsStep confirms. Captures
 * the lifting-experience claim (days / weeks / months / years / decades)
 * that seeds the STATUS QUO honesty bands (lib/exp/experience.js). The
 * answer only sets expectations — it can never earn extra EXP — and the
 * earned tier from real training days overtakes it, so there is no wrong
 * answer to game. Skippable — an unset claim resolves to 'years' (the
 * default bands).
 *
 * Tap an option = commit. No separate confirm — the choice is the brand.
 *
 * Props:
 *   onConfirm(tier) — called with the tier id on selection.
 *   onSkip()        — called when the user dismisses without answering.
 */
import { EXPERIENCE_TIERS } from '../../lib/exp'

const TIER_KANJI = { days: '日', weeks: '週', months: '月', years: '年', decades: '代' }

export default function ExperienceStep({ onConfirm, onSkip }) {
  return (
    <div
      className="w-full max-w-sm bg-gtl-surface border border-gtl-edge px-6 py-7"
      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
    >
      <p className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk mb-1">
        HOW LONG HAVE YOU BEEN LIFTING?
      </p>
      <p className="font-mono text-[9px] tracking-[0.25em] uppercase text-gtl-ash mb-5 leading-relaxed">
        SETS EXPECTATIONS, NOT REWARDS. ANSWER TRUE.
      </p>
      <div className="flex flex-col gap-2 mb-5">
        {EXPERIENCE_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => onConfirm?.(tier)}
            className="group flex items-center justify-between gap-4 px-4 py-3 font-mono text-[11px] tracking-[0.3em] uppercase font-bold bg-gtl-void text-gtl-chalk border border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red [@media(hover:hover)]:hover:text-gtl-red active:bg-gtl-red active:text-gtl-paper transition-colors duration-150 outline-none"
            style={{ clipPath: 'polygon(1.5% 0%, 100% 0%, 98.5% 100%, 0% 100%)' }}
          >
            <span>{tier}</span>
            <span
              aria-hidden="true"
              className="font-display text-base leading-none text-gtl-smoke [@media(hover:hover)]:group-hover:text-gtl-red group-active:text-gtl-paper transition-colors duration-150"
              style={{ fontFamily: '"Noto Serif JP", "Yu Mincho", serif' }}
            >
              {TIER_KANJI[tier]}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSkip?.()}
        className="w-full py-3 font-mono text-[11px] tracking-[0.3em] uppercase font-bold bg-gtl-void text-gtl-ash border border-gtl-edge [@media(hover:hover)]:hover:text-gtl-red [@media(hover:hover)]:hover:border-gtl-red transition-colors duration-200 outline-none"
        style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
      >
        SKIP
      </button>
    </div>
  )
}
