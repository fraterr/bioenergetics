import { useCallback, useState } from 'react';
import { Activity, ArrowRight, BookOpen, ChefHat, Compass, Github, Microscope, Settings, X } from 'lucide-react';
import { useHashRoute, type Route } from './hooks/useHashRoute';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { FoodItem, MealEntry, PrepMethod } from './types';
import { EncyclopediaView } from './components/foods/EncyclopediaView';
import { MealBuilder, newUid } from './components/meal/MealBuilder';
import { MetabolismView } from './components/metabolism/MetabolismView';
import { MethodologyView } from './components/methodology/MethodologyView';
import { SettingsModal } from './components/common/SettingsModal';
import { GuideView } from './components/guide/GuideView';
import { DEFAULT_METABOLIC_INPUT, type MetabolicInput } from './engine/metabolismEngine';

const TABS: { id: Route; label: string; short: string; icon: typeof Activity }[] = [
  { id: 'guide', label: 'How it works', short: 'Guide', icon: Compass },
  { id: 'foods', label: 'Food Encyclopedia', short: 'Foods', icon: Microscope },
  { id: 'meal', label: 'Meal Builder', short: 'Meal', icon: ChefHat },
  { id: 'metabolism', label: 'Metabolic Calculator', short: 'Metabolism', icon: Activity },
  { id: 'methodology', label: 'Methodology', short: 'Science', icon: BookOpen },
];

function readBodyMass(): number {
  try {
    const raw = localStorage.getItem('bioenergetics.metabolic');
    const v = raw ? (JSON.parse(raw) as Partial<MetabolicInput>).weightKg : undefined;
    return typeof v === 'number' && v > 0 ? v : DEFAULT_METABOLIC_INPUT.weightKg;
  } catch {
    return DEFAULT_METABOLIC_INPUT.weightKg;
  }
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const [meal, setMeal] = useLocalStorage<MealEntry[]>('bioenergetics.meal', []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bodyMass, setBodyMass] = useState(readBodyMass);
  const [welcomeDismissed, setWelcomeDismissed] = useLocalStorage('bioenergetics.welcomeDismissed', false);

  const addToMeal = useCallback(
    (food: FoodItem, grams: number, prep: PrepMethod) => setMeal((m) => [...m, { uid: newUid(), food, grams, prep }]),
    [setMeal],
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-void-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-4 px-4 sm:px-6">
          <a href="#/foods" className="flex shrink-0 items-center gap-2.5">
            <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
              <rect width="64" height="64" rx="14" fill="#0e1420" />
              <path d="M14 40c6-18 14-18 18 0s12 18 18 0" fill="none" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
              <circle cx="32" cy="22" r="5" fill="#a3e635" />
            </svg>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-white">
                BioEnergetics <span className="text-nme">OS</span>
              </div>
              <div className="hidden text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:block">NME-Core · Beyond Atwater</div>
            </div>
          </a>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {TABS.map((t) => (
              <TabButton key={t.id} active={route === t.id} onClick={() => navigate(t.id)} icon={<t.icon size={15} />} label={t.label} short={t.short} badge={t.id === 'meal' && meal.length > 0 ? meal.length : undefined} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <button className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="API settings">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 pb-28 pt-5 sm:px-6 md:pb-12">
        {route !== 'guide' && !welcomeDismissed && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-nme/25 bg-nme/[0.06] px-4 py-3">
            <Compass size={18} className="shrink-0 text-nme" />
            <p className="flex-1 text-xs text-slate-300 sm:text-sm">
              New here? Learn what BioEnergetics OS does and how to read its numbers in two minutes.
            </p>
            <button className="btn-primary shrink-0 px-2.5 py-1.5 text-xs" onClick={() => navigate('guide')}>
              How it works <ArrowRight size={13} />
            </button>
            <button className="shrink-0 text-slate-500 hover:text-slate-200" onClick={() => setWelcomeDismissed(true)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
        <PageIntro route={route} />
        {route === 'guide' && <GuideView navigate={navigate} />}
        {route === 'foods' && <EncyclopediaView onAddToMeal={addToMeal} bodyMassKg={bodyMass} />}
        {route === 'meal' && <MealBuilder meal={meal} setMeal={setMeal} bodyMassKg={bodyMass} />}
        {route === 'metabolism' && <MetabolismView onBodyMass={setBodyMass} />}
        {route === 'methodology' && <MethodologyView />}
      </main>

      <footer className="mx-auto hidden max-w-[1480px] items-center justify-between gap-4 px-6 pb-8 text-[11px] text-slate-500 md:flex">
        <span>BioEnergetics OS · Livesey NME · FAO 2003 / 2013 · Educational model, not medical advice.</span>
        <span className="flex items-center gap-1">
          <Github size={12} /> Client-side only · data: USDA FoodData Central, OpenFoodFacts (ODbL)
        </span>
      </footer>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-void-950/95 backdrop-blur-xl md:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => navigate(t.id)} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${route === t.id ? 'text-nme' : 'text-slate-500'}`}>
            <t.icon size={18} />
            {t.short}
            {t.id === 'meal' && meal.length > 0 && <span className="num absolute right-[28%] top-1.5 rounded-full bg-nme px-1 text-[9px] font-bold text-void-950">{meal.length}</span>}
          </button>
        ))}
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function TabButton({ active, onClick, icon, label, short, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; short: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
        active ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
      }`}
    >
      <span className={active ? 'text-nme' : ''}>{icon}</span>
      <span className="xl:hidden">{short}</span>
      <span className="hidden xl:inline">{label}</span>
      {badge !== undefined && <span className="num rounded-full bg-nme/20 px-1.5 text-[10px] text-nme">{badge}</span>}
      {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-nme" />}
    </button>
  );
}

const INTROS: Record<Route, { title: string; text: string }> = {
  guide: {
    title: 'How BioEnergetics OS works',
    text: 'What this site is, the science in plain words, and a step-by-step guide to each section.',
  },
  foods: {
    title: 'Label Illusion vs Cellular Reality',
    text: 'Every food decomposed from Atwater label calories into digestible energy, Livesey Net Metabolizable Energy, net mitochondrial fuel and moles of ATP — with matrix, DIAAS and lipid-thermogenesis analysis.',
  },
  meal: {
    title: 'Meal Bioenergetics',
    text: 'Combine foods, change preparation (retrograded starch, grinding, roasting) and watch the 4-stage waterfall: what reaches your mitochondria is not what the label says.',
  },
  metabolism: {
    title: 'True Cellular BMR & ATP-TDEE',
    text: 'Organ-tissue resting metabolism, HIT recovery cost (EPOC, glycogen, 4-ATP-per-bond protein synthesis) and the plate exchange rate that translates ATP demand into label calories.',
  },
  methodology: {
    title: 'Methodology',
    text: 'Every formula, constant and reference behind the engine.',
  },
};

function PageIntro({ route }: { route: Route }) {
  const i = INTROS[route];
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{i.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">{i.text}</p>
    </div>
  );
}
