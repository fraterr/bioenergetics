import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Database, Globe, Loader2, Search } from 'lucide-react';
import { CATEGORY_META, analyzeFood } from '../../engine/bioenergeticsEngine';
import { CORE_FOODS, searchCoreFoods } from '../../data/foods';
import { searchGlobal, type GlobalSource } from '../../services/foodApi';
import type { FoodCategory, FoodItem } from '../../types';
import { fmt } from '../common/ui';

type Mode = 'core' | 'global';

export function FoodBrowser({ selectedId, onSelect }: { selectedId?: string; onSelect: (f: FoodItem) => void }) {
  const [mode, setMode] = useState<Mode>('core');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | 'all'>('all');
  const [sources, setSources] = useState<GlobalSource[]>(['usda', 'off']);
  const [globalResults, setGlobalResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [searched, setSearched] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const categories = useMemo(() => {
    const set = new Set(CORE_FOODS.map((f) => f.category));
    return (Object.keys(CATEGORY_META) as FoodCategory[]).filter((c) => set.has(c));
  }, []);

  const coreResults = useMemo(() => {
    const r = searchCoreFoods(query, 500);
    return category === 'all' ? r : r.filter((f) => f.category === category);
  }, [query, category]);

  const runGlobal = async () => {
    const q = query.trim();
    if (q.length < 2 || sources.length === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErrors([]);
    try {
      const res = await searchGlobal(q, sources, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setGlobalResults(res.foods);
        setErrors(res.errors);
        setSearched(q);
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const list = mode === 'core' ? coreResults : globalResults;

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="space-y-3 border-b border-white/5 p-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-void-850 p-1">
          <ModeBtn active={mode === 'core'} onClick={() => setMode('core')} icon={<Database size={13} />} label={`Core (${CORE_FOODS.length})`} />
          <ModeBtn active={mode === 'global'} onClick={() => setMode('global')} icon={<Globe size={13} />} label="Global search" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'global') void runGlobal();
          }}
          className="relative"
        >
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9 pr-20"
            placeholder={mode === 'core' ? 'Filter curated foods…' : 'Food name or barcode (EAN/UPC)…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {mode === 'global' && (
            <button type="submit" className="btn-primary absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs" disabled={loading || query.trim().length < 2}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : 'Search'}
            </button>
          )}
        </form>

        {mode === 'core' ? (
          <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            <CatChip active={category === 'all'} onClick={() => setCategory('all')} label="All" color="#94a3b8" />
            {categories.map((c) => (
              <CatChip key={c} active={category === c} onClick={() => setCategory(c)} label={CATEGORY_META[c].label} color={CATEGORY_META[c].color} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Sources:</span>
            {(['usda', 'off'] as GlobalSource[]).map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-cyan-400"
                  checked={sources.includes(s)}
                  onChange={(e) => setSources((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))}
                />
                {s === 'usda' ? 'USDA FoodData Central' : 'OpenFoodFacts'}
              </label>
            ))}
          </div>
        )}
      </div>

      {mode === 'global' && errors.length > 0 && (
        <div className="space-y-1 border-b border-white/5 bg-loss/5 px-4 py-2.5">
          {errors.map((e) => (
            <p key={e} className="flex gap-1.5 text-[11px] text-loss-soft">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {e}
            </p>
          ))}
        </div>
      )}

      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {mode === 'global' && !loading && list.length === 0 && (
          <li className="px-3 py-10 text-center text-xs leading-relaxed text-slate-500">
            {searched
              ? `No results for "${searched}".`
              : 'Search millions of foods from USDA FoodData Central and OpenFoodFacts. Each result is parameterised on the fly by the Bioenergetic Inference Engine (category, NOVA, matrix, RS, DIAAS, fatty-acid profile, polyphenols).'}
          </li>
        )}
        {mode === 'global' && loading && (
          <li className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Querying global databases…
          </li>
        )}
        {!loading &&
          list.map((f) => (
            <FoodRow key={f.id} food={f} active={f.id === selectedId} onClick={() => onSelect(f)} />
          ))}
      </ul>
    </div>
  );
}

function FoodRow({ food, active, onClick }: { food: FoodItem; active: boolean; onClick: () => void }) {
  const a = useMemo(() => analyzeFood(food, 100), [food]);
  const meta = CATEGORY_META[food.category];
  return (
    <li>
      <button
        onClick={onClick}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
          active ? 'bg-nme/10 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]' : 'hover:bg-white/[0.03]'
        }`}
      >
        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-slate-100">{food.name}</span>
          <span className="block truncate text-[11px] text-slate-500">
            {food.brand ? `${food.brand} · ` : ''}
            {meta.label} · NOVA {food.nova}
            {food.source !== 'core' && ` · ${food.source === 'usda' ? 'USDA' : 'OFF'}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="num block text-xs text-atwater">{fmt(a.stages[0].kcal)}</span>
          <span className="num block text-[11px] text-fuel">{fmt(a.stages[3].kcal)}</span>
        </span>
      </button>
    </li>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
        active ? 'bg-nme/15 text-nme' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CatChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="chip shrink-0 whitespace-nowrap transition"
      style={
        active
          ? { color, borderColor: `${color}88`, background: `${color}22` }
          : { color: '#94a3b8', borderColor: 'rgba(255,255,255,0.08)', background: 'transparent' }
      }
    >
      {label}
    </button>
  );
}
