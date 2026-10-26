import { useState } from 'react';
import { CORE_FOOD_BY_ID } from '../../data/foods';
import type { FoodItem, PrepMethod } from '../../types';
import { FoodBrowser } from './FoodBrowser';
import { FoodComparator } from './FoodComparator';
import { FoodDetail } from './FoodDetail';

const DEFAULT_COMPARE = ['almonds-raw', 'almond-butter', 'evoo-high', 'egg-whole-boiled'];

export function EncyclopediaView({
  onAddToMeal,
  bodyMassKg,
}: {
  onAddToMeal: (food: FoodItem, grams: number, prep: PrepMethod) => void;
  bodyMassKg: number;
}) {
  const [selected, setSelected] = useState<FoodItem>(CORE_FOOD_BY_ID['almonds-raw']);
  const [compare, setCompare] = useState<FoodItem[]>(DEFAULT_COMPARE.map((id) => CORE_FOOD_BY_ID[id]).filter(Boolean));

  const toggleCompare = (f: FoodItem) =>
    setCompare((prev) => (prev.some((x) => x.id === f.id) ? prev.filter((x) => x.id !== f.id) : [...prev, f].slice(-5)));

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-[84px] lg:h-[calc(100vh-104px)]">
        <div className="h-[420px] lg:h-full">
          <FoodBrowser
            selectedId={selected.id}
            onSelect={(f) => {
              setSelected(f);
              if (window.innerWidth < 1024) document.getElementById('food-detail')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </aside>
      <div id="food-detail" className="min-w-0 space-y-4">
        <FoodDetail
          key={selected.id}
          food={selected}
          onAddToMeal={onAddToMeal}
          onCompare={toggleCompare}
          isCompared={compare.some((x) => x.id === selected.id)}
          bodyMassKg={bodyMassKg}
        />
        <FoodComparator foods={compare} onRemove={(id) => setCompare((p) => p.filter((x) => x.id !== id))} onSelect={setSelected} />
      </div>
    </div>
  );
}
