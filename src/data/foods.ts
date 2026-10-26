import raw from './coreFoods.json';
import type { FoodItem } from '../types';

/** Curated high-precision core database (per 100 g). */
export const CORE_FOODS: FoodItem[] = (raw as unknown as FoodItem[]).map((f) => ({ ...f, source: 'core' as const }));

export const CORE_FOOD_BY_ID: Record<string, FoodItem> = Object.fromEntries(CORE_FOODS.map((f) => [f.id, f]));

/** Simple token-based fuzzy search over the core database. */
export function searchCoreFoods(query: string, limit = 60): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return CORE_FOODS.slice(0, limit);
  const tokens = q.split(/\s+/);
  return CORE_FOODS.map((f) => {
    const hay = `${f.name} ${f.category.replace('_', ' ')} ${f.notes ?? ''}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (f.name.toLowerCase().startsWith(t)) score += 3;
      else if (f.name.toLowerCase().includes(t)) score += 2;
      else if (hay.includes(t)) score += 1;
      else return { f, score: -1 };
    }
    return { f, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.f);
}
