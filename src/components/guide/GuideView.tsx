import { useMemo, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChefHat,
  Database,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Microscope,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { analyzeFood } from '../../engine/bioenergeticsEngine';
import { CORE_FOOD_BY_ID, CORE_FOODS } from '../../data/foods';
import type { Route } from '../../hooks/useHashRoute';
import { Card, fmt, pct } from '../common/ui';

const STAGES = [
  {
    n: 1,
    title: 'Atwater label',
    color: '#f59e0b',
    text: 'The number printed on the package: 4 kcal per gram of protein and carbohydrate, 9 per gram of fat. It assumes every food is digested the same way.',
    removes: 'Starting point',
  },
  {
    n: 2,
    title: 'Digestible absorbed',
    color: '#38bdf8',
    text: 'What actually crosses the gut wall. Intact plant cell walls trap fat and starch, fibre is only partly fermented and some protein escapes digestion.',
    removes: 'Removes: matrix & fibre barrier',
  },
  {
    n: 3,
    title: 'Livesey NME',
    color: '#22d3ee',
    text: 'Net Metabolizable Energy: what is left after the body pays to process the food: urea synthesis for protein, glycogen and fat storage, fermentation heat.',
    removes: 'Removes: TEF, urea cycle, thermogenesis',
  },
  {
    n: 4,
    title: 'Mitochondrial fuel',
    color: '#a3e635',
    text: 'The energy actually burned to make ATP. Amino acids built into muscle and fatty acids built into cell membranes are subtracted, because they are used as building material, not as fuel.',
    removes: 'Removes: plastic / structural use',
  },
];

const MODULES: { route: Route; icon: typeof Activity; title: string; what: string; steps: string[] }[] = [
  {
    route: 'foods',
    icon: Microscope,
    title: 'Food Encyclopedia',
    what: 'Look up any food and see its label calories next to its real cellular energy.',
    steps: [
      'Pick one of the 152 curated foods, or switch to Global search to query USDA FoodData Central (or type a barcode for OpenFoodFacts).',
      'Set the portion weight, the preparation (raw, cooked, cooled, ground, roasted) and your anabolic context.',
      'Read the waterfall, protein quality, fat-burning index and ATP yield. Press Compare to put up to five foods side by side.',
    ],
  },
  {
    route: 'meal',
    icon: ChefHat,
    title: 'Meal Builder',
    what: 'Combine foods into a meal and see how they behave together.',
    steps: [
      'Load a preset (Mediterranean, fast food, post-workout, OMAD) or add foods with the quick-add box or from the Encyclopedia.',
      'Edit grams and preparation for each item. Cooling rice or potatoes, for example, adds resistant starch.',
      'The meal is analysed as a whole: proteins complement each other (rice + beans), polyphenols are pooled, and muscle protein synthesis has a per-meal ceiling.',
    ],
  },
  {
    route: 'metabolism',
    icon: Activity,
    title: 'Metabolic Calculator',
    what: 'Estimate how much energy your cells actually use, and how many label calories that means on your plate.',
    steps: [
      'Enter body composition (body-fat % matters: it determines lean mass and organ sizes).',
      'Describe steps, job, cardio and resistance training. The calculator includes the 24–72 h recovery cost of hard training.',
      'Choose meals per day, meal timing and your Diet Matrix Integrity Score (1 = ultra-processed, 10 = whole foods). The Plate Exchange Rate gives the label calories you need.',
    ],
  },
  {
    route: 'methodology',
    icon: BookOpen,
    title: 'Methodology',
    what: 'Every formula, constant and scientific reference behind the numbers.',
    steps: ['Read it when you want to know exactly how a value was calculated, or how reliable it is.'],
  },
];

const GLOSSARY: [string, string][] = [
  ['Atwater factors', 'The 4 · 4 · 9 kcal/g values from the 1890s, still used on every nutrition label.'],
  ['NME', 'Net Metabolizable Energy (Livesey, FAO 2003): energy available to make ATP after the body’s processing costs.'],
  ['Matrix absorption', 'Share of a food’s energy that gets out of its physical structure. Whole almonds ≈ 76 %, almond butter ≈ 97 %.'],
  ['Resistant starch', 'Starch that escapes the small intestine and feeds gut bacteria. It increases when cooked starch is cooled.'],
  ['DIAAS', 'Protein quality score (FAO 2013) based on the most limiting essential amino acid after digestion. ≥ 100 % is excellent.'],
  ['Plastic protein', 'Amino acids used to build tissue (muscle, enzymes) rather than burned for energy.'],
  ['Urea cycle cost', 'Energy the liver spends to get rid of nitrogen when amino acids are burned. It is the reason protein yields the least net energy.'],
  ['NOVA', 'Food-processing class: 1 unprocessed, 2 culinary ingredients, 3 processed, 4 ultra-processed.'],
  ['CPT-1', 'The mitochondrial "gate" for long-chain fats. Medium-chain fats (MCT) bypass it and are burned quickly.'],
  ['UCP uncoupling', 'Proteins that let energy escape as heat instead of ATP. Some polyphenols (e.g. in EVOO) may mildly activate them.'],
  ['ATP', 'The cell’s energy currency. Your body regenerates roughly its own weight in ATP every day.'],
  ['Plate Exchange Rate', 'How many kcal of mitochondrial fuel you get per label kcal eaten, for a given type of diet.'],
];

const FAQ: [string, string][] = [
  [
    'Does this mean I can eat more than my calorie target?',
    'Not exactly. Conventional targets were themselves calibrated on label calories, so their errors partly cancel out. The value of this model is relative: it shows which foods and preparations deliver more or less real fuel per label calorie, and why two diets with the same label calories can behave differently.',
  ],
  [
    'Why does a whole-food diet "allow" more label calories?',
    'Intact cell walls, fibre and resistant starch let part of the energy pass unabsorbed, and minimally processed foods cost more energy to digest. To deliver the same fuel to your mitochondria you need more label calories, and the Matrix Metabolic Advantage shows how many more.',
  ],
  [
    'How accurate are the numbers?',
    'The core coefficients come from published measurements (e.g. almond and walnut energy trials, FAO conversion factors, DIAAS data). Individual factors (gut microbiome, chewing, gut transit) can shift real values by ±10 % or more. Some modifiers are marked as heuristics in the Methodology. Treat results as well-reasoned estimates, not lab measurements.',
  ],
  [
    'Why does OpenFoodFacts text search show an error?',
    'OpenFoodFacts servers currently refuse text searches that come directly from web browsers. Barcode look-up still works: type the 8–14-digit EAN/UPC in Global search. USDA search works normally.',
  ],
  [
    'Is my data stored anywhere?',
    'No. The site runs entirely in your browser. Your meal, calculator inputs and optional USDA API key are saved only in this browser’s local storage. Searches are sent only to USDA or OpenFoodFacts.',
  ],
];

export function GuideView({ navigate }: { navigate: (r: Route) => void }) {
  const almonds = useMemo(() => analyzeFood(CORE_FOOD_BY_ID['almonds-raw'], 100), []);
  const butter = useMemo(() => analyzeFood(CORE_FOOD_BY_ID['almond-butter'], 100), []);
  const [lab, , , fuel] = almonds.stages.map((s) => s.kcal);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="relative overflow-hidden border-nme/20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-nme/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuel/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <div className="label-xs mb-2 flex items-center gap-1.5 text-nme">
              <Sparkles size={12} /> What is BioEnergetics OS?
            </div>
            <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Calories on the label are not the calories your cells receive.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              BioEnergetics OS is a free, open nutrition-science tool. It estimates how much of a food&rsquo;s labelled energy is actually{' '}
              <b className="text-slate-100">absorbed</b>, how much the body <b className="text-slate-100">spends to process it</b>, how much is used as{' '}
              <b className="text-slate-100">building material</b>, and how much is finally <b className="text-slate-100">burned in your mitochondria</b> to make ATP.
              It also estimates your real daily energy demand and turns it into the label calories you need on your plate.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => navigate('foods')}>
                Explore foods <ArrowRight size={15} />
              </button>
              <button className="btn-ghost" onClick={() => navigate('metabolism')}>
                Calculate my demand
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-void-950/60 p-4">
            <div className="label-xs mb-3">Live example · 100 g whole raw almonds</div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-400">Label says</div>
                <div className="num text-3xl font-bold text-atwater">{fmt(lab)}</div>
              </div>
              <ArrowRight className="mb-2 text-slate-600" />
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Mitochondria get</div>
                <div className="num text-3xl font-bold text-fuel">{fmt(fuel)}</div>
              </div>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-void-700">
              <div className="bg-fuel" style={{ width: `${(fuel / lab) * 100}%` }} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Only {pct(almonds.matrixCoefficient, 0)} of the energy escapes the intact nut cells, consistent with human feeding trials (Novotny 2012).
              Grind the same almonds into butter and absorption rises to {pct(butter.matrixCoefficient, 0)}.
            </p>
          </div>
        </div>
      </Card>

      {/* Pipeline */}
      <section>
        <Heading icon={<Flame size={16} />} title="How it works: from plate to mitochondria" subtitle="Every food and meal goes through the same four stages. These are the four bars of the waterfall charts." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((s, i) => (
            <div key={s.n} className="card relative p-4" style={{ borderColor: `${s.color}33` }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="num flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-void-950" style={{ background: s.color }}>
                  {s.n}
                </span>
                <span className="num text-sm font-semibold" style={{ color: s.color }}>
                  {fmt(almonds.stages[i].kcal)} kcal
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.text}</p>
              <div className="mt-3 text-[10px] font-medium uppercase tracking-wider" style={{ color: s.color }}>
                {s.removes}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Values shown for 100 g of whole raw almonds, calculated live by the engine.</p>
      </section>

      {/* Modules */}
      <section>
        <Heading icon={<Layers size={16} />} title="What you can do" subtitle="Four sections, reachable from the top menu (or the bottom bar on mobile)." />
        <div className="grid gap-3 lg:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.route} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl border border-nme/20 bg-nme/10 p-2 text-nme">
                    <m.icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{m.title}</h3>
                    <p className="text-xs text-slate-400">{m.what}</p>
                  </div>
                </div>
              </div>
              <ol className="mt-4 flex-1 space-y-2">
                {m.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-slate-300">
                    <span className="num mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-void-700 text-[10px] text-nme">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <button className="btn-ghost mt-4 self-start text-xs" onClick={() => navigate(m.route)}>
                Open {m.title} <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Colours + glossary */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="card card-pad">
          <Heading icon={<Zap size={16} />} title="Reading the colours" />
          <ul className="space-y-2.5 text-xs">
            {[
              ['#f59e0b', 'Amber', 'Label (Atwater) calories, the "illusion"'],
              ['#38bdf8', 'Sky blue', 'Energy absorbed through the gut'],
              ['#22d3ee', 'Cyan', 'Livesey Net Metabolizable Energy'],
              ['#a3e635', 'Lime', 'Net mitochondrial fuel and ATP'],
              ['#c084fc', 'Violet', 'Plastic use: tissue building, structural lipids'],
              ['#f43f5e', 'Red', 'Losses: faecal escape, heat, processing costs'],
            ].map(([c, n, d]) => (
              <li key={n} className="flex items-start gap-2.5">
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded" style={{ background: c }} />
                <span>
                  <b className="text-slate-200">{n}</b> <span className="text-slate-400">· {d}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Hover the <Info size={11} className="inline" /> icons next to values for a short explanation.
          </p>
        </section>

        <section className="card card-pad">
          <Heading icon={<BookOpen size={16} />} title="Key concepts in plain words" />
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {GLOSSARY.map(([t, d]) => (
              <div key={t}>
                <dt className="text-xs font-semibold text-slate-100">{t}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">{d}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* Data & privacy + limits */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card card-pad">
          <Heading icon={<Database size={16} />} title="Data sources" />
          <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
            <li>
              <b className="text-slate-100">{CORE_FOODS.length} curated foods</b> with hand-checked values from USDA, CREA, Phenol-Explorer and published DIAAS and energy studies.
            </li>
            <li>
              <b className="text-slate-100">USDA FoodData Central</b>: hundreds of thousands of generic and branded foods. It works with a shared demo key (≈ 30 searches/hour). Add your own free key with the gear icon for 1,000/hour.
            </li>
            <li>
              <b className="text-slate-100">OpenFoodFacts</b>: barcode look-up of packaged products worldwide.
            </li>
            <li>
              External foods are completed by the <b className="text-slate-100">Bioenergetic Inference Engine</b>, which marks every estimated value and gives a confidence score.
            </li>
          </ul>
        </section>
        <section className="card card-pad">
          <Heading icon={<Lock size={16} />} title="Privacy" />
          <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
            <li>No account, no tracking, no server: everything is calculated in your browser.</li>
            <li>Your meal, calculator settings and API key are stored only in this browser&rsquo;s local storage. Clear the site data to remove them.</li>
            <li>Food searches go only to the USDA or OpenFoodFacts servers.</li>
          </ul>
        </section>
      </div>

      <section className="card card-pad border-atwater/20">
        <Heading icon={<ShieldAlert size={16} className="text-atwater" />} title="Important: what this tool is, and what it is not" />
        <p className="text-xs leading-relaxed text-slate-300">
          BioEnergetics OS is an <b className="text-slate-100">educational and analytical model</b> built on published physiology. It is useful for understanding
          why foods with identical label calories can behave very differently, and for comparing foods, preparations and diets. It is{' '}
          <b className="text-slate-100">not a medical device</b> and does not replace a doctor or registered dietitian, especially for diabetes, kidney disease,
          eating disorders, pregnancy or any clinical condition.
        </p>
      </section>

      {/* FAQ */}
      <section>
        <Heading icon={<HelpCircle size={16} />} title="Frequently asked questions" />
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-100">
                {q}
                <ArrowRight size={14} className="shrink-0 text-slate-500 transition group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-2 pb-4 pt-2">
        <button className="btn-primary" onClick={() => navigate('foods')}>
          Start with the Food Encyclopedia <ArrowRight size={15} />
        </button>
        <button className="btn-ghost" onClick={() => navigate('methodology')}>
          Read the full methodology
        </button>
      </div>
    </div>
  );
}

function Heading({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <div className="mt-0.5 text-nme">{icon}</div>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}
