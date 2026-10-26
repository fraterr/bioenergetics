import { useMemo, useState } from 'react';
import { Atom, Beaker, Dna, Droplets, Flame, GitCompareArrows, Layers, Plus, Sparkles, Zap } from 'lucide-react';
import { CATEGORY_META, PREP_LABELS, analyzeFood, applyPrep, prepOptionsFor } from '../../engine/bioenergeticsEngine';
import type { AnabolicState, FoodItem, PrepMethod } from '../../types';
import { Badge, Card, InfoTip, Meter, NovaBadge, SectionTitle, Segmented, Slider, Stat, fmt, pct } from '../common/ui';
import { WaterfallChart } from '../meal/WaterfallChart';

const SOURCE_LABEL = { core: 'Curated core', usda: 'USDA FDC', off: 'OpenFoodFacts' } as const;

export function SourceBadge({ food }: { food: FoodItem }) {
  const color = food.source === 'core' ? '#22d3ee' : food.source === 'usda' ? '#60a5fa' : '#f59e0b';
  return <Badge color={color}>{SOURCE_LABEL[food.source]}</Badge>;
}

export function FoodDetail({
  food,
  onAddToMeal,
  onCompare,
  isCompared,
  bodyMassKg,
}: {
  food: FoodItem;
  onAddToMeal: (food: FoodItem, grams: number, prep: PrepMethod) => void;
  onCompare: (food: FoodItem) => void;
  isCompared: boolean;
  bodyMassKg: number;
}) {
  const [grams, setGrams] = useState(100);
  const [prep, setPrep] = useState<PrepMethod>('as_listed');
  const [anabolic, setAnabolic] = useState<AnabolicState>('maintenance');
  const [added, setAdded] = useState(false);

  const prepOptions = prepOptionsFor(food);
  const activePrep = prepOptions.includes(prep) ? prep : 'as_listed';
  const effective = useMemo(() => applyPrep(food, activePrep), [food, activePrep]);
  const a = useMemo(() => analyzeFood(food, grams, activePrep, { anabolicState: anabolic, bodyMassKg }), [food, grams, activePrep, anabolic, bodyMassKg]);
  const meta = CATEGORY_META[food.category];
  const [atwater, absorbed, nme, fuel] = a.stages.map((s) => s.kcal);
  const totalFA = effective.sfa + effective.mufa + effective.pufa || 1;

  const matrixLosses = a.losses.filter((l) => l.stage === 'matrix');
  const nmeLosses = a.losses.filter((l) => l.stage === 'nme');
  const plasticLosses = a.losses.filter((l) => l.stage === 'plastic');

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Badge color={meta.color}>{meta.label}</Badge>
              <NovaBadge nova={effective.nova} />
              <SourceBadge food={food} />
              {food.brand && <Badge color="#94a3b8">{food.brand}</Badge>}
              {food.confidence !== undefined && (
                <Badge color={food.confidence > 0.75 ? '#a3e635' : food.confidence > 0.6 ? '#fbbf24' : '#fb7185'}>
                  inference confidence {Math.round(food.confidence * 100)}%
                </Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold leading-tight text-white sm:text-xl">{food.name}</h2>
            {food.notes && <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-400">{food.notes}</p>}
            {food.inferredFields && food.inferredFields.length > 0 && (
              <p className="mt-1.5 max-w-2xl text-[11px] text-slate-500">
                <Sparkles size={11} className="mr-1 inline text-atwater" />
                Inferred by the Bioenergetic Inference Engine: {food.inferredFields.join(', ')}.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button className={isCompared ? 'btn-ghost border-nme/40 text-nme' : 'btn-ghost'} onClick={() => onCompare(food)}>
              <GitCompareArrows size={15} /> {isCompared ? 'In comparator' : 'Compare'}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                onAddToMeal(food, grams, activePrep);
                setAdded(true);
                setTimeout(() => setAdded(false), 1400);
              }}
            >
              <Plus size={15} /> {added ? 'Added!' : 'Add to meal'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-white/5 pt-4 md:grid-cols-[1fr_auto]">
          <Slider label="Portion weight" value={grams} min={5} max={500} step={5} onChange={setGrams} format={(v) => `${v} g`} />
          <div className="flex flex-wrap items-end gap-3">
            {prepOptions.length > 1 && (
              <div>
                <div className="mb-1 text-xs text-slate-300">Preparation</div>
                <select className="input py-1.5 text-xs" value={activePrep} onChange={(e) => setPrep(e.target.value as PrepMethod)}>
                  {prepOptions.map((p) => (
                    <option key={p} value={p}>
                      {PREP_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div className="mb-1 flex items-center gap-1 text-xs text-slate-300">
                Anabolic context <InfoTip text="Fraction of high-quality absorbed amino acids retained as tissue protein: maintenance 25 %, training day 35 %, post-HIT recovery window 45 % (capped by MPS saturation at 0.4 g/kg)." />
              </div>
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
            </div>
          </div>
        </div>
      </Card>

      {/* Label illusion vs cellular reality */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden border-atwater/20">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-atwater/10 blur-2xl" />
          <SectionTitle icon={<Layers size={16} className="text-atwater" />} title="Label Illusion" subtitle="Atwater general factors · bomb-calorimetry heritage (1896)" />
          <div className="num text-4xl font-bold text-atwater">
            {fmt(atwater)}
            <span className="ml-1.5 text-sm font-normal text-slate-500">kcal</span>
          </div>
          <div className="mt-4 space-y-1.5 text-xs">
            {[
              ['Protein', a.macros.protein, 4],
              ['Fat', a.macros.fat, 9],
              ['Carbohydrate (avail.)', a.macros.carbs, 4],
              ['Dietary fibre', a.macros.fiber, 4],
              ['Alcohol', a.macros.alcohol, 7],
            ]
              .filter(([, g]) => (g as number) > 0.005)
              .map(([n, g, f]) => (
                <div key={n as string} className="flex items-center justify-between border-b border-white/5 pb-1.5 text-slate-400">
                  <span>{n}</span>
                  <span className="num text-slate-300">
                    {fmt(g as number, 1)} g × {f} = <span className="text-atwater">{fmt((g as number) * (f as number), 0)}</span>
                  </span>
                </div>
              ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Assumes every gram is digested identically regardless of matrix, fibre, protein quality or the ATP cost of metabolising it.
          </p>
        </Card>

        <Card className="relative overflow-hidden border-fuel/20">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuel/10 blur-2xl" />
          <SectionTitle icon={<Zap size={16} className="text-fuel" />} title="Cellular Reality" subtitle="Livesey NME → net mitochondrial oxidisable fuel" />
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="num text-4xl font-bold text-fuel">
              {fmt(fuel)}
              <span className="ml-1.5 text-sm font-normal text-slate-500">kcal fuel</span>
            </div>
            <div className="num pb-1 text-sm text-loss">−{pct(1 - a.cellularRatio)} vs label</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Absorbed" value={fmt(absorbed)} unit="kcal" tone="default" />
            <Stat label="Livesey NME" value={fmt(nme)} unit="kcal" tone="nme" />
            <Stat label="ATP yield" value={fmt(a.atp.mol, 2)} unit="mol" tone="fuel" hint="Moles of ATP regenerated by oxidative phosphorylation from the net fuel (P/O 2.5 NADH, 1.5 FADH₂)." sub={`${fmt(a.atp.grams)} g ATP`} />
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-slate-400">
              <span>Cellular exchange rate</span>
              <span className="num text-fuel">{pct(a.cellularRatio)}</span>
            </div>
            <Meter value={a.cellularRatio} color="linear-gradient(90deg,#22d3ee,#a3e635)" />
          </div>
        </Card>
      </div>

      {/* Waterfall */}
      <Card>
        <SectionTitle
          icon={<Flame size={16} />}
          title="Bioenergetic Waterfall"
          subtitle={`${grams} g · ${PREP_LABELS[activePrep]}`}
          right={<span className="num text-xs text-slate-500">ATP capture ≈ {pct(a.atp.captureEfficiency, 0)} · heat ≈ {pct(1 - a.atp.captureEfficiency, 0)}</span>}
        />
        <WaterfallChart analysis={a} />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { title: 'Matrix & fibre barrier', items: matrixLosses, color: '#f43f5e' },
            { title: 'TEF, urea cycle & thermogenesis', items: nmeLosses, color: '#fb7185' },
            { title: 'Plastic / anabolic deduction', items: plasticLosses, color: '#c084fc' },
          ].map((g) => (
            <div key={g.title}>
              <div className="label-xs mb-2" style={{ color: g.color }}>
                {g.title}
              </div>
              <ul className="space-y-1.5">
                {g.items.length === 0 && <li className="text-xs text-slate-500">—</li>}
                {g.items.map((l) => (
                  <li key={l.key} className="flex items-start justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1 text-slate-400">
                      {l.label} <InfoTip text={l.description} />
                    </span>
                    <span className="num shrink-0 text-slate-200">{l.kcal >= 0 ? '−' : '+'}{fmt(Math.abs(l.kcal), 1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Matrix */}
        <Card>
          <SectionTitle icon={<Beaker size={16} />} title="Matrix Absorption" subtitle="Faecal / colonic escape of energy" />
          <div className="num text-3xl font-bold text-slate-100">{pct(a.matrixCoefficient)}</div>
          <div className="mt-2">
            <Meter value={a.matrixCoefficient} color="#38bdf8" />
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <Row k="Lipid / starch release coefficient" v={pct(effective.matrix)} />
            <Row k="Resistant starch" v={`${fmt((effective.rs * grams) / 100, 1)} g`} />
            <Row k="Fibre : available-carb ratio" v={fmt(effective.fiber / (effective.carbs + effective.fiber || 1), 2)} />
            <Row k="Faecal lipid" v={`${fmt(a.losses.find((l) => l.key === 'fecal_fat')?.kcal ?? 0, 1)} kcal`} />
            <Row k="Polyphenols" v={`${fmt((effective.polyphenols * grams) / 100)} mg`} />
          </dl>
        </Card>

        {/* Protein */}
        <Card>
          <SectionTitle icon={<Dna size={16} />} title="Protein Quality & Partitioning" subtitle="DIAAS · ileal digestibility · plastic vs oxidised" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="DIAAS" value={fmt(a.protein.diaas * 100)} unit="%" tone={a.protein.diaas >= 1 ? 'fuel' : a.protein.diaas >= 0.75 ? 'nme' : 'atwater'} hint="Digestible Indispensable Amino Acid Score (FAO 2013). ≥ 100 % = excellent quality." />
            <Stat label="Ileal digestibility" value={pct(effective.ileal, 0)} hint="True ileal protein digestibility — the fraction absorbed as amino acids before the colon." />
          </div>
          <div className="mt-4 space-y-2">
            <PartBar label="Ingested" g={a.protein.ingested} max={a.protein.ingested} color="#f59e0b" />
            <PartBar label="Absorbed (ileal)" g={a.protein.absorbed} max={a.protein.ingested} color="#38bdf8" />
            <PartBar label="Plastic / anabolic retention" g={a.protein.plastic} max={a.protein.ingested} color="#c084fc" />
            <PartBar label="Oxidised as fuel" g={a.protein.oxidized} max={a.protein.ingested} color="#a3e635" />
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            <Row k="Urea cycle & deamination loss" v={`${fmt(a.protein.ureaKcal, 1)} kcal`} />
            <Row k="Peptide-bond ATP cost" v={`${fmt(a.protein.synthesisKcal, 1)} kcal`} />
            <Row k="Limiting amino acid" v={food.limitingAA === 'none' ? 'none' : food.limitingAA === 'sulfur' ? 'Met + Cys' : food.limitingAA} />
          </dl>
        </Card>

        {/* Lipid */}
        <Card>
          <SectionTitle icon={<Droplets size={16} />} title="Lipid Bio-Thermogenesis" subtitle="CPT-1 affinity · oxidation · UCP uncoupling" />
          {food.fat * (grams / 100) < 0.5 ? (
            <p className="text-xs text-slate-500">Negligible lipid content — index not applicable.</p>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div className="num text-3xl font-bold text-plastic">{fmt(a.lipid.index)}</div>
                <span className="text-[11px] text-slate-500">index / 100</span>
              </div>
              <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full">
                <div style={{ width: `${(effective.mct / totalFA) * 100}%` }} className="bg-fuel" title="MCT C6–C10" />
                <div style={{ width: `${((effective.sfa - effective.mct) / totalFA) * 100}%` }} className="bg-loss" title="Long-chain SFA" />
                <div style={{ width: `${(effective.mufa / totalFA) * 100}%` }} className="bg-nme" title="MUFA" />
                <div style={{ width: `${(effective.pufa / totalFA) * 100}%` }} className="bg-plastic" title="PUFA" />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                <Legend c="bg-fuel" t={`MCT ${pct(effective.mct / totalFA, 0)}`} />
                <Legend c="bg-loss" t={`LC-SFA ${pct((effective.sfa - effective.mct) / totalFA, 0)}`} />
                <Legend c="bg-nme" t={`MUFA ${pct(effective.mufa / totalFA, 0)}`} />
                <Legend c="bg-plastic" t={`PUFA ${pct(effective.pufa / totalFA, 0)}`} />
              </div>
              <dl className="mt-4 space-y-1.5 text-xs">
                <Row k="CPT-1 transport affinity" v={`${fmt(a.lipid.cpt1Affinity)} / 100`} />
                <Row k="9-h postprandial oxidation" v={pct(a.lipid.postprandialOxidation)} />
                <Row k="UCP1/UCP3 polyphenol uplift" v={pct(a.lipid.ucpUplift, 2)} />
                <Row k="Thermogenic dissipation" v={`${fmt(a.lipid.thermogenicKcal, 1)} kcal`} />
                <Row k="Storage-directed fat" v={`${fmt(a.lipid.storageDirectedFat, 1)} g`} />
              </dl>
            </>
          )}
        </Card>
      </div>

      {/* ATP by substrate */}
      <Card>
        <SectionTitle icon={<Atom size={16} />} title="ATP Yield by Substrate & Oxidative Priority" subtitle="Fuel partition after all deductions · stoichiometric ATP / kcal" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2.5">
            {a.atp.bySubstrate.map((s) => (
              <div key={s.substrate}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-300">{s.substrate}</span>
                  <span className="num text-slate-400">
                    {fmt(s.kcal, 1)} kcal · <span className="text-fuel">{fmt(s.mol, 2)} mol</span>
                  </span>
                </div>
                <Meter value={s.kcal} max={fuel || 1} color="#a3e635" height={4} />
              </div>
            ))}
            {a.atp.bySubstrate.length === 0 && <p className="text-xs text-slate-500">No oxidisable fuel.</p>}
          </div>
          <ol className="space-y-2">
            {a.oxidativeHierarchy.map((h) => (
              <li key={h.substrate} className={`flex gap-3 rounded-lg border border-white/5 p-2.5 ${h.kcal < 0.05 ? 'opacity-40' : ''}`}>
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-void-700 text-xs text-nme">{h.priority}</span>
                <div className="min-w-0">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-200">{h.substrate}</span>
                    <span className="num text-slate-400">{fmt(h.kcal, 1)} kcal</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{h.fate}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
      <dt className="text-slate-400">{k}</dt>
      <dd className="num text-slate-200">{v}</dd>
    </div>
  );
}

function PartBar({ label, g, max, color }: { label: string; g: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="num text-slate-300">{fmt(g, 1)} g</span>
      </div>
      <Meter value={g} max={max || 1} color={color} height={5} />
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-sm ${c}`} />
      {t}
    </span>
  );
}
