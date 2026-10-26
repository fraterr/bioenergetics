import { useMemo, useState } from 'react';
import { Atom, ChefHat, Dna, Flame, Plus, RotateCcw, Search, Trash2, Utensils } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CATEGORY_META, PREP_LABELS, analyzeFood, analyzeMeal, prepOptionsFor } from '../../engine/bioenergeticsEngine';
import { CORE_FOOD_BY_ID, searchCoreFoods } from '../../data/foods';
import type { AnabolicState, MealEntry, PrepMethod } from '../../types';
import { Card, EmptyState, InfoTip, Meter, SectionTitle, Segmented, Stat, chartTooltipStyle, fmt, pct } from '../common/ui';
import { WaterfallChart } from './WaterfallChart';

const PRESETS: { name: string; items: [string, number, PrepMethod][] }[] = [
  {
    name: 'Mediterranean whole-food plate',
    items: [
      ['lentils', 200, 'as_listed'],
      ['rice-black', 120, 'cooled'],
      ['broccoli', 150, 'as_listed'],
      ['evoo-high', 15, 'as_listed'],
      ['egg-whole-boiled', 100, 'as_listed'],
    ],
  },
  {
    name: 'Ultra-processed fast-food meal',
    items: [
      ['burger', 220, 'as_listed'],
      ['french-fries', 120, 'as_listed'],
      ['cola', 500, 'as_listed'],
    ],
  },
  {
    name: 'Post-HIT recovery bowl',
    items: [
      ['whey-isolate', 35, 'as_listed'],
      ['oats-rolled', 80, 'as_listed'],
      ['banana-ripe', 120, 'as_listed'],
      ['blueberries', 100, 'as_listed'],
      ['almonds-raw', 25, 'as_listed'],
    ],
  },
  {
    name: 'OMAD evening feast',
    items: [
      ['salmon-wild', 250, 'as_listed'],
      ['potato-boiled', 300, 'cooled'],
      ['chickpeas', 150, 'as_listed'],
      ['spinach', 100, 'as_listed'],
      ['evoo', 30, 'as_listed'],
      ['walnuts', 30, 'as_listed'],
      ['dark-choc', 30, 'as_listed'],
    ],
  },
];

let uidCounter = 0;
export const newUid = () => `${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;

export function MealBuilder({
  meal,
  setMeal,
  bodyMassKg,
}: {
  meal: MealEntry[];
  setMeal: React.Dispatch<React.SetStateAction<MealEntry[]>>;
  bodyMassKg: number;
}) {
  const [anabolic, setAnabolic] = useState<AnabolicState>('training');
  const [q, setQ] = useState('');
  const suggestions = useMemo(() => (q.trim().length > 0 ? searchCoreFoods(q, 8) : []), [q]);

  const analysis = useMemo(() => analyzeMeal(meal, { anabolicState: anabolic, bodyMassKg }), [meal, anabolic, bodyMassKg]);
  const perItem = useMemo(() => meal.map((e) => ({ e, a: analyzeFood(e.food, e.grams, e.prep, { anabolicState: anabolic, bodyMassKg }) })), [meal, anabolic, bodyMassKg]);

  const update = (uid: string, patch: Partial<MealEntry>) => setMeal((m) => m.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));
  const loadPreset = (p: (typeof PRESETS)[number]) =>
    setMeal(p.items.filter(([id]) => CORE_FOOD_BY_ID[id]).map(([id, grams, prep]) => ({ uid: newUid(), food: CORE_FOOD_BY_ID[id], grams, prep })));

  const [atwater, absorbed, nme, fuel] = analysis.stages.map((s) => s.kcal);
  const substrateColors = ['#22d3ee', '#f43f5e', '#a3e635', '#c084fc', '#38bdf8', '#f59e0b', '#94a3b8'];

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={<ChefHat size={16} />}
          title="Interactive Meal Builder"
          subtitle="Foods are absorbed individually, then partitioned jointly: amino-acid complementarity, pooled polyphenols, MPS saturation."
          right={
            meal.length > 0 && (
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setMeal([])}>
                <RotateCcw size={13} /> Clear
              </button>
            )
          }
        />
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => loadPreset(p)}>
              <Utensils size={12} /> {p.name}
            </button>
          ))}
        </div>
        <div className="relative mb-4">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Quick-add a core food… (use the Encyclopedia for global USDA / OpenFoodFacts foods)" value={q} onChange={(e) => setQ(e.target.value)} />
          {suggestions.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-void-800 shadow-2xl">
              {suggestions.map((f) => (
                <li key={f.id}>
                  <button
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                    onClick={() => {
                      setMeal((m) => [...m, { uid: newUid(), food: f, grams: 100, prep: 'as_listed' }]);
                      setQ('');
                    }}
                  >
                    <span className="flex items-center gap-2 truncate text-slate-200">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: CATEGORY_META[f.category].color }} />
                      {f.name}
                    </span>
                    <Plus size={14} className="shrink-0 text-nme" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {meal.length === 0 ? (
          <EmptyState icon={<Utensils size={20} />} title="Your plate is empty" text="Load a preset, quick-add a food above, or add foods from the Encyclopedia (including live USDA / OpenFoodFacts results)." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="py-2 pr-2 font-medium">Food</th>
                  <th className="px-2 py-2 font-medium">Weight</th>
                  <th className="px-2 py-2 font-medium">Preparation</th>
                  <th className="px-2 py-2 text-right font-medium text-atwater">Label</th>
                  <th className="px-2 py-2 text-right font-medium text-nme">NME</th>
                  <th className="px-2 py-2 text-right font-medium text-fuel">Fuel</th>
                  <th className="px-2 py-2 text-right font-medium">Matrix</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {perItem.map(({ e, a }) => {
                  const opts = prepOptionsFor(e.food);
                  return (
                    <tr key={e.uid} className="border-b border-white/5">
                      <td className="max-w-[220px] py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: CATEGORY_META[e.food.category].color }} />
                          <span className="truncate text-slate-100" title={e.food.name}>
                            {e.food.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={3000}
                            className="input num w-20 px-2 py-1 text-xs"
                            value={e.grams}
                            onChange={(ev) => update(e.uid, { grams: Math.max(0, Number(ev.target.value) || 0) })}
                          />
                          <span className="text-slate-500">g</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {opts.length > 1 ? (
                          <select className="input px-2 py-1 text-xs" value={opts.includes(e.prep) ? e.prep : 'as_listed'} onChange={(ev) => update(e.uid, { prep: ev.target.value as PrepMethod })}>
                            {opts.map((p) => (
                              <option key={p} value={p}>
                                {PREP_LABELS[p]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-500">{PREP_LABELS.as_listed}</span>
                        )}
                      </td>
                      <td className="num px-2 py-2 text-right text-atwater">{fmt(a.stages[0].kcal)}</td>
                      <td className="num px-2 py-2 text-right text-nme">{fmt(a.stages[2].kcal)}</td>
                      <td className="num px-2 py-2 text-right text-fuel">{fmt(a.stages[3].kcal)}</td>
                      <td className="num px-2 py-2 text-right text-slate-300">{pct(a.matrixCoefficient, 0)}</td>
                      <td className="py-2 pl-2 text-right">
                        <button className="text-slate-500 hover:text-loss" onClick={() => setMeal((m) => m.filter((x) => x.uid !== e.uid))} aria-label="Remove">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {meal.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="!p-4">
              <Stat label="1 · Atwater label" value={fmt(atwater)} unit="kcal" tone="atwater" />
            </Card>
            <Card className="!p-4">
              <Stat label="2 · Absorbed" value={fmt(absorbed)} unit="kcal" sub={`−${fmt(atwater - absorbed)} matrix & fibre`} />
            </Card>
            <Card className="!p-4">
              <Stat label="3 · Livesey NME" value={fmt(nme)} unit="kcal" tone="nme" sub={`−${fmt(absorbed - nme)} TEF & urea`} />
            </Card>
            <Card className="!p-4">
              <Stat label="4 · Mitochondrial fuel" value={fmt(fuel)} unit="kcal" tone="fuel" sub={`${pct(analysis.cellularRatio)} of label`} />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <SectionTitle
                icon={<Flame size={16} />}
                title="Meal Bioenergetic Waterfall"
                subtitle="Atwater → post-matrix → post-TEF & urea cycle → post-plastic deduction"
                right={
                  <Segmented<AnabolicState>
                    size="sm"
                    value={anabolic}
                    onChange={setAnabolic}
                    options={[
                      { value: 'maintenance', label: 'Rest' },
                      { value: 'training', label: 'Training' },
                      { value: 'recovery', label: 'Recovery' },
                    ]}
                  />
                }
              />
              <WaterfallChart analysis={analysis} height={320} />
            </Card>

            <Card>
              <SectionTitle icon={<Atom size={16} />} title="ATP Regeneration" subtitle="Oxidative phosphorylation yield of the meal's net fuel" />
              <div className="flex items-center gap-4">
                <div className="h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analysis.atp.bySubstrate} dataKey="mol" nameKey="substrate" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
                        {analysis.atp.bySubstrate.map((_, i) => (
                          <Cell key={i} fill={substrateColors[i % substrateColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...chartTooltipStyle} formatter={(v: number) => `${fmt(v, 2)} mol ATP`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  <Stat label="ATP regenerated" value={fmt(analysis.atp.mol, 1)} unit="mol" tone="fuel" />
                  <Stat label="ATP mass turned over" value={fmt(analysis.atp.grams / 1000, 2)} unit="kg" />
                  <Stat label="Captured / heat" value={`${pct(analysis.atp.captureEfficiency, 0)} / ${pct(1 - analysis.atp.captureEfficiency, 0)}`} hint="Fraction of fuel energy conserved in ATP phosphoanhydride bonds at ΔG°′ = −30.5 kJ/mol; the remainder is dissipated as heat (proton leak, UCPs, slip)." />
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {analysis.atp.bySubstrate.map((s, i) => (
                  <li key={s.substrate} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="h-2 w-2 rounded-sm" style={{ background: substrateColors[i % substrateColors.length] }} />
                      {s.substrate}
                    </span>
                    <span className="num text-slate-300">{fmt(s.kcal)} kcal</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <SectionTitle icon={<Dna size={16} />} title="Meal Protein Partitioning" />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Mean DIAAS" value={fmt(analysis.protein.diaas * 100)} unit="%" />
                <Stat
                  label="Effective DIAAS"
                  value={fmt(analysis.protein.effectiveDiaas * 100)}
                  unit="%"
                  tone="fuel"
                  hint="After amino-acid complementarity: lysine-limited cereals/nuts and sulphur-AA-limited legumes cover each other's deficits."
                />
                <Stat label="Plastic retained" value={fmt(analysis.protein.plastic, 1)} unit="g" tone="plastic" sub={`cap ${fmt(bodyMassKg * 0.4)} g MPS saturation`} />
                <Stat label="Oxidised" value={fmt(analysis.protein.oxidized, 1)} unit="g" sub={`${fmt(analysis.protein.ureaKcal)} kcal urea cost`} />
              </div>
            </Card>
            <Card>
              <SectionTitle icon={<Flame size={16} />} title="Meal Lipid Thermogenesis" subtitle="Polyphenols pooled across all foods" />
              <div className="flex items-end justify-between">
                <span className="num text-3xl font-bold text-plastic">{analysis.lipid.index > 0 ? fmt(analysis.lipid.index) : '—'}</span>
                <span className="text-[11px] text-slate-500">index / 100</span>
              </div>
              <div className="mt-2">
                <Meter value={analysis.lipid.index} max={100} color="#c084fc" />
              </div>
              <dl className="mt-3 space-y-1 text-xs">
                <KV k="UCP polyphenol uplift" v={pct(analysis.lipid.ucpUplift, 2)} />
                <KV k="9-h fat oxidation" v={pct(analysis.lipid.postprandialOxidation)} />
                <KV k="Storage-directed fat" v={`${fmt(analysis.lipid.storageDirectedFat, 1)} g`} />
              </dl>
            </Card>
            <Card>
              <SectionTitle icon={<Atom size={16} />} title="Oxidative Priority" subtitle="Order in which the meal's fuels are burned" />
              <ol className="space-y-1.5">
                {analysis.oxidativeHierarchy.map((h) => (
                  <li key={h.substrate} className={`flex items-center justify-between gap-2 text-xs ${h.kcal < 0.5 ? 'opacity-40' : ''}`}>
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="num flex h-5 w-5 items-center justify-center rounded bg-void-700 text-[10px] text-nme">{h.priority}</span>
                      {h.substrate}
                      <InfoTip text={h.fate} />
                    </span>
                    <span className="num text-slate-400">{fmt(h.kcal)} kcal</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-white/5 pb-1">
      <dt className="text-slate-400">{k}</dt>
      <dd className="num text-slate-200">{v}</dd>
    </div>
  );
}
