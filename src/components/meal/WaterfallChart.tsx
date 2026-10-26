import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BioenergeticAnalysis } from '../../types';
import { chartTooltipStyle, fmt } from '../common/ui';

interface Row {
  name: string;
  base: number;
  value: number;
  color: string;
  kind: 'stage' | 'loss';
  display: number;
}

const STAGE_COLORS = ['#f59e0b', '#38bdf8', '#22d3ee', '#a3e635'];
const LOSS_COLORS = ['#f43f5e', '#fb7185', '#c084fc'];
const LOSS_NAMES = ['Matrix & fibre barrier', 'TEF, urea & thermogenesis', 'Plastic deduction'];

/** X-axis tick that wraps long stage names onto up to three short lines. */
function WrappedTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = (payload?.value ?? '').split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 11) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return (
    <text x={x} y={y + 10} textAnchor="middle" fill="#94a3b8" fontSize={9.5}>
      {lines.slice(0, 3).map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 11}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** 4-stage bioenergetic waterfall: Atwater → Absorbed → NME → Mitochondrial fuel. */
export function WaterfallChart({ analysis, height = 300, compact = false }: { analysis: BioenergeticAnalysis; height?: number; compact?: boolean }) {
  const s = analysis.stages.map((x) => x.kcal);
  const rows: Row[] = [];
  analysis.stages.forEach((stage, i) => {
    rows.push({ name: stage.label, base: 0, value: s[i], color: STAGE_COLORS[i], kind: 'stage', display: s[i] });
    if (i < 3) {
      const hi = Math.max(s[i], s[i + 1]);
      const lo = Math.min(s[i], s[i + 1]);
      rows.push({ name: LOSS_NAMES[i], base: lo, value: hi - lo, color: LOSS_COLORS[i], kind: 'loss', display: s[i + 1] - s[i] });
    }
  });

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 8, left: compact ? -16 : 0, bottom: compact ? 0 : 8 }} barCategoryGap="14%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="name" tick={<WrappedTick />} interval={0} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} height={compact ? 44 : 52} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            {...chartTooltipStyle}
            formatter={(_v: number, _n: string, item: { payload?: Row }) => {
              const r = item.payload;
              if (!r) return ['', ''];
              return [`${r.kind === 'loss' && r.display < 0 ? '−' : r.kind === 'loss' ? '+' : ''}${fmt(Math.abs(r.display), 1)} kcal`, r.kind === 'loss' ? 'Change' : 'Energy'];
            }}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="w" radius={[5, 5, 0, 0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.color} fillOpacity={r.kind === 'loss' ? 0.55 : 0.9} />
            ))}
            <LabelList
              dataKey="display"
              position="top"
              formatter={(v: number) => (Math.abs(v) < 0.05 ? '' : v < 0 ? `−${fmt(-v)}` : fmt(v))}
              style={{ fill: '#cbd5e1', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
