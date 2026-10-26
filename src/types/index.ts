/**
 * Core domain types for BioEnergetics OS.
 * All nutrient quantities are expressed per 100 g of edible food unless noted.
 */

export type FoodCategory =
  | 'egg'
  | 'dairy'
  | 'cheese'
  | 'meat'
  | 'poultry'
  | 'processed_meat'
  | 'fish'
  | 'seafood'
  | 'legume'
  | 'soy'
  | 'grain_whole'
  | 'grain_refined'
  | 'tuber'
  | 'vegetable'
  | 'fruit'
  | 'nut'
  | 'seed'
  | 'nut_butter'
  | 'oil'
  | 'animal_fat'
  | 'fungi'
  | 'sweet'
  | 'ultra_processed'
  | 'beverage'
  | 'supplement';

/** NOVA food-processing classification (Monteiro et al.). */
export type NovaGroup = 1 | 2 | 3 | 4;

/** Physical state in which the nutrient values were measured. */
export type FoodState = 'raw' | 'cooked' | 'processed';

/** Limiting indispensable amino acid (drives meal-level protein complementarity). */
export type LimitingAA = 'lysine' | 'sulfur' | 'tryptophan' | 'threonine' | 'leucine' | 'none';

export type FoodSource = 'core' | 'usda' | 'off';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  nova: NovaGroup;
  state: FoodState;
  source: FoodSource;
  brand?: string;

  /* ---- Macronutrients (g / 100 g) ---- */
  protein: number;
  fat: number;
  /** Available (glycaemic) carbohydrate, EXCLUDING dietary fibre; includes resistant starch. */
  carbs: number;
  fiber: number;
  sugars: number;
  /** Resistant starch (subset of `carbs`) that escapes small-intestinal digestion. */
  rs: number;
  alcohol: number;
  polyols: number;
  water?: number;

  /* ---- Fatty-acid classes (g / 100 g) ---- */
  sfa: number;
  mufa: number;
  pufa: number;
  /** Medium-chain fatty acids C6–C10 (subset of `sfa`). Portal absorption, CPT-1 independent. */
  mct: number;

  /** Total polyphenols, mg / 100 g (Folin or Phenol-Explorer estimate). */
  polyphenols: number;

  /* ---- Bioenergetic modifiers ---- */
  /** Digestible Indispensable Amino Acid Score (ratio, 1.00 = 100 %). */
  diaas: number;
  /** True ileal protein digestibility (0–1). */
  ileal: number;
  /** Matrix Absorption Coefficient: fraction of lipid/starch energy released from the food matrix (0–1). */
  matrix: number;
  limitingAA: LimitingAA;

  notes?: string;
  /** For inferred (external) foods: names of fields that were estimated, not measured. */
  inferredFields?: string[];
  /** For inferred foods: 0–1 confidence of the inference. */
  confidence?: number;
}

export type PrepMethod = 'as_listed' | 'raw' | 'cooked' | 'cooled' | 'refined' | 'roasted';

export interface MealEntry {
  uid: string;
  food: FoodItem;
  grams: number;
  prep: PrepMethod;
}

export type AnabolicState = 'maintenance' | 'training' | 'recovery';

export interface AnalysisContext {
  anabolicState: AnabolicState;
  bodyMassKg: number;
}

/**
 * Absorbed nutrient profile: the intermediate representation produced after the
 * food matrix / ileal barrier and before oxidative partitioning. Additive across foods.
 */
export interface AbsorbedProfile {
  grams: number;
  /* label (Atwater) inputs */
  labelProtein: number;
  labelFat: number;
  labelCarbsTotal: number; // available + fibre
  labelAlcohol: number;
  labelPolyols: number;
  atwaterKcal: number;

  /* absorbed in the small intestine (g) */
  absProtein: number;
  absFat: number;
  absCarbs: number;
  absAlcohol: number;
  absPolyols: number;
  /** Substrate reaching the colon for fermentation (fibre + resistant/escaped starch), g */
  colonicSubstrate: number;
  /** Fat lost in faeces, g */
  fecalFat: number;
  /** Protein lost in faeces / not absorbed as amino acids, g */
  fecalProtein: number;

  /* absorbed fatty acid classes (g) */
  absSfaLong: number;
  absMct: number;
  absMufa: number;
  absPufa: number;

  /** Absorbed protein x DIAAS (for weighted quality) */
  diaasWeighted: number;
  /** Absorbed protein grams grouped by limiting amino acid */
  proteinByLimiting: Record<LimitingAA, number>;
  polyphenolsMg: number;
  /** Stage-2 energy weighted by NOVA facultative-TEF coefficient (kcal) */
  novaTefKcal: number;
  fiber: number;
  rs: number;
}

export interface WaterfallStage {
  key: 'atwater' | 'absorbed' | 'nme' | 'fuel';
  label: string;
  kcal: number;
}

export interface LossItem {
  key: string;
  label: string;
  kcal: number;
  stage: 'matrix' | 'nme' | 'plastic';
  description: string;
}

export interface LipidIndex {
  /** 0–100 CPT-1 / mitochondrial entry affinity score */
  cpt1Affinity: number;
  /** Fraction of absorbed dietary fat oxidised within ~9 h postprandially (DeLany-weighted) */
  postprandialOxidation: number;
  /** Fraction of fat energy dissipated through UCP1/UCP3-linked thermogenesis */
  ucpUplift: number;
  /** kcal dissipated as lipid-specific thermogenesis */
  thermogenicKcal: number;
  /** g of absorbed fat directed to storage postprandially */
  storageDirectedFat: number;
  /** 0–100 composite index */
  index: number;
}

export interface ProteinPartition {
  ingested: number;
  absorbed: number;
  fecal: number;
  diaas: number;
  /** DIAAS after meal-level amino-acid complementarity */
  effectiveDiaas: number;
  plastic: number;
  oxidized: number;
  /** kcal lost to urea cycle / deamination / gluconeogenesis */
  ureaKcal: number;
  /** kcal spent synthesising peptide bonds for the plastic fraction */
  synthesisKcal: number;
}

export interface AtpYield {
  mol: number;
  /** grams of ATP regenerated (MW 507.18) */
  grams: number;
  bySubstrate: { substrate: string; kcal: number; mol: number }[];
  /** Fraction of fuel energy captured in ATP phosphoanhydride bonds (ΔG°' basis) */
  captureEfficiency: number;
}

export interface BioenergeticAnalysis {
  stages: WaterfallStage[];
  losses: LossItem[];
  matrixCoefficient: number;
  protein: ProteinPartition;
  lipid: LipidIndex;
  atp: AtpYield;
  /** Fuel / Atwater ratio */
  cellularRatio: number;
  macros: { protein: number; fat: number; carbs: number; fiber: number; alcohol: number };
  oxidativeHierarchy: { substrate: string; kcal: number; priority: number; fate: string }[];
  plasticLipid: number;
}
