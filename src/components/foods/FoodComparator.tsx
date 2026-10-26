import { useMemo, useState } from 'react';
import { GitCompareArrows, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORY_META, analyzeFood, atwaterKcal } from '../../engine/bioenergeticsEngine';
import type { BioenergeticAnalysis, FoodItem } from '../../types';
import { Card, SectionTitle, Segmented, chartTooltipStyle, fmt, pct } from '../common/ui';

type Basis = 'mass' | 'energy';

const STAGE_COLORS = { Atwater: '#f59e0b', Absorbed: '#38bdf8', NME: '#22d3ee', Fuel: '#a3e635' };

export function FoodComparator({ foods, onRemove, onSelect }: { foods: FoodItem[]; onRemove: (id: string) => void; onSelect: (f: FoodItem) => void }) {
  const [basis, setBasis] = useState<Basis>('energy');

  const rows = useMemo(
    () =>
      foods.map((f) => {
        // Isoenergetic comparison: the weight that delivers 100 Atwater kcal.
        const grams = basis === 'mass' ? 100 : Math.min(2000, (100 / Math.max(1e-6, atwaterKcal(f, 100))) * 100);
        return { food: f, grams, a: analyzeFood(f, grams) };
      }),
    [foods, basis],
  );

  if (foods.length === 0) return null;

  const chartData = rows.map((r) => ({
    name: r.food.name.length > 22 ? `${r.food.name.slice(0, 21)}…` : r.food.name,
    Atwater: +r.a.stages[0].kcal.toFixed(1),
    Absorbed: +r.a.stages[1].kcal.toFixed(1),
    NME: +r.a.stages[2].kcal.toFixed(1),
    Fuel: +r.a.stages[3].kcal.toFixed(1),
  }));

  const metrics: { label: string; get: (a: BioenergeticAnalysis, f: FoodItem, g: number) => string; best?: (a: BioenergeticAnalysis) => number }[] = [
    { label: 'Portion', get: (_a, _f, g) => `${fmt(g)} g` },
    { label: 'Atwater label', get: (a) => `${fmt(a.stages[0].kcal)} kcal` },
    { label: 'Digestible absorbed', get: (a) => `${fmt(a.stages[1].kcal)} kcal` },
    { label: 'Livesey NME', get: (a) => `${fmt(a.stages[2].kcal)} kcal` },
    { label: 'Net mitochondrial fuel', get: (a) => `${fmt(a.stages[3].kcal)} kcal` },
    { label: 'Cellular exchange rate', get: (a) => pct(a.cellularRatio), best: (a) => -a.cellularRatio },
    { label: 'Matrix absorption', get: (a) => pct(a.matrixCoefficient) },
    { label: 'ATP yield', get: (a) => `${fmt(a.atp.mol, 2)} mol` },
    { label: 'Protein (ingested)', get: (a) => `${fmt(a.protein.ingested, 1)} g`, best: (a) => a.protein.ingested },
    { label: 'DIAAS', get: (a) => (a.protein.ingested > 0.3 ? fmt(a.protein.diaas * 100) + ' %' : '—'), best: (a) => (a.protein.ingested > 0.3 ? a.protein.diaas : -1) },
    { label: 'Plastic protein', get: (a) => `${fmt(a.protein.plastic, 1)} g`, best: (a) => a.protein.plastic },
    { label: 'Urea-cycle loss', get: (a) => `${fmt(a.protein.ureaKcal, 1)} kcal` },
    { label: 'Lipid thermogenesis index', get: (a) => (a.lipid.index > 0 ? fmt(a.lipid.index) : '—'), best: (a) => a.lipid.index },
    { label: 'Fibre', get: (a) => `${fmt(a.macros.fiber, 1)} g`, best: (a) => a.macros.fiber },
  ];

  return (
    <Card>
      <SectionTitle
        icon={<GitCompareArrows size={16} />}
        title="Bioenergetic Comparator"
        subtitle={basis === 'energy' ? 'Isoenergetic: each food at the weight that provides 100 label kcal' : 'Per 100 g edible portion'}
        right={
          <Segmented<Basis>
            size="sm"
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'energy', label: 'Per 100 label kcal' },
              { value: 'mass', label: 'Per 100 g' },
            ]}
          />
        }
      />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} interval={0} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip {...chartTooltipStyle} formatter={(v: number) => `${fmt(v, 1)} kcal`} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {(Object.keys(STAGE_COLORS) as (keyof typeof STAGE_COLORS)[]).map((k) => (
              <Bar key={k} dataKey={k} fill={STAGE_COLORS[k]} radius={[3, 3, 0, 0]} fillOpacity={0.9} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="scrollbar-thin mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 pr-3 text-left font-medium text-slate-400">Metric</th>
              {rows.map((r) => (
                <th key={r.food.id} className="px-2 py-2 text-right align-bottom font-medium">
                  <div className="flex items-start justify-end gap-1">
                    <button onClick={() => onSelect(r.food)} className="max-w-[160px] text-right text-slate-100 hover:text-nme" title={r.food.name}>
                      <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: CATEGORY_META[r.food.category].color }} />
                      {r.food.name}
                    </button>
                    <button onClick={() => onRemove(r.food.id)} className="text-slate-500 hover:text-loss" aria-label="Remove">
                      <X size={13} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const bestIdx = m.best && rows.length > 1 ? rows.reduce((bi, r, i, arr) => (m.best!(r.a) > m.best!(arr[bi].a) ? i : bi), 0) : -1;
              return (
                <tr key={m.label} className="border-b border-white/5">
                  <td className="py-1.5 pr-3 text-slate-400">{m.label}</td>
                  {rows.map((r, i) => (
                    <td key={r.food.id} className={`num px-2 py-1.5 text-right ${i === bestIdx ? 'font-semibold text-fuel' : 'text-slate-200'}`}>
                      {m.get(r.a, r.food, r.grams)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Highlighted cells mark the most favourable value (lowest cellular exchange rate, highest protein quality / retention / thermogenesis / fibre).</p>
    </Card>
  );
}
