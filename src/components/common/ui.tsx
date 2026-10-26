import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

export const fmt = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
export const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card card-pad ${className}`}>{children}</section>;
}

export function SectionTitle({ icon, title, subtitle, right }: { icon?: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon && <div className="mt-0.5 text-nme">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help align-middle">
      <Info size={13} className="text-slate-500 transition group-hover:text-nme" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 max-w-[80vw] -translate-x-1/2 rounded-lg border border-white/10 bg-void-800 p-2.5 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-slate-300 shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = 'default',
  hint,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'default' | 'atwater' | 'nme' | 'fuel' | 'plastic' | 'loss';
  hint?: string;
  sub?: ReactNode;
}) {
  const color = {
    default: 'text-slate-100',
    atwater: 'text-atwater',
    nme: 'text-nme',
    fuel: 'text-fuel',
    plastic: 'text-plastic',
    loss: 'text-loss',
  }[tone];
  return (
    <div className="min-w-0">
      <div className="label-xs flex items-center gap-1">
        {label}
        {hint && <InfoTip text={hint} />}
      </div>
      <div className={`num mt-1 text-xl font-semibold ${color}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Meter({ value, max = 1, color = '#22d3ee', height = 6 }: { value: number; max?: number; color?: string; height?: number }) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full overflow-hidden rounded-full bg-void-700" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

export function Badge({ children, color = '#94a3b8' }: { children: ReactNode; color?: string }) {
  return (
    <span className="chip" style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
      {children}
    </span>
  );
}

export const NOVA_COLORS = { 1: '#4ade80', 2: '#a3e635', 3: '#fbbf24', 4: '#f43f5e' } as const;
export const NOVA_LABEL = { 1: 'Unprocessed', 2: 'Culinary ingredient', 3: 'Processed', 4: 'Ultra-processed' } as const;

export function NovaBadge({ nova }: { nova: 1 | 2 | 3 | 4 }) {
  return (
    <Badge color={NOVA_COLORS[nova]}>
      NOVA {nova}
      <span className="hidden opacity-70 sm:inline">· {NOVA_LABEL[nova]}</span>
    </Badge>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-slate-300">
          {label}
          {hint && <InfoTip text={hint} />}
        </span>
        <span className="num text-xs font-semibold text-nme">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${fill}%` }}
      />
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-white/10 bg-void-850 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition ${size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} ${
            o.value === value ? 'bg-nme/15 text-nme shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1 text-xs text-slate-300">
        {label}
        {hint && <InfoTip text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-2xl border border-white/10 bg-void-800 p-3 text-slate-400">{icon}</div>
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      <p className="mt-1 max-w-sm text-xs text-slate-400">{text}</p>
    </div>
  );
}

export const chartTooltipStyle = {
  contentStyle: {
    background: '#0e1420',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    fontSize: 12,
    color: '#e2e8f0',
  },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
};
