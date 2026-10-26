import { useMemo } from 'react';
import { Activity, ArrowRightLeft, Brain, Clock, Dumbbell, Gauge, Scale, Utensils } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEFAULT_METABOLIC_INPUT,
  computeMetabolism,
  type BmrModel,
  type MealTiming,
  type MetabolicInput,
  type Occupation,
  type RtIntensity,
  type Sex,
  type TrainingStatus,
} from '../../engine/metabolismEngine';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Card, Field, InfoTip, Meter, SectionTitle, Segmented, Slider, Stat, chartTooltipStyle, fmt, pct } from '../common/ui';

const ORGAN_COLORS = ['#c084fc', '#f59e0b', '#f43f5e', '#fb923c', '#22d3ee', '#fde68a', '#64748b'];

const MATRIX_DESCRIPTIONS: Record<number, string> = {
  1: 'Ultra-processed: soft drinks, refined snacks, ready meals',
  2: 'Mostly ultra-processed with occasional whole foods',
  3: 'Refined grains, processed meats, sweetened dairy',
  4: 'Mixed Western diet',
  5: 'Balanced mixed diet, some whole grains',
  6: 'Predominantly minimally processed',
  7: 'Whole grains, legumes several times a week',
  8: 'Whole-food Mediterranean pattern',
  9: 'Legumes, intact grains, nuts, fibrous vegetables daily',
  10: 'Whole grains, legumes, eggs, fibrous veggies, EVOO — maximal matrix integrity',
};

export function MetabolismView({ onBodyMass }: { onBodyMass?: (kg: number) => void }) {
  const [input, setInput] = useLocalStorage<MetabolicInput>('bioenergetics.metabolic', DEFAULT_METABOLIC_INPUT);
  const merged = { ...DEFAULT_METABOLIC_INPUT, ...input };
  const set = <K extends keyof MetabolicInput>(k: K, v: MetabolicInput[K]) => {
    setInput((p) => ({ ...DEFAULT_METABOLIC_INPUT, ...p, [k]: v }));
    if (k === 'weightKg' && onBodyMass) onBodyMass(v as number);
  };
  const r = useMemo(() => computeMetabolism(merged), [JSON.stringify(merged)]); // eslint-disable-line react-hooks/exhaustive-deps

  const organData = r.organs.map((o, i) => ({ ...o, color: ORGAN_COLORS[i], massPct: o.massKg / merged.weightKg, kcalPct: o.kcal / r.bmr.organ }));
  const curve = r.exchange.map((e) => ({ score: e.score, label: Math.round(e.requiredLabel), demand: Math.round(r.netDemand), ratio: +(e.ratio * 100).toFixed(1) }));

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* ---------------- INPUTS ---------------- */}
      <aside className="space-y-4 xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-104px)] xl:overflow-y-auto xl:pr-1 scrollbar-thin">
        <Card>
          <SectionTitle icon={<Scale size={16} />} title="Body Composition" />
          <div className="space-y-4">
            <Segmented<Sex> value={merged.sex} onChange={(v) => set('sex', v)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            <Slider label="Age" value={merged.age} min={16} max={85} onChange={(v) => set('age', v)} format={(v) => `${v} y`} />
            <Slider label="Body mass" value={merged.weightKg} min={40} max={160} step={0.5} onChange={(v) => set('weightKg', v)} format={(v) => `${v} kg`} />
            <Slider label="Height" value={merged.heightCm} min={140} max={210} onChange={(v) => set('heightCm', v)} format={(v) => `${v} cm`} />
            <Slider label="Body fat" value={merged.bodyFatPct} min={4} max={50} step={0.5} onChange={(v) => set('bodyFatPct', v)} format={(v) => `${v} %`} hint="From DEXA, BIA or skinfolds. Drives lean body mass and the organ-tissue model." />
            <Field label="BMR model">
              <Segmented<BmrModel>
                size="sm"
                value={merged.bmrModel}
                onChange={(v) => set('bmrModel', v)}
                options={[
                  { value: 'organ', label: 'Organ-tissue' },
                  { value: 'katch', label: 'Katch-McArdle' },
                  { value: 'cunningham', label: 'Cunningham' },
                  { value: 'mifflin', label: 'Mifflin' },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Activity size={16} />} title="Mechanical Expenditure" />
          <div className="space-y-4">
            <Slider label="Daily steps" value={merged.steps} min={0} max={30000} step={500} onChange={(v) => set('steps', v)} format={(v) => fmt(v)} />
            <Field label="Occupation / NEAT">
              <Segmented<Occupation>
                size="sm"
                value={merged.occupation}
                onChange={(v) => set('occupation', v)}
                options={[
                  { value: 'desk', label: 'Desk' },
                  { value: 'mixed', label: 'Mixed' },
                  { value: 'standing', label: 'Standing' },
                  { value: 'manual', label: 'Manual' },
                ]}
              />
            </Field>
            <Slider label="Cardio" value={merged.cardioMinutesPerWeek} min={0} max={600} step={10} onChange={(v) => set('cardioMinutesPerWeek', v)} format={(v) => `${v} min/wk`} />
            <Slider label="Cardio intensity" value={merged.cardioMet} min={3} max={14} step={0.5} onChange={(v) => set('cardioMet', v)} format={(v) => `${v} MET`} />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Dumbbell size={16} />} title="High-Intensity Resistance Training" />
          <div className="space-y-4">
            <Slider label="Sessions" value={merged.rtSessionsPerWeek} min={0} max={7} onChange={(v) => set('rtSessionsPerWeek', v)} format={(v) => `${v} / wk`} />
            <Slider label="Session duration" value={merged.rtSessionMinutes} min={15} max={150} step={5} onChange={(v) => set('rtSessionMinutes', v)} format={(v) => `${v} min`} />
            <Slider label="Working sets" value={merged.rtSetsPerSession} min={2} max={40} onChange={(v) => set('rtSetsPerSession', v)} format={(v) => `${v} sets`} />
            <Field label="Intensity">
              <Segmented<RtIntensity>
                size="sm"
                value={merged.rtIntensity}
                onChange={(v) => set('rtIntensity', v)}
                options={[
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'high', label: 'High' },
                  { value: 'failure', label: 'HIT to failure' },
                ]}
              />
            </Field>
            <Field label="Training status" hint="Trained muscle shows a shorter-lived MPS and EPOC response (repeated-bout effect).">
              <Segmented<TrainingStatus>
                size="sm"
                value={merged.trainingStatus}
                onChange={(v) => set('trainingStatus', v)}
                options={[
                  { value: 'novice', label: 'Novice' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Utensils size={16} />} title="Feeding Regimen & Diet Matrix" />
          <div className="space-y-4">
            <Slider label="Meals per day" value={merged.mealsPerDay} min={1} max={6} onChange={(v) => set('mealsPerDay', v)} format={(v) => (v === 1 ? 'OMAD' : `${v} meals`)} />
            <Field label="Meal timing" hint="Diet-induced thermogenesis is lower in the biological evening (Romon 1993, Morris 2015).">
              <Segmented<MealTiming>
                size="sm"
                value={merged.mealTiming}
                onChange={(v) => set('mealTiming', v)}
                options={[
                  { value: 'morning', label: 'Front-loaded' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'evening', label: 'Evening' },
                ]}
              />
            </Field>
            <Slider
              label="Diet Matrix Integrity Score"
              value={merged.matrixScore}
              min={1}
              max={10}
              onChange={(v) => set('matrixScore', v)}
              format={(v) => `${v} / 10`}
              hint="1 = ultra-processed · 10 = whole grains, legumes, eggs, fibrous vegetables, EVOO."
            />
            <p className="-mt-2 text-[11px] text-slate-500">{MATRIX_DESCRIPTIONS[merged.matrixScore]}</p>
            <Slider label="Protein intake" value={merged.proteinGPerKg} min={0.6} max={3} step={0.1} onChange={(v) => set('proteinGPerKg', v)} format={(v) => `${v.toFixed(1)} g/kg`} />
            <Slider label="Fat share of energy" value={merged.fatPct} min={0.1} max={0.7} step={0.01} onChange={(v) => set('fatPct', v)} format={(v) => pct(v, 0)} />
            <button className="btn-ghost w-full text-xs" onClick={() => setInput(DEFAULT_METABOLIC_INPUT)}>
              Reset to defaults
            </button>
          </div>
        </Card>
      </aside>

      {/* ---------------- RESULTS ---------------- */}
      <div className="min-w-0 space-y-4">
        {/* Plate exchange rate hero */}
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-nme/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-atwater/10 blur-3xl" />
          <SectionTitle icon={<ArrowRightLeft size={16} />} title="Plate Exchange Rate Translator" subtitle="Cellular ATP demand ↔ label calories you actually need to eat" />
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div>
              <div className="label-xs">Net cellular ATP demand</div>
              <div className="num mt-1 text-4xl font-bold text-nme">{fmt(r.netDemand)}</div>
              <div className="text-xs text-slate-500">kcal oxidised / day · {fmt(r.atpKgPerDay, 0)} kg ATP recycled</div>
            </div>
            <div className="hidden text-2xl text-slate-600 md:block">÷</div>
            <div>
              <div className="label-xs flex items-center gap-1">
                Exchange rate @ score {merged.matrixScore}
                <InfoTip text="NME delivered per Atwater label kcal for a representative diet with this matrix score and your macro split, adjusted for meal-frequency/timing TEF and transit." />
              </div>
              <div className="num mt-1 text-4xl font-bold text-slate-100">{pct(r.selected.ratio)}</div>
              <div className="text-xs text-slate-500">absorbed {pct(r.selected.absorbedPct)} of label</div>
            </div>
            <div className="hidden text-2xl text-slate-600 md:block">=</div>
            <div>
              <div className="label-xs">Required label calories</div>
              <div className="num mt-1 text-4xl font-bold text-atwater">{fmt(r.selected.requiredLabel)}</div>
              <div className="text-xs text-slate-500">
                P {fmt(r.macroGrams.protein)} g · F {fmt(r.macroGrams.fat)} g · C {fmt(r.macroGrams.carbs)} g
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 rounded-xl border border-fuel/20 bg-fuel/[0.04] p-4 sm:grid-cols-3">
            <Stat
              label="Matrix Metabolic Advantage"
              value={`+${fmt(r.selected.advantage)}`}
              unit="kcal"
              tone="fuel"
              hint="Extra label calories your current diet matrix allows versus an ultra-processed diet (score 1), while delivering identical mitochondrial fuel."
              sub="extra label kcal vs ultra-processed, isocaloric at the mitochondria"
            />
            <Stat label="Ultra-processed requirement" value={fmt(r.exchange[0].requiredLabel)} unit="kcal" sub={`exchange rate ${pct(r.exchange[0].ratio)}`} />
            <Stat label="Conventional TDEE (Mifflin × PAL)" value={fmt(r.standardTdee)} unit="kcal" sub={`${r.standardTdee > r.selected.requiredLabel ? 'over' : 'under'}-estimates by ${fmt(Math.abs(r.standardTdee - r.selected.requiredLabel))} kcal`} />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle icon={<Gauge size={16} />} title="Matrix Score → Required Label Calories" subtitle="Same mitochondrial demand, different plates" />
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curve} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lbl" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="score" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 150', 'dataMax + 80']} width={44} />
                  <Tooltip {...chartTooltipStyle} labelFormatter={(l) => `Matrix score ${l}`} formatter={(v: number, n: string) => [`${fmt(v)} kcal`, n === 'label' ? 'Required label' : 'Cellular demand']} />
                  <ReferenceLine x={merged.matrixScore} stroke="#22d3ee" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="demand" stroke="#22d3ee" strokeWidth={1.5} fill="transparent" />
                  <Area type="monotone" dataKey="label" stroke="#f59e0b" strokeWidth={2} fill="url(#lbl)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={<Activity size={16} />} title="Daily ATP Demand Breakdown" subtitle="Weekly training averaged per day" />
            <div className="space-y-2">
              {r.expenditure.map((e) => (
                <div key={e.key}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span className="text-slate-300">{e.label}</span>
                    <span className="num text-slate-400">
                      {fmt(e.kcal)} kcal <span className="text-slate-600">· {pct(e.kcal / r.netDemand, 0)}</span>
                    </span>
                  </div>
                  <Meter value={e.kcal} max={r.netDemand} color={e.color} height={5} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle icon={<Brain size={16} />} title="Organ-Tissue Metabolic Partitioning" subtitle="Elia specific metabolic rates (kcal/kg/day)" />
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Organ-tissue" value={fmt(r.bmr.organ)} unit="kcal" tone={merged.bmrModel === 'organ' ? 'nme' : 'default'} />
              <Stat label="Katch-McArdle" value={fmt(r.bmr.katch)} unit="kcal" tone={merged.bmrModel === 'katch' ? 'nme' : 'default'} />
              <Stat label="Cunningham" value={fmt(r.bmr.cunningham)} unit="kcal" tone={merged.bmrModel === 'cunningham' ? 'nme' : 'default'} />
              <Stat label="Mifflin-St Jeor" value={fmt(r.bmr.mifflin)} unit="kcal" tone={merged.bmrModel === 'mifflin' ? 'nme' : 'default'} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={organData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="tissue" width={112} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.split(' (')[0]} />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(v: number, _n: string, item: { payload?: (typeof organData)[number] }) => [
                      `${fmt(v)} kcal · ${fmt(item.payload?.massKg ?? 0, 2)} kg (${pct(item.payload?.massPct ?? 0)} of mass)`,
                      'Energy',
                    ]}
                  />
                  <Bar dataKey="kcal" radius={[0, 4, 4, 0]}>
                    {organData.map((o) => (
                      <Cell key={o.tissue} fill={o.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Brain + liver + heart + kidneys ≈ {pct(organData.slice(0, 4).reduce((s, o) => s + o.massPct, 0))} of body mass but{' '}
              {pct(organData.slice(0, 4).reduce((s, o) => s + o.kcalPct, 0), 0)} of resting ATP turnover. LBM {fmt(r.lbm, 1)} kg · FM {fmt(r.fm, 1)} kg.
            </p>
          </Card>

          <Card>
            <SectionTitle icon={<Dumbbell size={16} />} title="HIT Recovery Cost (per session)" subtitle="24–72 h EPOC, glycogen & myofibrillar synthesis" />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Mechanical work" value={fmt(r.rtSession.mechanical)} unit="kcal" tone="atwater" />
              <Stat label="EPOC (non-synthetic)" value={fmt(r.rtSession.epoc)} unit="kcal" hint="Ion-pump restoration, substrate cycling, thermoregulation and repair — resting-rate elevation minus synthesis costs." />
              <Stat label="Glycogen resynthesis" value={fmt(r.rtSession.glycogen, 1)} unit="kcal" sub={`${fmt(r.rtSession.glycogenG)} g glycogen · 2 ATP/glucosyl`} />
              <Stat label="Myofibrillar synthesis" value={fmt(r.rtSession.mps)} unit="kcal" tone="plastic" sub={`${fmt(r.rtSession.mpsProteinG)} g protein · 4 ATP/peptide bond`} />
            </div>
            <div className="mt-4 rounded-xl border border-white/5 bg-void-850 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total per session</span>
                <span className="num text-lg font-semibold text-slate-100">{fmt(r.rtSession.total)} kcal</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-slate-400">Of which delayed (after the gym)</span>
                <span className="num text-plastic">{pct((r.rtSession.total - r.rtSession.mechanical) / (r.rtSession.total || 1), 0)}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <SectionTitle icon={<Clock size={16} />} title="Feeding Regimen Dynamics" subtitle="Meal frequency, circadian thermogenesis and respiratory-quotient substrate switching" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="TEF multiplier" value={`×${r.feeding.tefFactor.toFixed(3)}`} hint="Relative to 3 balanced meals: larger boluses ↑ TEF (Tai 1991), evening eating ↓ TEF (Morris 2015)." />
            <Stat label="Transit fecal shift" value={`${r.feeding.transitPenalty >= 0 ? '+' : ''}${pct(r.feeding.transitPenalty, 1)}`} hint="Modelled change in faecal energy from bolus size and intestinal transit (heuristic)." />
            <Stat label="Food quotient (24-h RQ)" value={r.feeding.foodQuotient.toFixed(3)} hint="At energy balance the 24-h respiratory quotient equals the diet's food quotient." />
            <Stat label="Postprandial (RQ > 0.85)" value={fmt(r.feeding.postprandialHours, 1)} unit="h" tone="atwater" />
            <Stat label="Fat-oxidation window" value={fmt(r.feeding.fatDominantHours, 1)} unit="h" tone="fuel" hint="Hours per day in the post-absorptive state with RQ ≈ 0.72–0.78 (fat-dominant oxidation)." />
          </div>
          <div className="mt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              <div className="bg-atwater/80" style={{ width: `${(r.feeding.postprandialHours / 24) * 100}%` }} />
              <div className="bg-fuel/80" style={{ width: `${(r.feeding.fatDominantHours / 24) * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>carbohydrate-dominant / fed</span>
              <span>fat-dominant / post-absorptive</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
