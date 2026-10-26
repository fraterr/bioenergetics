/**
 * ============================================================================
 *  BioEnergetics OS — True Cellular BMR & ATP-TDEE Engine
 * ============================================================================
 *
 *  Standard TDEE = BMR × activity factor, then compared with Atwater label
 *  calories. This engine instead:
 *   1. Computes the Net Cellular ATP Demand (energy actually oxidised to
 *      regenerate ATP) from tissue-level metabolic rates and mechanical work.
 *   2. Converts that demand back to the LABEL calories needed on the plate,
 *      through the same Atwater → NME pipeline used for foods, as a function of
 *      the diet's Matrix Integrity Score and the feeding regimen.
 *
 *  References
 *   - Katch & McArdle (1996); Cunningham JJ (1991) Am J Clin Nutr 54:963.
 *   - Mifflin MD et al. (1990) Am J Clin Nutr 51:241.
 *   - Elia M (1992) Organ and tissue contribution to metabolic rate. In: Energy Metabolism.
 *   - Wang Z et al. (2010) Am J Clin Nutr 92:1369 — specific organ metabolic rates.
 *   - Janssen I et al. (2000) J Appl Physiol 89:81 — skeletal muscle mass.
 *   - Ainsworth BE et al. (2011) Compendium of Physical Activities.
 *   - Melby C et al. (1993) J Appl Physiol 75:1847; Schuenke MD et al. (2002) EJAP 86:411 — RT EPOC.
 *   - Phillips SM et al. (1997) Am J Physiol 273:E99 — MPS elevation up to 48 h after RT.
 *   - Tai MM et al. (1991) Am J Clin Nutr 54:783 — meal frequency & TEF.
 *   - Romon M et al. (1993) Am J Physiol 265:E191; Morris CJ et al. (2015) Obesity 23:2053 — circadian TEF.
 * ============================================================================
 */

import {
  ATP_MOLAR_MASS,
  ATP_PER_PEPTIDE_BOND,
  KCAL_PER_MOL_ATP,
  MEAN_RESIDUE_MASS,
  absorbDiet,
  analyzeProfile,
  stage2Kcal,
  type DietSplit,
} from './bioenergeticsEngine';

export type Sex = 'male' | 'female';
export type BmrModel = 'organ' | 'katch' | 'cunningham' | 'mifflin';
export type Occupation = 'desk' | 'mixed' | 'standing' | 'manual';
export type RtIntensity = 'moderate' | 'high' | 'failure';
export type TrainingStatus = 'novice' | 'intermediate' | 'advanced';
export type MealTiming = 'morning' | 'balanced' | 'evening';

export interface MetabolicInput {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  bodyFatPct: number;
  bmrModel: BmrModel;
  steps: number;
  occupation: Occupation;
  rtSessionsPerWeek: number;
  rtSessionMinutes: number;
  rtIntensity: RtIntensity;
  rtSetsPerSession: number;
  trainingStatus: TrainingStatus;
  cardioMinutesPerWeek: number;
  cardioMet: number;
  mealsPerDay: number;
  mealTiming: MealTiming;
  matrixScore: number;
  proteinGPerKg: number;
  fatPct: number;
}

export const DEFAULT_METABOLIC_INPUT: MetabolicInput = {
  sex: 'male',
  age: 35,
  weightKg: 78,
  heightCm: 178,
  bodyFatPct: 16,
  bmrModel: 'organ',
  steps: 8000,
  occupation: 'desk',
  rtSessionsPerWeek: 3,
  rtSessionMinutes: 60,
  rtIntensity: 'failure',
  rtSetsPerSession: 16,
  trainingStatus: 'intermediate',
  cardioMinutesPerWeek: 60,
  cardioMet: 7,
  mealsPerDay: 3,
  mealTiming: 'balanced',
  matrixScore: 8,
  proteinGPerKg: 1.8,
  fatPct: 0.32,
};

/* ------------------------------------------------------------------ constants */

/** Elia (1992) specific metabolic rates, kcal / kg / day. */
export const ORGAN_SMR = {
  brain: 240,
  liver: 200,
  heart: 440,
  kidneys: 440,
  skeletalMuscle: 13,
  adipose: 4.5,
  residual: 12,
} as const;

const NEAT_FRACTION: Record<Occupation, number> = { desk: 0.05, mixed: 0.12, standing: 0.2, manual: 0.35 };

/** Gross MET of resistance training (Compendium 02050–02054) → net = MET − 1. */
const RT_MET: Record<RtIntensity, number> = { moderate: 3.5, high: 5.0, failure: 6.0 };
/** Post-RT elevation of resting metabolic rate (fraction of BMR) and its duration (h). */
const RT_ELEVATION: Record<RtIntensity, { pct: number; hours: number }> = {
  moderate: { pct: 0.03, hours: 24 },
  high: { pct: 0.05, hours: 36 },
  failure: { pct: 0.07, hours: 48 },
};
/** Increase in mixed-muscle fractional synthesis rate after RT (%/h) and duration (h). */
const MPS_DELTA_FSR: Record<RtIntensity, number> = { moderate: 0.025, high: 0.04, failure: 0.05 };
const MPS_HOURS: Record<RtIntensity, number> = { moderate: 24, high: 36, failure: 48 };
const STATUS_DURATION: Record<TrainingStatus, number> = { novice: 1.25, intermediate: 1.0, advanced: 0.7 };
const GLYCOGEN_PER_SET: Record<RtIntensity, number> = { moderate: 2.8, high: 3.5, failure: 4.2 };
/** Glycogenesis: hexokinase ATP + UDP-glucose pyrophosphorylase UTP = 2 ATP per glucosyl unit (162 g/mol). */
const ATP_PER_GLUCOSYL = 2;
/** Skeletal muscle protein content (g protein / g wet muscle). */
const MUSCLE_PROTEIN_FRACTION = 0.2;

/** TEF multiplier by meal frequency (Tai 1991: larger boluses → slightly higher TEF). */
const FREQUENCY_TEF: Record<number, number> = { 1: 1.04, 2: 1.02, 3: 1.0, 4: 0.99, 5: 0.985, 6: 0.98 };
/** Circadian TEF modulation (Romon 1993; Morris 2015: evening DIT is lower). */
const TIMING_TEF: Record<MealTiming, number> = { morning: 1.05, balanced: 1.0, evening: 0.9 };
/** Modelled extra faecal energy fraction from transit dynamics (large single boluses accelerate transit). */
const FREQUENCY_TRANSIT: Record<number, number> = { 1: 0.01, 2: 0.005, 3: 0, 4: -0.002, 5: -0.003, 6: -0.004 };
/** Eating window (h) typical of each frequency. */
const EATING_WINDOW: Record<number, number> = { 1: 1, 2: 6, 3: 11, 4: 12, 5: 13, 6: 14 };

/** Mixed-substrate ATP regeneration per kcal oxidised (mol/kcal). */
export const MIXED_ATP_PER_KCAL = 0.0463;

/* ------------------------------------------------------------------ BMR */

export interface OrganRow {
  tissue: string;
  massKg: number;
  smr: number;
  kcal: number;
}

export function organTissueModel(input: MetabolicInput): { rows: OrganRow[]; total: number } {
  const { sex, age, weightKg, bodyFatPct } = input;
  const fm = (weightKg * bodyFatPct) / 100;
  const ffm = weightKg - fm;
  const brain = (sex === 'male' ? 1.45 : 1.3) * (1 - 0.0025 * Math.max(0, age - 40));
  const liver = 0.027 * ffm;
  const heart = 0.0055 * ffm;
  const kidneys = 0.005 * ffm;
  const smFraction = (sex === 'male' ? 0.53 : 0.48) - 0.0015 * Math.max(0, age - 40); // sarcopenic drift
  const skeletalMuscle = ffm * smFraction;
  const adipose = Math.min(weightKg * 0.6, fm / 0.85);
  const residual = Math.max(0, weightKg - brain - liver - heart - kidneys - skeletalMuscle - adipose);
  const rows: OrganRow[] = [
    { tissue: 'Brain', massKg: brain, smr: ORGAN_SMR.brain, kcal: brain * ORGAN_SMR.brain },
    { tissue: 'Liver', massKg: liver, smr: ORGAN_SMR.liver, kcal: liver * ORGAN_SMR.liver },
    { tissue: 'Heart', massKg: heart, smr: ORGAN_SMR.heart, kcal: heart * ORGAN_SMR.heart },
    { tissue: 'Kidneys', massKg: kidneys, smr: ORGAN_SMR.kidneys, kcal: kidneys * ORGAN_SMR.kidneys },
    { tissue: 'Skeletal muscle', massKg: skeletalMuscle, smr: ORGAN_SMR.skeletalMuscle, kcal: skeletalMuscle * ORGAN_SMR.skeletalMuscle },
    { tissue: 'Adipose tissue', massKg: adipose, smr: ORGAN_SMR.adipose, kcal: adipose * ORGAN_SMR.adipose },
    { tissue: 'Residual (bone, skin, GI, blood)', massKg: residual, smr: ORGAN_SMR.residual, kcal: residual * ORGAN_SMR.residual },
  ];
  return { rows, total: rows.reduce((s, r) => s + r.kcal, 0) };
}

export function bmrModels(input: MetabolicInput) {
  const lbm = input.weightKg * (1 - input.bodyFatPct / 100);
  const organ = organTissueModel(input);
  const katch = 370 + 21.6 * lbm;
  const cunningham = 500 + 22 * lbm;
  const mifflin = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + (input.sex === 'male' ? 5 : -161);
  return { lbm, organ, katch, cunningham, mifflin, organTotal: organ.total };
}

/* ------------------------------------------------------------------ expenditure */

export interface RtSessionCost {
  mechanical: number;
  epoc: number;
  glycogen: number;
  mps: number;
  total: number;
  glycogenG: number;
  mpsProteinG: number;
}

export function resistanceSessionCost(input: MetabolicInput, bmr: number, skeletalMuscleKg: number): RtSessionCost {
  const hours = input.rtSessionMinutes / 60;
  const mechanical = (RT_MET[input.rtIntensity] - 1) * input.weightKg * hours;

  const glycogenG = Math.min(300, input.rtSetsPerSession * GLYCOGEN_PER_SET[input.rtIntensity]);
  const glycogen = (glycogenG / 162) * ATP_PER_GLUCOSYL * KCAL_PER_MOL_ATP;

  const mpsHours = MPS_HOURS[input.rtIntensity] * STATUS_DURATION[input.trainingStatus];
  const muscleProteinG = skeletalMuscleKg * 1000 * MUSCLE_PROTEIN_FRACTION;
  const mpsProteinG = muscleProteinG * (MPS_DELTA_FSR[input.rtIntensity] / 100) * mpsHours;
  const mps = (mpsProteinG / MEAN_RESIDUE_MASS) * ATP_PER_PEPTIDE_BOND * KCAL_PER_MOL_ATP;

  // Total resting-rate elevation; MPS & glycogen costs are part of it, the remainder is
  // ion pumping, substrate cycling and tissue repair.
  const elev = RT_ELEVATION[input.rtIntensity];
  const elevationKcal = bmr * elev.pct * (elev.hours * STATUS_DURATION[input.trainingStatus]) / 24;
  const epoc = Math.max(0, elevationKcal - mps - glycogen);

  return { mechanical, epoc, glycogen, mps, total: mechanical + epoc + glycogen + mps, glycogenG, mpsProteinG };
}

/* ------------------------------------------------------------------ plate exchange */

export interface ExchangePoint {
  score: number;
  ratio: number;
  requiredLabel: number;
  absorbedPct: number;
  nmePct: number;
  advantage: number;
}

export interface FeedingDynamics {
  tefFactor: number;
  transitPenalty: number;
  foodQuotient: number;
  postprandialHours: number;
  fatDominantHours: number;
  eatingWindow: number;
}

function feedingDynamics(input: MetabolicInput, labelKcal: number, split: DietSplit): FeedingDynamics {
  const meals = Math.min(6, Math.max(1, Math.round(input.mealsPerDay)));
  const tefFactor = FREQUENCY_TEF[meals] * TIMING_TEF[input.mealTiming];
  const total = split.proteinKcal + split.fatKcal + split.carbKcal || 1;
  const foodQuotient = (split.carbKcal * 1.0 + split.fatKcal * 0.71 + split.proteinKcal * 0.81) / total;
  const mealKcal = labelKcal / meals;
  const perMealPostprandial = 3 + 4 * Math.sqrt(mealKcal / 1000);
  const eatingWindow = EATING_WINDOW[meals];
  const postprandialHours = Math.min(24, eatingWindow + perMealPostprandial);
  return {
    tefFactor,
    transitPenalty: FREQUENCY_TRANSIT[meals],
    foodQuotient,
    postprandialHours,
    fatDominantHours: Math.max(0, 24 - postprandialHours),
    eatingWindow,
  };
}

function dietSplit(input: MetabolicInput, labelKcal: number): DietSplit {
  const proteinKcal = Math.min(labelKcal * 0.45, input.proteinGPerKg * input.weightKg * 4);
  const fatKcal = labelKcal * input.fatPct;
  const carbKcal = Math.max(0, labelKcal - proteinKcal - fatKcal);
  return { proteinKcal, fatKcal, carbKcal };
}

/**
 * Plate exchange ratio at a given matrix score: oxidisable NME delivered per label kcal,
 * after the feeding-regimen TEF & transit adjustments.
 */
function exchangeAt(score: number, input: MetabolicInput, demand: number) {
  let label = demand / 0.85;
  let ratio = 0.85;
  let absorbedPct = 0;
  let nmePct = 0;
  let split = dietSplit(input, label);
  let feeding = feedingDynamics(input, label, split);
  for (let i = 0; i < 6; i++) {
    split = dietSplit(input, label);
    const profile = absorbDiet(score, split);
    const a = analyzeProfile(profile, { anabolicState: 'maintenance', bodyMassKg: input.weightKg });
    const s2 = stage2Kcal(profile);
    const s3 = a.stages[2].kcal;
    feeding = feedingDynamics(input, label, split);
    const obligatoryTef = s2 - s3;
    const nmeAdj = s3 - (feeding.tefFactor - 1) * obligatoryTef - feeding.transitPenalty * s2;
    ratio = nmeAdj / a.stages[0].kcal;
    absorbedPct = s2 / a.stages[0].kcal;
    nmePct = ratio;
    label = demand / ratio;
  }
  return { ratio, label, absorbedPct, nmePct, split, feeding };
}

/* ------------------------------------------------------------------ main */

export interface MetabolicResult {
  lbm: number;
  fm: number;
  bmr: { organ: number; katch: number; cunningham: number; mifflin: number; selected: number };
  organs: OrganRow[];
  rtSession: RtSessionCost;
  expenditure: { key: string; label: string; kcal: number; color: string }[];
  netDemand: number;
  atpMolPerDay: number;
  atpKgPerDay: number;
  standardTdee: number;
  feeding: FeedingDynamics;
  exchange: ExchangePoint[];
  selected: ExchangePoint;
  macroGrams: { protein: number; fat: number; carbs: number };
}

export function computeMetabolism(input: MetabolicInput): MetabolicResult {
  const models = bmrModels(input);
  const fm = input.weightKg - models.lbm;
  const bmrSelected =
    input.bmrModel === 'organ'
      ? models.organTotal
      : input.bmrModel === 'katch'
        ? models.katch
        : input.bmrModel === 'cunningham'
          ? models.cunningham
          : models.mifflin;

  // Steps: stride ≈ 0.415 × height (m); net walking cost ≈ 0.5 kcal/kg/km.
  const strideM = (input.heightCm / 100) * (input.sex === 'male' ? 0.415 : 0.413);
  const stepsKcal = ((input.steps * strideM) / 1000) * input.weightKg * 0.5;
  const neat = bmrSelected * NEAT_FRACTION[input.occupation];

  const sm = models.organ.rows.find((r) => r.tissue === 'Skeletal muscle')?.massKg ?? models.lbm * 0.5;
  const rtSession = resistanceSessionCost(input, bmrSelected, sm);
  const perDay = input.rtSessionsPerWeek / 7;
  const cardio = (Math.max(0, input.cardioMet - 1) * input.weightKg * (input.cardioMinutesPerWeek / 60)) / 7;

  const expenditure = [
    { key: 'bmr', label: 'Cellular BMR', kcal: bmrSelected, color: '#22d3ee' },
    { key: 'steps', label: 'Steps (ambulation)', kcal: stepsKcal, color: '#38bdf8' },
    { key: 'neat', label: 'NEAT (posture, fidgeting)', kcal: neat, color: '#60a5fa' },
    { key: 'rt_mech', label: 'HIT mechanical work', kcal: rtSession.mechanical * perDay, color: '#f59e0b' },
    { key: 'rt_epoc', label: 'EPOC (ion pumps, repair)', kcal: rtSession.epoc * perDay, color: '#fb923c' },
    { key: 'rt_gly', label: 'Glycogen resynthesis', kcal: rtSession.glycogen * perDay, color: '#facc15' },
    { key: 'rt_mps', label: 'Myofibrillar synthesis (4 ATP/bond)', kcal: rtSession.mps * perDay, color: '#c084fc' },
    { key: 'cardio', label: 'Cardio', kcal: cardio, color: '#a3e635' },
  ];
  const netDemand = expenditure.reduce((s, e) => s + e.kcal, 0);

  // Conventional reference: Mifflin × PAL derived from steps + sessions.
  const pal = 1.2 + Math.min(0.5, input.steps / 25000) + input.rtSessionsPerWeek * 0.03 + input.cardioMinutesPerWeek / 3000;
  const standardTdee = models.mifflin * pal;

  const exchange: ExchangePoint[] = [];
  let feeding: FeedingDynamics | null = null;
  let selectedSplit: DietSplit | null = null;
  for (let s = 1; s <= 10; s++) {
    const r = exchangeAt(s, input, netDemand);
    exchange.push({ score: s, ratio: r.ratio, requiredLabel: r.label, absorbedPct: r.absorbedPct, nmePct: r.nmePct, advantage: 0 });
    if (s === Math.round(input.matrixScore)) {
      feeding = r.feeding;
      selectedSplit = r.split;
    }
  }
  const base = exchange[0].requiredLabel;
  exchange.forEach((e) => (e.advantage = e.requiredLabel - base));
  const selected = exchange[Math.round(input.matrixScore) - 1];
  const split = selectedSplit ?? dietSplit(input, selected.requiredLabel);

  return {
    lbm: models.lbm,
    fm,
    bmr: { organ: models.organTotal, katch: models.katch, cunningham: models.cunningham, mifflin: models.mifflin, selected: bmrSelected },
    organs: models.organ.rows,
    rtSession,
    expenditure,
    netDemand,
    atpMolPerDay: netDemand * MIXED_ATP_PER_KCAL,
    atpKgPerDay: (netDemand * MIXED_ATP_PER_KCAL * ATP_MOLAR_MASS) / 1000,
    standardTdee,
    feeding: feeding ?? feedingDynamics(input, selected.requiredLabel, split),
    exchange,
    selected,
    macroGrams: { protein: split.proteinKcal / 4, fat: split.fatKcal / 9, carbs: split.carbKcal / 4 },
  };
}
