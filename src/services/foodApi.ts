/**
 * Live global food search: USDA FoodData Central + OpenFoodFacts.
 * Every retrieved record is passed through the deterministic Bioenergetic
 * Inference Engine (`inferFood`) to obtain NME, matrix, DIAAS and ATP parameters.
 */
import { inferFood, type ExternalNutrients } from '../engine/bioenergeticsEngine';
import type { FoodItem, NovaGroup } from '../types';

export const USDA_KEY_STORAGE = 'bioenergetics.usdaApiKey';
export const USDA_DEMO_KEY = 'DEMO_KEY';

export function getUsdaKey(): string {
  try {
    return localStorage.getItem(USDA_KEY_STORAGE) || USDA_DEMO_KEY;
  } catch {
    return USDA_DEMO_KEY;
  }
}

export function setUsdaKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(USDA_KEY_STORAGE, key.trim());
    else localStorage.removeItem(USDA_KEY_STORAGE);
  } catch {
    /* storage unavailable (private mode) — key is used for this session only */
  }
}

/* ------------------------------------------------------------------ USDA */

interface UsdaNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  foodCategory?: string;
  foodNutrients?: UsdaNutrient[];
}

/** FoodData Central nutrient numbers (legacy SR numbering, stable across data types). */
const USDA_NUM = {
  energy: '208',
  protein: '203',
  fat: '204',
  carbs: '205',
  fiber: '291',
  sugars: '269',
  sfa: '606',
  mufa: '645',
  pufa: '646',
  alcohol: '221',
  water: '255',
} as const;

const USDA_ID: Record<keyof typeof USDA_NUM, number> = {
  energy: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  sugars: 2000,
  sfa: 1258,
  mufa: 1292,
  pufa: 1293,
  alcohol: 1018,
  water: 1051,
};

function usdaValue(food: UsdaFood, key: keyof typeof USDA_NUM): number | undefined {
  const n = food.foodNutrients?.find((x) => x.nutrientNumber === USDA_NUM[key] || x.nutrientId === USDA_ID[key]);
  if (!n || n.value === undefined || n.value === null) return undefined;
  if (key === 'energy' && n.unitName && n.unitName.toUpperCase() === 'KJ') return n.value / 4.184;
  return n.value;
}

export async function searchUsda(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  // Built by hand: the FDC API rejects '+'-encoded spaces (URLSearchParams) inside dataType values.
  const qs = [
    `api_key=${encodeURIComponent(getUsdaKey())}`,
    `query=${encodeURIComponent(query)}`,
    'pageSize=25',
    `dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS),Branded')}`,
  ].join('&');
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${qs}`, { signal });
  if (res.status === 429) throw new Error('USDA rate limit reached (DEMO_KEY allows ~30 requests/hour). Add your own free API key in Settings.');
  if (res.status === 403) throw new Error('USDA API key rejected. Check the key in Settings.');
  if (!res.ok) throw new Error(`USDA request failed (${res.status})`);
  const json = (await res.json()) as { foods?: UsdaFood[] };
  return (json.foods ?? [])
    .map((f) => {
      const ext: ExternalNutrients = {
        id: String(f.fdcId),
        name: titleCase(f.description),
        brand: f.brandName || f.brandOwner || undefined,
        source: 'usda',
        categoryHint: f.foodCategory,
        dataType: f.dataType,
        energyKcal: usdaValue(f, 'energy'),
        protein: usdaValue(f, 'protein'),
        fat: usdaValue(f, 'fat'),
        carbsTotal: usdaValue(f, 'carbs'),
        fiber: usdaValue(f, 'fiber'),
        sugars: usdaValue(f, 'sugars'),
        sfa: usdaValue(f, 'sfa'),
        mufa: usdaValue(f, 'mufa'),
        pufa: usdaValue(f, 'pufa'),
        alcohol: usdaValue(f, 'alcohol'),
        water: usdaValue(f, 'water'),
      };
      return ext;
    })
    .filter((e) => e.protein !== undefined || e.fat !== undefined || e.carbsTotal !== undefined)
    .map(inferFood);
}

/* ---------------------------------------------------------- OpenFoodFacts */

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string | string[];
  nova_group?: number | string;
  categories?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

const OFF_FIELDS = 'code,product_name,product_name_en,brands,nova_group,categories,categories_tags,nutriments';

/**
 * OpenFoodFacts text search. search-a-licious is tried first, then the legacy CGI endpoint.
 * OFF currently throttles browser-originated text searches (503 without CORS headers), so a
 * failure here surfaces a clear message; barcode look-ups use the product API, which is unaffected.
 */
async function offTextSearch(query: string, signal?: AbortSignal): Promise<OffProduct[]> {
  const q = encodeURIComponent(query);
  try {
    const res = await fetch(`https://search.openfoodfacts.org/search?q=${q}&page_size=25&fields=${OFF_FIELDS}`, { signal });
    if (res.ok) return ((await res.json()) as { hits?: OffProduct[] }).hits ?? [];
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
  }
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`,
      { signal },
    );
    if (res.status === 429) throw new Error('rate limit');
    if (res.ok) return ((await res.json()) as { products?: OffProduct[] }).products ?? [];
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
  }
  throw new Error('text search is currently refused for browser requests by the OpenFoodFacts servers. Enter a product barcode (EAN/UPC, 8–14 digits) to look it up directly, or use USDA.');
}

async function offBarcode(code: string, signal?: AbortSignal): Promise<OffProduct[]> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, { signal });
  if (!res.ok) throw new Error(`barcode lookup failed (${res.status})`);
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return [];
  return [{ ...json.product, code: json.product.code ?? code }];
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<FoodItem[]> {
  const trimmed = query.trim();
  const products = /^\d{8,14}$/.test(trimmed) ? await offBarcode(trimmed, signal) : await offTextSearch(trimmed, signal);
  return products
    .filter((p) => (p.product_name_en || p.product_name) && p.nutriments)
    .map((p) => {
      const n = p.nutriments ?? {};
      const novaRaw = num(p.nova_group);
      const nova = novaRaw && novaRaw >= 1 && novaRaw <= 4 ? (Math.round(novaRaw) as NovaGroup) : undefined;
      const energyKcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== undefined ? (num(n['energy_100g']) as number) / 4.184 : undefined);
      const ext: ExternalNutrients = {
        id: p.code ?? Math.random().toString(36).slice(2),
        name: (p.product_name_en || p.product_name || 'Unnamed product').trim(),
        brand: (Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0])?.trim(),
        source: 'off',
        categoryHint: p.categories ?? p.categories_tags?.map((t) => t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).join(', '),
        nova,
        energyKcal,
        protein: num(n['proteins_100g']),
        fat: num(n['fat_100g']),
        carbsAmbiguous: num(n['carbohydrates_100g']),
        fiber: num(n['fiber_100g']),
        sugars: num(n['sugars_100g']),
        sfa: num(n['saturated-fat_100g']),
        mufa: num(n['monounsaturated-fat_100g']),
        pufa: num(n['polyunsaturated-fat_100g']),
        alcohol: num(n['alcohol_100g']),
        polyols: num(n['polyols_100g']),
      };
      return ext;
    })
    .filter((e) => e.protein !== undefined && e.fat !== undefined && e.carbsAmbiguous !== undefined)
    .map(inferFood);
}

export type GlobalSource = 'usda' | 'off';

export interface GlobalSearchResult {
  foods: FoodItem[];
  errors: string[];
}

/** Queries the selected databases in parallel; partial failures are reported, not thrown. */
export async function searchGlobal(query: string, sources: GlobalSource[], signal?: AbortSignal): Promise<GlobalSearchResult> {
  const tasks = sources.map((s) => (s === 'usda' ? searchUsda(query, signal) : searchOpenFoodFacts(query, signal)));
  const settled = await Promise.allSettled(tasks);
  const foods: FoodItem[] = [];
  const errors: string[] = [];
  settled.forEach((r, i) => {
    // Drop records that carry no usable macronutrient data (common in sparse branded entries).
    if (r.status === 'fulfilled') foods.push(...r.value.filter((f) => f.protein + f.fat + f.carbs + f.fiber + f.alcohol > 0));
    else if (!(r.reason instanceof DOMException && r.reason.name === 'AbortError')) {
      errors.push(`${sources[i] === 'usda' ? 'USDA' : 'OpenFoodFacts'}: ${(r.reason as Error).message}`);
    }
  });
  return { foods, errors };
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}
