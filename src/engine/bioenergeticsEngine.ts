/**
 * ============================================================================
 *  BioEnergetics OS — Bioenergetic Engine (NME-Core: Beyond Atwater)
 * ============================================================================
 *
 *  Deterministic model that converts a food (or a whole meal) from its
 *  label energy (Atwater general factors) into the energy that actually
 *  reaches mitochondria as oxidisable fuel, and into moles of ATP.
 *
 *  Pipeline (each stage is additive across foods):
 *
 *   STAGE 1  Atwater label energy          4·P + 4·(CHO_avail + fibre) + 9·F + 7·EtOH
 *      │  − faecal fat / protein escape (matrix + ileal barrier)
 *      │  − fibre / resistant-starch overcount (4 kcal/g on label → 2 kcal/g ME)
 *   STAGE 2  Digestible absorbed energy (ME basis, post-matrix)
 *      │  − urea cycle, deamination & gluconeogenic ATP cost (protein ME × 0.20)
 *      │  − obligatory storage thermogenesis (CHO × 0.05, fat × 0.011)
 *      │  − colonic fermentation heat/gas (fermented ME × 0.30)
 *      │  − NOVA food-class facultative TEF, MCT/MUFA/UCP lipid thermogenesis
 *   STAGE 3  Livesey Net Metabolizable Energy (NME)
 *      │  − amino acids sequestered in tissue (plastic) + peptide-bond ATP cost
 *      │  − structural lipids incorporated into membranes
 *   STAGE 4  Net mitochondrial oxidisable fuel  →  ATP (mol)
 *
 *  Primary references
 *   - Livesey G. (2001) Br J Nutr 85:271-287 — NME system.
 *   - FAO (2003) Food energy: methods of analysis and conversion factors. FAO FNP 77.
 *   - Merrill & Watt (1973) USDA Agriculture Handbook 74 — Atwater specific factors.
 *   - Novotny JA et al. (2012) Am J Clin Nutr 96:296 — almond ME 129 vs 170 kcal/28 g.
 *   - Baer DJ et al. (2016) J Nutr 146:9 — walnut ME 21 % below Atwater.
 *   - Gebauer SK et al. (2016) Food Funct 7:4231 — processing raises almond ME.
 *   - Grundy MM et al. (2016) Am J Clin Nutr 104:1199 — plant cell walls as a lipid barrier.
 *   - Evenepoel P et al. (1998) J Nutr 128:1716 — cooked vs raw egg protein digestibility (91 vs 51 %).
 *   - FAO (2013) Dietary protein quality evaluation — DIAAS.
 *   - DeLany JP et al. (2000) Am J Clin Nutr 72:905 — differential oxidation of dietary FAs.
 *   - St-Onge MP & Jones PJ (2002) J Nutr 132:329 — MCT thermogenesis.
 *   - Barr SB & Wright JC (2010) Food Nutr Res 54 — whole vs processed food TEF.
 *   - Schoenfeld BJ & Aragon AA (2018) JISSN 15:10 — per-meal protein distribution.
 * ============================================================================
 */

import type {
  AbsorbedProfile,
  AnalysisContext,
  AnabolicState,
  AtpYield,
  BioenergeticAnalysis,
  FoodCategory,
  FoodItem,
  FoodState,
  LimitingAA,
  LipidIndex,
  LossItem,
  MealEntry,
  NovaGroup,
  PrepMethod,
  ProteinPartition,
} from '../types';

/* ============================================================================
 * 1. ENERGY CONVERSION CONSTANTS (kcal / g)
 * ========================================================================== */

/** Atwater general factors as used on nutrition labels (total carbohydrate by difference, fibre at 4). */
export const ATWATER = { protein: 4, fat: 9, carbohydrate: 4, alcohol: 7, polyols: 4 } as const;

/** Metabolizable-energy (ME) factors per gram that is actually absorbed / fermented. */
export const ME = {
  protein: 4,
  fat: 9,
  carbohydrate: 4,
  /** FAO 2003: fermentable fibre & resistant starch → short-chain fatty acids */
  colonic: 2,
  alcohol: 7,
  polyols: 2.4,
} as const;

/** Livesey Net Metabolizable Energy factors (FAO 2003, Table 3.4; Livesey 2001). */
export const NME = {
  protein: 3.2,
  fat: 8.9,
  carbohydrate: 3.8,
  colonic: 1.4,
  alcohol: 6.3,
  polyols: 2.2,
} as const;

/** Protein digestibility already embedded in the Atwater 4 kcal/g factor (mixed diet). */
export const ATWATER_REFERENCE_PROTEIN_DIGESTIBILITY = 0.92;

/** Fraction of matrix-trapped starch that escapes relative to trapped lipid (starch granules are partly exposed). */
export const STARCH_ENCAPSULATION_RATIO = 0.5;

/* ---- Protein synthesis & ATP stoichiometry ---- */

/** ATP equivalents per peptide bond: 2 (aminoacyl-tRNA, ATP→AMP) + 2 GTP (elongation, translocation). */
export const ATP_PER_PEPTIDE_BOND = 4;
/** Mean molecular mass of an amino-acid residue in protein (g/mol). */
export const MEAN_RESIDUE_MASS = 110;
/** ATP yield of complete glucose oxidation per kcal (32 ATP / 670 kcal ΔcH). */
export const ATP_PER_KCAL_GLUCOSE = 32 / 670;
/** Substrate energy that must be oxidised to regenerate 1 mol ATP (glucose-equivalent, kcal/mol). */
export const KCAL_PER_MOL_ATP = 1 / ATP_PER_KCAL_GLUCOSE;
/** Energy cost of synthesising 1 g of protein (kcal) ≈ 0.76 kcal/g. */
export const PEPTIDE_SYNTHESIS_KCAL_PER_G = (ATP_PER_PEPTIDE_BOND / MEAN_RESIDUE_MASS) * KCAL_PER_MOL_ATP;
/** ATP molecular weight (g/mol). */
export const ATP_MOLAR_MASS = 507.18;
/** Standard free energy of ATP hydrolysis ΔG°' (kcal/mol) = 30.5 kJ/mol. */
export const ATP_DELTA_G_STANDARD = 7.3;

/**
 * ATP yield per kcal of substrate energy (P/O = 2.5 NADH, 1.5 FADH2).
 *  glucose 32 ATP / 670 kcal · palmitate 106 ATP / 2398 kcal · octanoate 50 ATP / 1147 kcal
 *  ethanol 13 ATP / 327 kcal · SCFA mix (acetate/propionate/butyrate) ≈ 0.040
 *  amino acids: carbon-skeleton yield per NME kcal (urea cost already charged at NME stage).
 */
export const ATP_PER_KCAL = {
  carbohydrate: 32 / 670,
  lcfa: 106 / 2398,
  mct: 50 / 1147,
  aminoAcids: 0.0455,
  alcohol: 13 / 327,
  scfa: 0.04,
  polyols: 0.046,
} as const;

/* ---- Partitioning constants ---- */

/** Fraction of high-quality absorbed amino acids retained in tissue (plastic) per anabolic context. */
export const PLASTIC_RETENTION: Record<AnabolicState, number> = {
  maintenance: 0.25,
  training: 0.35,
  recovery: 0.45,
};
/** Per-meal protein dose that saturates myofibrillar protein synthesis (g/kg body mass). */
export const MPS_SATURATION_G_PER_KG = 0.4;
/** Membrane incorporation of absorbed fatty acids (structural lipid) by class. */
export const STRUCTURAL_LIPID_FRACTION = { pufa: 0.1, mufa: 0.02 } as const;

/** NOVA facultative TEF coefficient (fraction of stage-2 energy); positive = extra heat. Barr & Wright 2010. */
export const NOVA_TEF: Record<NovaGroup, number> = { 1: 0.03, 2: 0.01, 3: 0, 4: -0.01 };

/* ---- Lipid oxidation & thermogenesis constants ---- */

/** CPT-1 mitochondrial entry affinity (0–100). MCFA enter mitochondria CPT-1-independently. */
export const CPT1_AFFINITY = { mct: 100, pufa: 75, mufa: 70, sfaLong: 40 } as const;
/** Cumulative 9-h postprandial oxidation fraction per FA class (DeLany 2000; MCT from St-Onge 2002). */
export const POSTPRANDIAL_OXIDATION = { mct: 0.6, pufa: 0.2, mufa: 0.21, sfaLong: 0.145 } as const;
/** Extra thermogenesis as fraction of each class's energy. */
export const CLASS_THERMOGENESIS = { mct: 0.05, mufa: 0.012, pufa: 0.008, sfaLong: 0 } as const;
/** Maximum UCP1/UCP3 uplift attributable to dietary polyphenols (fraction of lipid energy). */
export const UCP_MAX_UPLIFT = 0.025;
/** Polyphenol density (mg per 100 g fat) giving 63 % of the maximum UCP uplift. */
export const UCP_HALF_DENSITY = 80;

/* ============================================================================
 * 2. CATEGORY METADATA (used for UI and for inference of unknown foods)
 * ========================================================================== */

export interface CategoryMeta {
  label: string;
  color: string;
  matrix: number;
  ileal: number;
  diaas: number;
  limitingAA: LimitingAA;
  /** Resistant-starch fraction of starch in the default state */
  rsFraction: number;
  /** Fatty-acid split as fraction of total fat [SFA, MUFA, PUFA] */
  fa: [number, number, number];
  /** MCFA C6–C10 as fraction of total fat */
  mctFraction: number;
  polyphenols: number;
  nova: NovaGroup;
  state: FoodState;
  plant: boolean;
}

export const CATEGORY_META: Record<FoodCategory, CategoryMeta> = {
  egg: { label: 'Eggs', color: '#facc15', matrix: 0.97, ileal: 0.93, diaas: 1.1, limitingAA: 'none', rsFraction: 0, fa: [0.33, 0.4, 0.15], mctFraction: 0, polyphenols: 0, nova: 1, state: 'cooked', plant: false },
  dairy: { label: 'Milk & Yogurt', color: '#e2e8f0', matrix: 0.98, ileal: 0.95, diaas: 1.1, limitingAA: 'none', rsFraction: 0, fa: [0.62, 0.26, 0.04], mctFraction: 0.065, polyphenols: 0, nova: 1, state: 'processed', plant: false },
  cheese: { label: 'Cheese', color: '#fde68a', matrix: 0.95, ileal: 0.96, diaas: 1.1, limitingAA: 'none', rsFraction: 0, fa: [0.62, 0.27, 0.04], mctFraction: 0.065, polyphenols: 0, nova: 3, state: 'processed', plant: false },
  meat: { label: 'Red Meat', color: '#f87171', matrix: 0.97, ileal: 0.95, diaas: 1.1, limitingAA: 'none', rsFraction: 0, fa: [0.4, 0.44, 0.05], mctFraction: 0, polyphenols: 0, nova: 1, state: 'cooked', plant: false },
  poultry: { label: 'Poultry', color: '#fb923c', matrix: 0.97, ileal: 0.95, diaas: 1.08, limitingAA: 'none', rsFraction: 0, fa: [0.29, 0.42, 0.22], mctFraction: 0, polyphenols: 0, nova: 1, state: 'cooked', plant: false },
  processed_meat: { label: 'Processed Meat', color: '#e11d48', matrix: 0.975, ileal: 0.93, diaas: 0.95, limitingAA: 'none', rsFraction: 0, fa: [0.37, 0.46, 0.12], mctFraction: 0, polyphenols: 0, nova: 4, state: 'processed', plant: false },
  fish: { label: 'Fish', color: '#38bdf8', matrix: 0.97, ileal: 0.95, diaas: 1.05, limitingAA: 'none', rsFraction: 0, fa: [0.22, 0.36, 0.34], mctFraction: 0, polyphenols: 0, nova: 1, state: 'cooked', plant: false },
  seafood: { label: 'Shellfish', color: '#2dd4bf', matrix: 0.97, ileal: 0.93, diaas: 1.0, limitingAA: 'none', rsFraction: 0, fa: [0.22, 0.2, 0.35], mctFraction: 0, polyphenols: 0, nova: 1, state: 'cooked', plant: false },
  legume: { label: 'Legumes', color: '#a16207', matrix: 0.85, ileal: 0.81, diaas: 0.62, limitingAA: 'sulfur', rsFraction: 0.18, fa: [0.15, 0.22, 0.5], mctFraction: 0, polyphenols: 60, nova: 1, state: 'cooked', plant: true },
  soy: { label: 'Soy Foods', color: '#ca8a04', matrix: 0.93, ileal: 0.91, diaas: 0.9, limitingAA: 'sulfur', rsFraction: 0.05, fa: [0.15, 0.22, 0.56], mctFraction: 0, polyphenols: 40, nova: 1, state: 'cooked', plant: true },
  grain_whole: { label: 'Whole Grains', color: '#d97706', matrix: 0.93, ileal: 0.86, diaas: 0.55, limitingAA: 'lysine', rsFraction: 0.04, fa: [0.18, 0.32, 0.42], mctFraction: 0, polyphenols: 40, nova: 1, state: 'cooked', plant: true },
  grain_refined: { label: 'Refined Grains', color: '#fcd34d', matrix: 0.98, ileal: 0.91, diaas: 0.45, limitingAA: 'lysine', rsFraction: 0.025, fa: [0.2, 0.25, 0.5], mctFraction: 0, polyphenols: 5, nova: 3, state: 'cooked', plant: true },
  tuber: { label: 'Tubers', color: '#b45309', matrix: 0.95, ileal: 0.83, diaas: 0.75, limitingAA: 'sulfur', rsFraction: 0.04, fa: [0.25, 0.05, 0.45], mctFraction: 0, polyphenols: 30, nova: 1, state: 'cooked', plant: true },
  vegetable: { label: 'Vegetables', color: '#4ade80', matrix: 0.9, ileal: 0.75, diaas: 0.55, limitingAA: 'sulfur', rsFraction: 0, fa: [0.15, 0.08, 0.45], mctFraction: 0, polyphenols: 60, nova: 1, state: 'raw', plant: true },
  fruit: { label: 'Fruits', color: '#f472b6', matrix: 0.95, ileal: 0.75, diaas: 0.4, limitingAA: 'lysine', rsFraction: 0, fa: [0.2, 0.25, 0.35], mctFraction: 0, polyphenols: 120, nova: 1, state: 'raw', plant: true },
  nut: { label: 'Nuts', color: '#c2410c', matrix: 0.8, ileal: 0.85, diaas: 0.45, limitingAA: 'lysine', rsFraction: 0, fa: [0.1, 0.6, 0.25], mctFraction: 0, polyphenols: 150, nova: 1, state: 'raw', plant: true },
  seed: { label: 'Seeds', color: '#84cc16', matrix: 0.84, ileal: 0.84, diaas: 0.55, limitingAA: 'lysine', rsFraction: 0, fa: [0.12, 0.3, 0.52], mctFraction: 0, polyphenols: 150, nova: 1, state: 'raw', plant: true },
  nut_butter: { label: 'Nut & Seed Butters', color: '#ea580c', matrix: 0.96, ileal: 0.88, diaas: 0.45, limitingAA: 'lysine', rsFraction: 0, fa: [0.15, 0.5, 0.3], mctFraction: 0, polyphenols: 80, nova: 3, state: 'processed', plant: true },
  oil: { label: 'Oils', color: '#bef264', matrix: 0.985, ileal: 0.9, diaas: 0, limitingAA: 'none', rsFraction: 0, fa: [0.15, 0.6, 0.2], mctFraction: 0, polyphenols: 2, nova: 2, state: 'processed', plant: true },
  animal_fat: { label: 'Animal Fats', color: '#fef08a', matrix: 0.97, ileal: 0.9, diaas: 0, limitingAA: 'none', rsFraction: 0, fa: [0.55, 0.32, 0.06], mctFraction: 0.05, polyphenols: 0, nova: 2, state: 'processed', plant: false },
  fungi: { label: 'Fungi & Algae', color: '#a78bfa', matrix: 0.9, ileal: 0.8, diaas: 0.65, limitingAA: 'sulfur', rsFraction: 0, fa: [0.2, 0.2, 0.5], mctFraction: 0, polyphenols: 50, nova: 1, state: 'cooked', plant: true },
  sweet: { label: 'Sweets & Sugars', color: '#f9a8d4', matrix: 0.98, ileal: 0.85, diaas: 0.35, limitingAA: 'lysine', rsFraction: 0, fa: [0.58, 0.32, 0.05], mctFraction: 0, polyphenols: 10, nova: 4, state: 'processed', plant: true },
  ultra_processed: { label: 'Ultra-Processed', color: '#94a3b8', matrix: 0.985, ileal: 0.9, diaas: 0.6, limitingAA: 'lysine', rsFraction: 0.01, fa: [0.35, 0.38, 0.22], mctFraction: 0, polyphenols: 5, nova: 4, state: 'processed', plant: false },
  beverage: { label: 'Beverages', color: '#60a5fa', matrix: 0.995, ileal: 0.9, diaas: 0.5, limitingAA: 'none', rsFraction: 0, fa: [0.3, 0.4, 0.2], mctFraction: 0, polyphenols: 20, nova: 3, state: 'processed', plant: true },
  supplement: { label: 'Supplements & Isolates', color: '#c084fc', matrix: 0.99, ileal: 0.95, diaas: 1.0, limitingAA: 'none', rsFraction: 0, fa: [0.3, 0.3, 0.3], mctFraction: 0, polyphenols: 0, nova: 4, state: 'processed', plant: false },
};

/* ============================================================================
 * 3. PREPARATION MODIFIERS
 * ========================================================================== */

export const PREP_LABELS: Record<PrepMethod, string> = {
  as_listed: 'As listed',
  raw: 'Raw',
  cooked: 'Cooked (boiled / steamed)',
  cooled: 'Boiled & cooled — retrograded RS',
  refined: 'Finely ground / blended / refined',
  roasted: 'Roasted / dry heat',
};

const STARCHY: FoodCategory[] = ['legume', 'grain_whole', 'grain_refined', 'tuber'];
const PRODUCE: FoodCategory[] = ['vegetable', 'fruit', 'fungi'];

export function prepOptionsFor(food: FoodItem): PrepMethod[] {
  const c = food.category;
  if (c === 'egg') return ['as_listed', 'raw', 'cooked'];
  if (STARCHY.includes(c)) return ['as_listed', 'cooled', 'refined'];
  if (PRODUCE.includes(c)) return ['as_listed', 'raw', 'cooked', 'refined'];
  if (c === 'nut' || c === 'seed') return ['as_listed', 'roasted', 'refined'];
  if (c === 'soy') return ['as_listed', 'refined'];
  return ['as_listed'];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Applies a preparation method to a food. Modifiers are relative to the state
 * in which the food's nutrient values were measured (`food.state`).
 */
export function applyPrep(food: FoodItem, prep: PrepMethod): FoodItem {
  if (prep === 'as_listed') return food;
  const f: FoodItem = { ...food };
  switch (prep) {
    case 'raw': {
      if (food.state === 'raw') return food;
      if (food.category === 'egg') {
        // Evenepoel 1998: raw egg protein ileal digestibility 51–65 %, cooked 91–94 %.
        f.ileal = 0.55;
        f.diaas = food.diaas * (0.55 / food.ileal);
      } else {
        // Intact, unsoftened cell walls: lower bioaccessibility.
        f.matrix = clamp(food.matrix - 0.03, 0.6, 0.995);
        f.ileal = clamp(food.ileal - 0.05, 0.4, 0.98);
      }
      f.state = 'raw';
      break;
    }
    case 'cooked': {
      if (food.state === 'cooked') return food;
      if (food.category === 'egg') {
        f.ileal = Math.max(food.ileal, 0.92);
        f.diaas = Math.min(1.13, food.diaas * (f.ileal / food.ileal));
      } else {
        // Pectin solubilisation & cell separation increase release.
        f.matrix = clamp(food.matrix + 0.025, 0.6, 0.995);
        f.ileal = clamp(food.ileal + 0.04, 0.4, 0.98);
      }
      f.state = 'cooked';
      break;
    }
    case 'cooled': {
      // Amylose retrogradation (RS3) on cooling at 4 °C for ≥ 12 h.
      const starch = Math.max(0, food.carbs - food.sugars - food.rs);
      f.rs = Math.min(food.carbs, food.rs + 0.08 * starch);
      break;
    }
    case 'refined': {
      // Milling / blending ruptures cell walls: lipid & starch become bioaccessible (Gebauer 2016).
      f.matrix = food.matrix < 0.985 ? food.matrix + (0.985 - food.matrix) * 0.8 : food.matrix;
      f.rs = food.rs * 0.6;
      f.ileal = food.ileal < 0.95 ? food.ileal + (0.95 - food.ileal) * 0.3 : food.ileal;
      f.nova = Math.min(4, food.nova + 1) as NovaGroup;
      f.state = 'processed';
      break;
    }
    case 'roasted': {
      // Dry heat embrittles cell walls (+ release) but Maillard reactions damage lysine.
      f.matrix = food.matrix + (0.985 - food.matrix) * 0.15;
      f.ileal = clamp(food.ileal - 0.01, 0.4, 0.98);
      f.diaas = food.diaas * 0.97;
      f.state = 'cooked';
      break;
    }
  }
  return f;
}

/* ============================================================================
 * 4. STAGE 1 → 2 : ABSORPTION (food matrix, ileal barrier, colonic escape)
 * ========================================================================== */

export function atwaterKcal(food: FoodItem, grams = 100): number {
  const k = grams / 100;
  return (
    k *
    (ATWATER.protein * food.protein +
      ATWATER.carbohydrate * (food.carbs + food.fiber) +
      ATWATER.fat * food.fat +
      ATWATER.alcohol * food.alcohol +
      ATWATER.polyols * food.polyols)
  );
}

const emptyLimiting = (): Record<LimitingAA, number> => ({
  lysine: 0,
  sulfur: 0,
  tryptophan: 0,
  threonine: 0,
  leucine: 0,
  none: 0,
});

/**
 * Fraction of ingested protein absorbed as amino acids: the more limiting of the
 * matrix barrier and enzymatic (true ileal) digestibility.
 */
export function proteinAbsorptionFraction(food: FoodItem): number {
  return Math.min(food.matrix, food.ileal);
}

/** Absorbs `grams` of a food → AbsorbedProfile (stage-2 intermediate). */
export function absorb(food: FoodItem, grams: number): AbsorbedProfile {
  const k = grams / 100;
  const m = clamp(food.matrix, 0.5, 1);

  const P = food.protein * k;
  const F = food.fat * k;
  const C = food.carbs * k;
  const fib = food.fiber * k;
  const rs = Math.min(food.rs, food.carbs) * k;
  const A = food.alcohol * k;
  const pol = food.polyols * k;

  // Protein
  const pFrac = proteinAbsorptionFraction(food);
  const absProtein = P * pFrac;

  // Lipid: released from the matrix fraction m
  const absFat = F * m;

  // Carbohydrate: digestible starch/sugar; encapsulated starch escapes at half the lipid rate
  const digestible = Math.max(0, C - rs);
  const carbFrac = 1 - (1 - m) * STARCH_ENCAPSULATION_RATIO;
  const absCarbs = digestible * carbFrac;
  const escapedStarch = digestible - absCarbs;

  // Fatty-acid classes, absorbed in proportion to fat release
  const sfaLong = Math.max(0, food.sfa - food.mct) * k * m;
  const mct = food.mct * k * m;
  const mufa = food.mufa * k * m;
  const pufa = food.pufa * k * m;

  const byLimiting = emptyLimiting();
  byLimiting[food.limitingAA] = absProtein;

  const profile: AbsorbedProfile = {
    grams,
    labelProtein: P,
    labelFat: F,
    labelCarbsTotal: C + fib,
    labelAlcohol: A,
    labelPolyols: pol,
    atwaterKcal: atwaterKcal(food, grams),
    absProtein,
    absFat,
    absCarbs,
    absAlcohol: A,
    absPolyols: pol,
    colonicSubstrate: fib + rs + escapedStarch,
    fecalFat: F - absFat,
    fecalProtein: P - absProtein,
    absSfaLong: sfaLong,
    absMct: mct,
    absMufa: mufa,
    absPufa: pufa,
    diaasWeighted: absProtein * food.diaas,
    proteinByLimiting: byLimiting,
    polyphenolsMg: food.polyphenols * k,
    novaTefKcal: 0,
    fiber: fib,
    rs,
  };
  profile.novaTefKcal = stage2Kcal(profile) * NOVA_TEF[food.nova];
  return profile;
}

/**
 * Protein energy at stage 2. The Atwater 4 kcal/g already assumes 92 % digestibility,
 * so energy per absorbed gram is 4 / 0.92; it is capped at the label value.
 */
export function proteinMEKcal(p: AbsorbedProfile): number {
  return Math.min(p.labelProtein * ATWATER.protein, (p.absProtein * ME.protein) / ATWATER_REFERENCE_PROTEIN_DIGESTIBILITY);
}

export function stage2Kcal(p: AbsorbedProfile): number {
  return (
    proteinMEKcal(p) +
    p.absFat * ME.fat +
    p.absCarbs * ME.carbohydrate +
    p.colonicSubstrate * ME.colonic +
    p.absAlcohol * ME.alcohol +
    p.absPolyols * ME.polyols
  );
}

/** Sums absorbed profiles (meal = Σ foods). Protein energy is re-summed per food to keep the cap per food. */
export function sumProfiles(profiles: AbsorbedProfile[]): AbsorbedProfile & { proteinMEOverride: number } {
  const out = absorb(EMPTY_FOOD, 0) as AbsorbedProfile & { proteinMEOverride: number };
  out.proteinMEOverride = 0;
  for (const p of profiles) {
    out.grams += p.grams;
    out.labelProtein += p.labelProtein;
    out.labelFat += p.labelFat;
    out.labelCarbsTotal += p.labelCarbsTotal;
    out.labelAlcohol += p.labelAlcohol;
    out.labelPolyols += p.labelPolyols;
    out.atwaterKcal += p.atwaterKcal;
    out.absProtein += p.absProtein;
    out.absFat += p.absFat;
    out.absCarbs += p.absCarbs;
    out.absAlcohol += p.absAlcohol;
    out.absPolyols += p.absPolyols;
    out.colonicSubstrate += p.colonicSubstrate;
    out.fecalFat += p.fecalFat;
    out.fecalProtein += p.fecalProtein;
    out.absSfaLong += p.absSfaLong;
    out.absMct += p.absMct;
    out.absMufa += p.absMufa;
    out.absPufa += p.absPufa;
    out.diaasWeighted += p.diaasWeighted;
    (Object.keys(p.proteinByLimiting) as LimitingAA[]).forEach((key) => {
      out.proteinByLimiting[key] += p.proteinByLimiting[key];
    });
    out.polyphenolsMg += p.polyphenolsMg;
    out.novaTefKcal += p.novaTefKcal;
    out.fiber += p.fiber;
    out.rs += p.rs;
    out.proteinMEOverride += proteinMEKcal(p);
  }
  return out;
}

const EMPTY_FOOD: FoodItem = {
  id: '__empty',
  name: 'empty',
  category: 'supplement',
  nova: 3,
  state: 'processed',
  source: 'core',
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  sugars: 0,
  rs: 0,
  alcohol: 0,
  polyols: 0,
  sfa: 0,
  mufa: 0,
  pufa: 0,
  mct: 0,
  polyphenols: 0,
  diaas: 0,
  ileal: 1,
  matrix: 1,
  limitingAA: 'none',
};

/* ============================================================================
 * 5. LIPID BIO-THERMOGENESIS INDEX
 * ========================================================================== */

export function lipidIndex(p: AbsorbedProfile): LipidIndex {
  const total = p.absSfaLong + p.absMct + p.absMufa + p.absPufa;
  const fatKcal = p.absFat * ME.fat;
  // Below ~0.5 g absorbed fat the index is not meaningful (polyphenol density diverges).
  if (total <= 1e-6 || p.absFat < 0.5) {
    return { cpt1Affinity: 0, postprandialOxidation: 0, ucpUplift: 0, thermogenicKcal: 0, storageDirectedFat: 0, index: 0 };
  }
  const s = { mct: p.absMct / total, pufa: p.absPufa / total, mufa: p.absMufa / total, sfaLong: p.absSfaLong / total };

  const cpt1 = s.mct * CPT1_AFFINITY.mct + s.pufa * CPT1_AFFINITY.pufa + s.mufa * CPT1_AFFINITY.mufa + s.sfaLong * CPT1_AFFINITY.sfaLong;
  const ppOx =
    s.mct * POSTPRANDIAL_OXIDATION.mct +
    s.pufa * POSTPRANDIAL_OXIDATION.pufa +
    s.mufa * POSTPRANDIAL_OXIDATION.mufa +
    s.sfaLong * POSTPRANDIAL_OXIDATION.sfaLong;
  const classUplift =
    s.mct * CLASS_THERMOGENESIS.mct + s.mufa * CLASS_THERMOGENESIS.mufa + s.pufa * CLASS_THERMOGENESIS.pufa;

  // Polyphenol density pooled across the whole meal (mg per 100 g absorbed fat)
  const density = (p.polyphenolsMg / p.absFat) * 100;
  const ucp = UCP_MAX_UPLIFT * (1 - Math.exp(-density / UCP_HALF_DENSITY));

  const index = clamp(0.5 * cpt1 + 0.3 * ((ppOx / POSTPRANDIAL_OXIDATION.mct) * 100) + 0.2 * ((ucp / UCP_MAX_UPLIFT) * 100), 0, 100);

  return {
    cpt1Affinity: cpt1,
    postprandialOxidation: ppOx,
    ucpUplift: ucp,
    thermogenicKcal: fatKcal * (classUplift + ucp),
    storageDirectedFat: p.absFat * (1 - ppOx),
    index,
  };
}

/* ============================================================================
 * 6. PROTEIN QUALITY & PLASTIC PARTITIONING
 * ========================================================================== */

/**
 * Meal-level complementarity: lysine-limited (cereals, nuts) and sulphur-AA-limited
 * (legumes, soy, vegetables) proteins cover each other's deficits.
 */
export function complementarityBonus(p: AbsorbedProfile, diaas: number): number {
  if (p.absProtein <= 0 || diaas >= 1) return 0;
  const lys = p.proteinByLimiting.lysine;
  const sul = p.proteinByLimiting.sulfur;
  const share = Math.min(lys, sul) / p.absProtein;
  return share * 0.6 * (1 - Math.min(1, diaas));
}

function proteinPartition(p: AbsorbedProfile, proteinME: number, ctx: AnalysisContext): ProteinPartition {
  const diaas = p.absProtein > 0 ? p.diaasWeighted / p.absProtein : 0;
  const effective = diaas + complementarityBonus(p, diaas);
  const quality = Math.min(1, effective);
  const usable = Math.min(p.absProtein * quality, ctx.bodyMassKg * MPS_SATURATION_G_PER_KG);
  const plastic = usable * PLASTIC_RETENTION[ctx.anabolicState];
  const ureaPerG = p.absProtein > 0 ? (proteinME * (1 - NME.protein / ME.protein)) / p.absProtein : 0;
  const oxidized = Math.max(0, p.absProtein - plastic);
  return {
    ingested: p.labelProtein,
    absorbed: p.absProtein,
    fecal: p.fecalProtein,
    diaas,
    effectiveDiaas: effective,
    plastic,
    oxidized,
    ureaKcal: oxidized * ureaPerG,
    synthesisKcal: plastic * PEPTIDE_SYNTHESIS_KCAL_PER_G,
  };
}

/* ============================================================================
 * 7. FULL ANALYSIS (stages 1 → 4, ATP yield, oxidative hierarchy)
 * ========================================================================== */

export const DEFAULT_CONTEXT: AnalysisContext = { anabolicState: 'maintenance', bodyMassKg: 75 };

export function analyzeProfile(p: AbsorbedProfile & { proteinMEOverride?: number }, ctx: AnalysisContext = DEFAULT_CONTEXT): BioenergeticAnalysis {
  const atwater = p.atwaterKcal;

  /* ---- Stage 2: ME post-matrix ---- */
  const meProtein = p.proteinMEOverride ?? proteinMEKcal(p);
  const meFat = p.absFat * ME.fat;
  const meCarb = p.absCarbs * ME.carbohydrate;
  const meColon = p.colonicSubstrate * ME.colonic;
  const meAlc = p.absAlcohol * ME.alcohol;
  const mePol = p.absPolyols * ME.polyols;
  const stage2 = meProtein + meFat + meCarb + meColon + meAlc + mePol;

  const lossFecalFat = p.labelFat * ATWATER.fat - meFat;
  const lossFecalProtein = p.labelProtein * ATWATER.protein - meProtein;
  const lossFibre = p.labelCarbsTotal * ATWATER.carbohydrate - meCarb - meColon;
  const lossPolyols = p.labelPolyols * ATWATER.polyols - mePol;

  /* ---- Stage 3: NME ---- */
  const protein = proteinPartition(p, meProtein, ctx);
  const lipid = lipidIndex(p);
  const ureaFull = meProtein * (1 - NME.protein / ME.protein);
  const lossCarbStorage = meCarb * (1 - NME.carbohydrate / ME.carbohydrate);
  const lossFatStorage = meFat * (1 - NME.fat / ME.fat);
  const lossFermentation = meColon * (1 - NME.colonic / ME.colonic);
  const lossAlcohol = meAlc * (1 - NME.alcohol / ME.alcohol);
  const lossPolyolsNme = mePol * (1 - NME.polyols / ME.polyols);
  const lossNova = p.novaTefKcal;
  const lossLipidThermo = lipid.thermogenicKcal;
  const stage3 =
    stage2 - ureaFull - lossCarbStorage - lossFatStorage - lossFermentation - lossAlcohol - lossPolyolsNme - lossNova - lossLipidThermo;

  /* ---- Stage 4: plastic deduction ---- */
  const nmePerAbsG = p.absProtein > 0 ? (meProtein * (NME.protein / ME.protein)) / p.absProtein : 0;
  const ureaPerAbsG = p.absProtein > 0 ? ureaFull / p.absProtein : 0;
  const plasticSequestered = protein.plastic * nmePerAbsG;
  const ureaAvoided = protein.plastic * ureaPerAbsG; // retained AA are not deaminated
  const plasticLipidG = p.absPufa * STRUCTURAL_LIPID_FRACTION.pufa + p.absMufa * STRUCTURAL_LIPID_FRACTION.mufa;
  const plasticLipidKcal = plasticLipidG * NME.fat;
  const stage4 = Math.max(0, stage3 - plasticSequestered - protein.synthesisKcal + ureaAvoided - plasticLipidKcal);

  const losses: LossItem[] = [
    { key: 'fecal_fat', label: 'Faecal lipid escape (matrix)', kcal: lossFecalFat, stage: 'matrix', description: 'Lipid trapped in intact cell walls or bound as calcium soaps, excreted unabsorbed.' },
    { key: 'fecal_protein', label: 'Undigested protein (ileal)', kcal: lossFecalProtein, stage: 'matrix', description: 'Protein escaping true ileal digestion (anti-nutrients, cell walls, Maillard damage).' },
    { key: 'fibre', label: 'Fibre & resistant-starch overcount', kcal: lossFibre, stage: 'matrix', description: 'Label counts fibre/RS at 4 kcal/g; colonic fermentation recovers only ~2 kcal/g as SCFA.' },
    { key: 'polyols', label: 'Polyol malabsorption', kcal: lossPolyols, stage: 'matrix', description: 'Sugar alcohols are partly absorbed (ME ≈ 2.4 kcal/g).' },
    { key: 'urea', label: 'Urea cycle & deamination', kcal: protein.ureaKcal, stage: 'nme', description: '≈ 4 ATP per urea + gluconeogenic/ketogenic carbon-skeleton handling of oxidised amino acids.' },
    { key: 'cho_storage', label: 'Carbohydrate handling cost', kcal: lossCarbStorage, stage: 'nme', description: 'Glycogen synthesis (2 ATP/glucosyl) and de-novo lipogenesis share of absorbed carbohydrate.' },
    { key: 'fat_storage', label: 'Lipid re-esterification cost', kcal: lossFatStorage, stage: 'nme', description: 'Chylomicron assembly and adipose re-esterification (~1 %).' },
    { key: 'fermentation', label: 'Fermentation heat & gases', kcal: lossFermentation, stage: 'nme', description: 'Microbial heat, H₂/CH₄ and bacterial biomass during SCFA production.' },
    { key: 'alcohol', label: 'Ethanol (MEOS futile cycling)', kcal: lossAlcohol, stage: 'nme', description: 'Microsomal ethanol oxidation dissipates energy as heat.' },
    { key: 'polyols_nme', label: 'Polyol fermentation', kcal: lossPolyolsNme, stage: 'nme', description: 'Colonic share of polyol energy.' },
    { key: 'nova_tef', label: 'Food-class TEF (processing)', kcal: lossNova, stage: 'nme', description: 'Whole foods (NOVA 1) demand more digestive work than ultra-processed foods (NOVA 4).' },
    { key: 'lipid_thermo', label: 'Lipid uncoupling & thermogenesis', kcal: lossLipidThermo, stage: 'nme', description: 'MCFA rapid oxidation, MUFA thermogenesis and polyphenol-driven UCP1/UCP3 proton leak.' },
    { key: 'plastic_protein', label: 'Plastic amino acids (tissue)', kcal: plasticSequestered - ureaAvoided, stage: 'plastic', description: 'Amino acids incorporated into myofibrillar/structural proteins instead of oxidised.' },
    { key: 'mps_cost', label: 'Peptide-bond synthesis ATP', kcal: protein.synthesisKcal, stage: 'plastic', description: '4 ATP per peptide bond (aminoacylation + elongation) to build the retained protein.' },
    { key: 'plastic_lipid', label: 'Structural lipids (membranes)', kcal: plasticLipidKcal, stage: 'plastic', description: 'PUFA/MUFA incorporated into phospholipid membranes rather than oxidised.' },
  ].filter((l) => Math.abs(l.kcal) > 0.005) as LossItem[];

  /* ---- ATP yield: apportion stage-4 fuel by substrate ---- */
  const totalFA = p.absSfaLong + p.absMct + p.absMufa + p.absPufa;
  const mctShare = totalFA > 0 ? p.absMct / totalFA : 0;
  const raw = [
    { substrate: 'Carbohydrate (glucose)', kcal: meCarb * (NME.carbohydrate / ME.carbohydrate), atp: ATP_PER_KCAL.carbohydrate },
    { substrate: 'Long-chain fatty acids', kcal: Math.max(0, meFat * (1 - mctShare) * (NME.fat / ME.fat) - plasticLipidKcal), atp: ATP_PER_KCAL.lcfa },
    { substrate: 'Medium-chain fatty acids', kcal: meFat * mctShare * (NME.fat / ME.fat), atp: ATP_PER_KCAL.mct },
    { substrate: 'Amino acids (oxidised)', kcal: protein.oxidized * nmePerAbsG, atp: ATP_PER_KCAL.aminoAcids },
    { substrate: 'SCFA (colonic)', kcal: meColon * (NME.colonic / ME.colonic), atp: ATP_PER_KCAL.scfa },
    { substrate: 'Ethanol', kcal: meAlc * (NME.alcohol / ME.alcohol), atp: ATP_PER_KCAL.alcohol },
    { substrate: 'Polyols', kcal: mePol * (NME.polyols / ME.polyols), atp: ATP_PER_KCAL.polyols },
  ];
  const rawSum = raw.reduce((s, r) => s + r.kcal, 0);
  const scale = rawSum > 0 ? stage4 / rawSum : 0;
  const bySubstrate = raw
    .map((r) => ({ substrate: r.substrate, kcal: r.kcal * scale, mol: r.kcal * scale * r.atp }))
    .filter((r) => r.kcal > 0.01);
  const mol = bySubstrate.reduce((s, r) => s + r.mol, 0);
  const atp: AtpYield = {
    mol,
    grams: mol * ATP_MOLAR_MASS,
    bySubstrate,
    captureEfficiency: stage4 > 0 ? (mol * ATP_DELTA_G_STANDARD) / stage4 : 0,
  };

  /* ---- Oxidative priority hierarchy (no storage capacity → first oxidised) ---- */
  const kcalOf = (name: string) => bySubstrate.find((b) => b.substrate === name)?.kcal ?? 0;
  const oxidativeHierarchy = [
    { substrate: 'Alcohol', kcal: kcalOf('Ethanol'), priority: 1, fate: 'No storage pool — obligatory hepatic oxidation, suppresses all other fuel use.' },
    { substrate: 'MCT / ketogenic MCFA', kcal: kcalOf('Medium-chain fatty acids'), priority: 2, fate: 'Portal route, CPT-1 independent — rapid β-oxidation / ketogenesis.' },
    { substrate: 'Excess amino acids', kcal: kcalOf('Amino acids (oxidised)'), priority: 3, fate: 'No storage pool — deaminated, carbon skeletons to gluconeogenesis/TCA.' },
    { substrate: 'Carbohydrate', kcal: kcalOf('Carbohydrate (glucose)') + kcalOf('Polyols') + kcalOf('SCFA (colonic)'), priority: 4, fate: 'Limited glycogen buffer (~400–500 g) — oxidation rises to match intake.' },
    { substrate: 'Dietary long-chain fat', kcal: kcalOf('Long-chain fatty acids'), priority: 5, fate: 'Near-unlimited adipose storage — oxidised last, preferentially stored postprandially.' },
  ];

  return {
    stages: [
      { key: 'atwater', label: 'Atwater Label', kcal: atwater },
      { key: 'absorbed', label: 'Digestible Absorbed', kcal: stage2 },
      { key: 'nme', label: 'Livesey NME', kcal: stage3 },
      { key: 'fuel', label: 'Net Mitochondrial Fuel', kcal: stage4 },
    ],
    losses,
    matrixCoefficient: atwater > 0 ? stage2 / atwater : 0,
    protein,
    lipid,
    atp,
    cellularRatio: atwater > 0 ? stage4 / atwater : 0,
    macros: { protein: p.labelProtein, fat: p.labelFat, carbs: p.labelCarbsTotal - p.fiber, fiber: p.fiber, alcohol: p.labelAlcohol },
    oxidativeHierarchy,
    plasticLipid: plasticLipidG,
  };
}

/** Analyse one food at a given weight & preparation. */
export function analyzeFood(food: FoodItem, grams = 100, prep: PrepMethod = 'as_listed', ctx: AnalysisContext = DEFAULT_CONTEXT): BioenergeticAnalysis {
  return analyzeProfile(absorb(applyPrep(food, prep), grams), ctx);
}

/** Analyse a meal: foods are absorbed individually, then partitioned jointly (complementarity, pooled polyphenols, MPS cap). */
export function analyzeMeal(entries: MealEntry[], ctx: AnalysisContext = DEFAULT_CONTEXT): BioenergeticAnalysis {
  const profiles = entries.map((e) => absorb(applyPrep(e.food, e.prep), e.grams));
  return analyzeProfile(sumProfiles(profiles), ctx);
}

/* ============================================================================
 * 8. BIOENERGETIC INFERENCE ENGINE — for foods from USDA / OpenFoodFacts
 * ========================================================================== */

export interface ExternalNutrients {
  id: string;
  name: string;
  brand?: string;
  source: 'usda' | 'off';
  /** Database category text (USDA foodCategory / OFF categories) */
  categoryHint?: string;
  dataType?: string;
  nova?: NovaGroup;
  energyKcal?: number;
  protein?: number;
  fat?: number;
  /** Total carbohydrate by difference, INCLUDING fibre (USDA convention) */
  carbsTotal?: number;
  /** Carbohydrate whose fibre convention is unknown (OpenFoodFacts) — resolved by energy closure */
  carbsAmbiguous?: number;
  fiber?: number;
  sugars?: number;
  sfa?: number;
  mufa?: number;
  pufa?: number;
  alcohol?: number;
  polyols?: number;
  water?: number;
}

type Rule = [FoodCategory, RegExp];

/** Ordered keyword rules: first match wins. */
const CATEGORY_RULES: Rule[] = [
  ['supplement', /\b(whey|casein|protein (powder|isolate|shake)|collagen|gelatin|pea protein|soy protein isolate|creatine|mass gainer|spirulina tablet)/],
  ['nut_butter', /\b(peanut butter|almond butter|cashew butter|nut butter|hazelnut (spread|butter)|tahini|sesame paste|sunflower (seed )?butter)/],
  ['beverage', /\b(soda|cola|juice|beer|wine|ale|lager|spirits?|whisk(e)?y|vodka|coffee|tea\b|drink|beverage|smoothie|lemonade|kombucha|(almond|oat|rice|coconut) (milk|drink))/],
  ['ultra_processed', /\b(chips|crisps|cookie|biscuit|cake|doughnut|donut|candy|pizza|burger|nugget|snack|frozen meal|instant noodle|ramen|cracker|pretzel|popcorn|muffin|pastry|croissant|waffle|pancake mix|hot pocket|fries|french fried|breakfast cereal|cereal bar|granola bar|protein bar)/],
  ['sweet', /\b(chocolate|sugar|honey|syrup|jam|jelly|marmalade|ice cream|dessert|caramel|nutella|candy|confection|cocoa)/],
  ['processed_meat', /\b(bacon|sausage|salami|ham\b|hot ?dog|frankfurter|pepperoni|jerky|deli|bologna|prosciutto|chorizo|mortadella|bresaola|pastrami|corned|luncheon)/],
  ['fish', /\b(salmon|tuna|cod|sardine|mackerel|trout|anchov|herring|tilapia|halibut|haddock|sea ?bass|swordfish|pollock|catfish|fish)/],
  ['seafood', /\b(shrimp|prawn|crab|lobster|mussel|clam|oyster|scallop|squid|octopus|calamari|crayfish)/],
  ['egg', /\b(eggs?|egg white|egg yolk|omelet(te)?)\b/],
  ['cheese', /\b(cheese|parmesan|parmigiano|cheddar|mozzarella|feta|ricotta|brie|gouda|camembert|pecorino|gorgonzola|halloumi|mascarpone|emmental)/],
  ['soy', /\b(tofu|tempeh|edamame|soy|soya|miso|natto|seitan)/],
  ['dairy', /\b(milk|yogh?urt|kefir|cream|skyr|quark|buttermilk|whey)/],
  ['oil', /^oil\b|\boil$|\boil,|\b(margarine|shortening)\b|\b(olive|coconut|mct|sunflower|canola|rapeseed|vegetable|avocado|sesame|flaxseed|linseed|palm|corn|soybean|peanut|walnut|grapeseed|rice bran) oil\b/],
  ['animal_fat', /\b(butter|lard|tallow|ghee|suet|dripping|duck fat)\b/],
  ['nut', /\b(almonds?|walnuts?|cashews?|pistachios?|hazelnuts?|pecans?|macadamias?|brazil nuts?|peanuts?|pine nuts?|nuts?)\b/],
  ['seed', /\b(seeds?|chia|flax|linseed|sesame|hemp heart|hemp seed)/],
  ['meat', /\b(beef|steak|pork|lamb|veal|venison|goat|bison|liver|mutton|rabbit|ground meat|mince)/],
  ['poultry', /\b(chicken|turkey|duck|goose|quail|poultry)/],
  ['legume', /\b(lentils?|beans?|chickpeas?|garbanzo|split peas?|peas\b|hummus|houmous|lupin|legumes?|dal|dhal|falafel|fava|cowpea)/],
  ['tuber', /\b(potato(es)?|sweet potato|yam|cassava|taro|tapioca|plantain|manioc)/],
  ['grain_whole', /\b(whole ?wheat|wholemeal|whole ?grain|wholegrain|brown rice|oats?|oatmeal|porridge|quinoa|buckwheat|barley|millet|spelt|farro|bulgur|bulgar|rye|black rice|wild rice|sorghum|teff|amaranth)/],
  ['grain_refined', /\b(white rice|rice|bread|baguette|pasta|spaghetti|penne|macaroni|noodles?|flour|couscous|bagel|tortilla|cereal|corn ?flakes|polenta|semolina|gnocchi|pita)/],
  ['fungi', /\b(mushrooms?|yeast|spirulina|chlorella|seaweed|algae|kelp|nori|wakame|truffle)/],
  ['fruit', /\b(apples?|bananas?|oranges?|berry|berries|grapes?|mango|pears?|peach|plums?|cherr(y|ies)|kiwi|melon|pineapple|dates?|figs?|fruit|avocado|apricot|lemon|lime|papaya|pomegranate|raisins?|prunes?|watermelon|nectarine|clementine|tangerine|coconut)/],
  ['vegetable', /\b(broccoli|spinach|kale|carrots?|tomato(es)?|lettuce|cabbage|onions?|garlic|peppers?|zucchini|courgette|cucumber|celery|cauliflower|asparagus|artichoke|beets?|beetroot|eggplant|aubergine|squash|pumpkin|vegetables?|salad|leek|radish|green beans?|olives?|arugula|rocket|chard|fennel|okra|brussels)/],
];

const USDA_CATEGORY_MAP: [RegExp, FoodCategory][] = [
  [/dairy and egg/i, 'dairy'],
  [/legume/i, 'legume'],
  [/fats and oils/i, 'oil'],
  [/nut and seed/i, 'nut'],
  [/beef|pork|lamb|veal|game/i, 'meat'],
  [/poultry/i, 'poultry'],
  [/finfish|shellfish|fish/i, 'fish'],
  [/vegetable/i, 'vegetable'],
  [/fruit/i, 'fruit'],
  [/cereal grains|pasta|baked/i, 'grain_refined'],
  [/breakfast cereal|snack|fast food|restaurant|meals, entrees|candy|confection/i, 'ultra_processed'],
  [/sweets/i, 'sweet'],
  [/beverage/i, 'beverage'],
  [/sausage|luncheon/i, 'processed_meat'],
];

export function classifyCategory(name: string, hint = '', macros?: { protein: number; fat: number; carbs: number }): { category: FoodCategory; matched: boolean } {
  const text = `${name}`.toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return { category: cat, matched: true };
  const hintText = hint.toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) if (re.test(hintText)) return { category: cat, matched: true };
  for (const [re, cat] of USDA_CATEGORY_MAP) if (re.test(hint)) return { category: cat, matched: true };
  if (macros) {
    if (macros.fat > 80) return { category: 'oil', matched: false };
    if (macros.protein > 60) return { category: 'supplement', matched: false };
  }
  return { category: 'ultra_processed', matched: false };
}

export function inferNova(name: string, category: FoodCategory, source: 'usda' | 'off', dataType?: string): NovaGroup {
  const t = name.toLowerCase();
  if (/(chips|crisps|cookie|cake|doughnut|candy|soda|cola|nugget|hot ?dog|instant|flavou?red|sweetened|frosted|\bbar\b|margarine|ice cream|frozen meal|pizza|burger|sausage|breaded|cereal|energy drink|spread)/.test(t)) return 4;
  if (/(canned|cheese|bread|cured|smoked|salted|pickled|in oil|in brine|in syrup|jam|beer|wine|tofu)/.test(t)) return 3;
  if (/(\boil\b|butter|sugar|honey|\bsalt\b|vinegar|lard|syrup)/.test(t)) return 2;
  if (/(raw|boiled|steamed|cooked|roasted|baked|grilled|fresh|dried|frozen|plain|whole)/.test(t)) return 1;
  if (source === 'usda' && dataType === 'Branded') return Math.max(3, CATEGORY_META[category].nova) as NovaGroup;
  return CATEGORY_META[category].nova;
}

const POLYPHENOL_KEYWORDS: [RegExp, number][] = [
  [/(high.?polyphenol|early harvest).*(olive)|olive.*(high.?polyphenol|early harvest)/, 80],
  [/extra.?virgin/, 30],
  [/olive oil/, 5],
  [/cocoa powder|cacao powder/, 2000],
  [/dark chocolate|(7|8|9)\d ?% (cocoa|cacao)/, 1200],
  [/chocolate/, 300],
  [/blueberr|bilberr|aronia|elderberr/, 300],
  [/blackberr|blackcurrant/, 260],
  [/raspberr/, 220],
  [/strawberr/, 200],
  [/cherr/, 150],
  [/plum|prune/, 300],
  [/walnut|pecan/, 1500],
  [/pistachio/, 800],
  [/hazelnut/, 690],
  [/almond/, 130],
  [/green tea|matcha/, 80],
  [/coffee|espresso/, 200],
  [/red wine/, 200],
  [/black rice|venere/, 60],
  [/olive/, 160],
  [/artichoke/, 260],
  [/spinach/, 120],
  [/onion|shallot/, 50],
  [/apple/, 120],
  [/flax|linseed/, 300],
  [/buckwheat/, 60],
  [/black bean/, 100],
];

/** Converts external nutrient data into a fully parameterised FoodItem. */
export function inferFood(ext: ExternalNutrients): FoodItem {
  const inferred: string[] = [];
  let confidence = 0.5;
  const protein = ext.protein ?? 0;
  const fat = ext.fat ?? 0;
  const fiber = ext.fiber ?? 0;
  if (ext.fiber === undefined) inferred.push('fiber');
  else confidence += 0.1;

  // --- available carbohydrate ---
  let carbs: number;
  if (ext.carbsTotal !== undefined) {
    carbs = Math.max(0, ext.carbsTotal - fiber);
  } else if (ext.carbsAmbiguous !== undefined) {
    // Energy-closure test: which fibre convention reproduces the declared energy best?
    const a = ext.carbsAmbiguous;
    if (ext.energyKcal && fiber > 0) {
      const eAvail = 4 * protein + 9 * fat + 4 * a + 2 * fiber;
      const eTotal = 4 * protein + 9 * fat + 4 * (a - fiber) + 2 * fiber;
      carbs = Math.abs(eAvail - ext.energyKcal) <= Math.abs(eTotal - ext.energyKcal) ? a : Math.max(0, a - fiber);
    } else carbs = a;
  } else {
    carbs = 0;
    inferred.push('carbs');
  }

  const { category, matched } = classifyCategory(ext.name, ext.categoryHint, { protein, fat, carbs });
  if (matched) confidence += 0.1;
  const meta = CATEGORY_META[category];
  const lname = `${ext.name} ${ext.categoryHint ?? ''}`.toLowerCase();

  // --- NOVA ---
  let nova: NovaGroup;
  if (ext.nova) {
    nova = ext.nova;
    confidence += 0.1;
  } else {
    nova = inferNova(ext.name, category, ext.source, ext.dataType);
    inferred.push('nova');
  }

  // --- state ---
  let state: FoodState = meta.state;
  if (/\braw\b|uncooked/.test(lname)) state = 'raw';
  else if (/(cooked|boiled|baked|roasted|grilled|fried|steamed|braised|stewed|poached|scrambled)/.test(lname)) state = 'cooked';
  else if (nova >= 3) state = 'processed';

  // --- sugars ---
  let sugars: number;
  if (ext.sugars !== undefined) {
    sugars = ext.sugars;
    confidence += 0.05;
  } else {
    sugars = category === 'fruit' ? carbs * 0.85 : carbs * 0.15;
    inferred.push('sugars');
  }

  // --- fatty acids ---
  let sfa = ext.sfa;
  let mufa = ext.mufa;
  let pufa = ext.pufa;
  const [fs, fm, fp] = meta.fa;
  if (sfa === undefined) {
    sfa = fat * fs;
    inferred.push('sfa');
  }
  if (mufa === undefined || pufa === undefined) {
    const remaining = Math.max(0, fat * (fs + fm + fp) - sfa);
    const ratio = fm / (fm + fp || 1);
    if (mufa === undefined) {
      mufa = remaining * ratio;
      inferred.push('mufa');
    }
    if (pufa === undefined) {
      pufa = Math.max(0, remaining - mufa);
      inferred.push('pufa');
    }
  } else if (ext.sfa !== undefined) confidence += 0.15;

  let mctFraction = meta.mctFraction;
  if (/\bmct\b|medium.chain|caprylic/.test(lname)) mctFraction = 0.95;
  else if (/coconut/.test(lname)) mctFraction = 0.135;
  const mct = Math.min(sfa, fat * mctFraction);
  if (mct > 0) inferred.push('mct');

  // --- resistant starch ---
  const starch = Math.max(0, carbs - sugars);
  let rsFrac = meta.rsFraction;
  if (/green banana|unripe|plantain/.test(lname)) rsFrac = 0.4;
  if (/cooled|leftover|overnight|parboiled|al dente/.test(lname)) rsFrac *= 1.6;
  if (state === 'raw' && (category === 'tuber' || category === 'legume')) rsFrac = Math.max(rsFrac, 0.5);
  const rs = Math.min(carbs, starch * rsFrac);
  inferred.push('rs');

  // --- protein quality ---
  let ileal = meta.ileal;
  let diaas = meta.diaas;
  let limitingAA: LimitingAA = meta.limitingAA;
  if (/whey/.test(lname)) [ileal, diaas, limitingAA] = [0.97, 1.09, 'none'];
  else if (/casein|milk protein/.test(lname)) [ileal, diaas, limitingAA] = [0.96, 1.18, 'none'];
  else if (/collagen|gelatin/.test(lname)) [ileal, diaas, limitingAA] = [0.95, 0, 'tryptophan'];
  else if (/pea protein/.test(lname)) [ileal, diaas, limitingAA] = [0.94, 0.82, 'sulfur'];
  else if (/soy protein/.test(lname)) [ileal, diaas, limitingAA] = [0.95, 0.9, 'sulfur'];
  else if (/rice protein/.test(lname)) [ileal, diaas, limitingAA] = [0.9, 0.47, 'lysine'];
  else if (/egg white/.test(lname)) [ileal, diaas, limitingAA] = [0.92, 1.0, 'none'];
  if (category === 'egg' && state === 'raw') [ileal, diaas] = [0.55, 0.62];
  inferred.push('diaas', 'ileal');

  // --- matrix absorption coefficient ---
  let matrix = meta.matrix;
  if (meta.plant) {
    const fiberRatio = fiber / (carbs + fiber + 1e-3);
    matrix -= clamp(0.05 * (fiberRatio - 0.15), -0.03, 0.04);
  }
  if (/(butter|paste|flour|powder|juice|pur[eé]e|\bmilk\b|drink|ground|\bmeal\b|isolate|smooth|spread|creamy)/.test(lname) && matrix < 0.985) {
    matrix += (0.985 - matrix) * 0.8;
  } else if (/roasted/.test(lname)) {
    matrix += (0.985 - matrix) * 0.15;
  }
  if (nova === 4) matrix += (0.99 - matrix) * 0.7;
  else if (nova === 3) matrix += (0.985 - matrix) * 0.3;
  matrix = clamp(matrix, 0.6, 0.995);
  inferred.push('matrix');

  // --- polyphenols ---
  let polyphenols = meta.polyphenols;
  for (const [re, mg] of POLYPHENOL_KEYWORDS) {
    if (re.test(lname)) {
      polyphenols = mg;
      break;
    }
  }
  // Formulated products contain the keyword ingredient only as a minor fraction (e.g. hazelnut in a spread).
  if (nova === 4) polyphenols *= 0.25;
  inferred.push('polyphenols');

  return {
    id: `${ext.source}-${ext.id}`,
    name: ext.name,
    brand: ext.brand,
    category,
    nova,
    state,
    source: ext.source,
    protein,
    fat,
    carbs,
    fiber,
    sugars: Math.min(sugars, carbs),
    rs,
    alcohol: ext.alcohol ?? 0,
    polyols: ext.polyols ?? 0,
    water: ext.water,
    sfa,
    mufa,
    pufa,
    mct,
    polyphenols,
    diaas,
    ileal,
    matrix,
    limitingAA,
    inferredFields: Array.from(new Set(inferred)),
    confidence: clamp(confidence, 0, 1),
  };
}

/* ============================================================================
 * 9. REPRESENTATIVE DIET (used by the Plate Exchange Rate translator)
 * ========================================================================== */

export interface DietSplit {
  proteinKcal: number;
  fatKcal: number;
  carbKcal: number;
}

/**
 * Builds a whole-day synthetic diet whose bioenergetic parameters are interpolated
 * from Diet Matrix Integrity Score 1 (ultra-processed) to 10 (whole grains, legumes,
 * eggs, fibrous vegetables, EVOO). Returned as a FoodItem with `grams = 100` meaning 1 day.
 */
export function representativeDiet(score: number, split: DietSplit): { food: FoodItem; novaTefCoeff: number } {
  const t = clamp((score - 1) / 9, 0, 1);
  const labelKcal = split.proteinKcal + split.fatKcal + split.carbKcal;
  const protein = split.proteinKcal / 4;
  const fat = split.fatKcal / 9;
  const carbsTotal = split.carbKcal / 4;
  const fiber = Math.min(carbsTotal * 0.45, (lerp(6, 24, t) * labelKcal) / 1000);
  const carbs = Math.max(0, carbsTotal - fiber);
  const sugars = carbs * lerp(0.45, 0.22, t);
  const rs = (carbs - sugars) * lerp(0.01, 0.07, t);
  const food: FoodItem = {
    id: `diet-${score}`,
    name: `Representative diet · matrix score ${score}`,
    category: 'ultra_processed',
    nova: 3,
    state: 'processed',
    source: 'core',
    protein,
    fat,
    carbs,
    fiber,
    sugars,
    rs,
    alcohol: 0,
    polyols: 0,
    sfa: fat * lerp(0.38, 0.24, t),
    mufa: fat * lerp(0.34, 0.52, t),
    pufa: fat * lerp(0.22, 0.17, t),
    mct: fat * 0.02,
    polyphenols: (lerp(80, 1400, t) * labelKcal) / 1000,
    diaas: lerp(0.8, 0.95, t),
    ileal: lerp(0.93, 0.88, t),
    matrix: lerp(0.985, 0.9, t),
    limitingAA: 'none',
  };
  return { food, novaTefCoeff: lerp(NOVA_TEF[4], NOVA_TEF[1], t) };
}

/** Absorbs a representative diet with its continuous NOVA-TEF coefficient. */
export function absorbDiet(score: number, split: DietSplit): AbsorbedProfile {
  const { food, novaTefCoeff } = representativeDiet(score, split);
  const p = absorb(food, 100);
  p.novaTefKcal = stage2Kcal(p) * novaTefCoeff;
  return p;
}

/* ============================================================================
 * 10. UTILITIES
 * ========================================================================== */

export function round(v: number, d = 0): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export function categoryLabel(c: FoodCategory): string {
  return CATEGORY_META[c].label;
}
