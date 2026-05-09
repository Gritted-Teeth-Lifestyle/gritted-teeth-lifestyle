'use client'
/**
 * SexToggle — binary M / F pill toggle for the WARRIOR DATA settings
 * section. Two side-by-side buttons; selected one highlighted in gtl-red.
 *
 * Default M per R1a (`'m' | 'f'`).
 */
export default function SexToggle({ label = 'SEX', value = 'm', onChange }) {
  const Btn = ({ id, text }) => {
    const active = value === id
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        className={`flex-1 py-2 font-mono text-[11px] tracking-[0.3em] uppercase font-bold transition-colors duration-200 outline-none
          ${active ? 'bg-gtl-red text-gtl-paper' : 'bg-gtl-void text-gtl-ash border border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red'}`}
        style={{ clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' }}
        aria-pressed={active}
        aria-label={`${label} ${text}`}
      >
        {text}
      </button>
    )
  }

  return (
    <div
      className="bg-gtl-surface border border-gtl-edge px-5 py-4"
      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk">
          {label}
        </span>
      </div>
      <div className="flex gap-2">
        <Btn id="m" text="M" />
        <Btn id="f" text="F" />
      </div>
    </div>
  )
}
