'use client'
/**
 * ExperienceRow — lifting-experience selector for the PROFILE settings
 * tab. Five plates (days / weeks / months / years / decades) setting the
 * claimed experience tier that seeds the STATUS QUO honesty bands
 * (lib/exp/experience.js).
 *
 * The claim is only a floor: the tier EARNED from real training days
 * takes over as it grows, so the badge shows the effective tier whenever
 * it has outgrown the claim. Changing the claim can therefore never
 * lower an earned tier.
 *
 * Props:
 *   value     — claimed tier id or null (unset → 'years' internally)
 *   effective — effective tier id (max of claimed and earned)
 *   onChange(tier)
 */
import { EXPERIENCE_TIERS } from '../../lib/exp'

export default function ExperienceRow({ value, effective, onChange }) {
  const outgrown = effective && value !== effective && !(value == null && effective === 'years')
  return (
    <div
      className="bg-gtl-surface border border-gtl-edge px-5 py-4"
      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk">
          LIFTING EXPERIENCE
        </span>
        {outgrown && (
          <span
            className="font-mono text-[9px] tracking-[0.25em] uppercase font-bold px-2 py-1 bg-gtl-void text-gtl-red border border-gtl-red"
            style={{ clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' }}
          >
            EARNED: {effective}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {EXPERIENCE_TIERS.map((tier) => {
          const active = value === tier
          return (
            <button
              key={tier}
              type="button"
              onClick={() => onChange(tier)}
              className={`py-2 font-mono text-[10px] tracking-[0.2em] uppercase font-bold transition-colors duration-200 outline-none
                ${active ? 'bg-gtl-red text-gtl-paper' : 'bg-gtl-void text-gtl-ash border border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red'}`}
              style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)' }}
              aria-pressed={active}
              aria-label={`Lifting experience ${tier}`}
            >
              {tier}
            </button>
          )
        })}
      </div>
      <p className="font-mono text-[8px] tracking-[0.25em] uppercase text-gtl-ash mt-3 leading-relaxed">
        SETS EXPECTATIONS FOR PLAUSIBLE PROGRESS · TRAINING DAYS OUTGROW IT
      </p>
    </div>
  )
}
