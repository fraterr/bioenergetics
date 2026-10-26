import { describe, expect, it } from 'vitest';
import { analyzeFood, analyzeMeal, applyPrep, inferFood, classifyCategory } from './bioenergeticsEngine';
import { computeMetabolism, DEFAULT_METABOLIC_INPUT } from './metabolismEngine';
import { CORE_FOOD_BY_ID, CORE_FOODS } from '../data/foods';

const food = (id: string) => CORE_FOOD_BY_ID[id];

describe('bioenergetics engine', () => {
  it('has a rich core database', () => {
    expect(CORE_FOODS.length).toBeGreaterThanOrEqual(100);
  });

  it('waterfall stages are monotonically non-increasing for every core food', () => {
    for (const f of CORE_FOODS) {
      const a = analyzeFood(f, 100);
      const [s1, s2, s3, s4] = a.stages.map((s) => s.kcal);
      expect(s2, f.id).toBeLessThanOrEqual(s1 + 1e-6);
      expect(s3, f.id).toBeLessThanOrEqual(s2 * 1.02 + 1e-6); // NOVA-4 TEF may slightly raise NME
      expect(s4, f.id).toBeLessThanOrEqual(s3 + 1e-6);
      expect(s4, f.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('reproduces measured almond metabolizable energy (~76 % of Atwater, Novotny 2012)', () => {
    const a = analyzeFood(food('almonds-raw'), 100);
    expect(a.matrixCoefficient).toBeGreaterThan(0.7);
    expect(a.matrixCoefficient).toBeLessThan(0.82);
  });

  it('refining almonds into butter raises absorbed energy', () => {
    const whole = analyzeFood(food('almonds-raw'), 100);
    const ground = analyzeFood(food('almonds-raw'), 100, 'refined');
    expect(ground.stages[1].kcal).toBeGreaterThan(whole.stages[1].kcal * 1.15);
  });

  it('cooling rice increases resistant starch and lowers absorbed energy', () => {
    const rice = food('rice-white');
    expect(applyPrep(rice, 'cooled').rs).toBeGreaterThan(rice.rs * 2);
    expect(analyzeFood(rice, 100, 'cooled').stages[1].kcal).toBeLessThan(analyzeFood(rice, 100).stages[1].kcal);
  });

  it('raw egg protein is far less digestible than cooked', () => {
    const cooked = analyzeFood(food('egg-whole-boiled'), 100);
    const raw = analyzeFood(food('egg-whole-boiled'), 100, 'raw');
    expect(raw.protein.absorbed).toBeLessThan(cooked.protein.absorbed * 0.7);
  });

  it('high-polyphenol EVOO has a higher lipid thermogenesis index than butter', () => {
    const evoo = analyzeFood(food('evoo-high'), 30);
    const butter = analyzeFood(food('butter'), 30);
    expect(evoo.lipid.ucpUplift).toBeGreaterThan(butter.lipid.ucpUplift);
    expect(evoo.lipid.index).toBeGreaterThan(butter.lipid.index);
  });

  it('rice + beans shows amino-acid complementarity', () => {
    const m = analyzeMeal([
      { uid: '1', food: food('rice-white'), grams: 200, prep: 'as_listed' },
      { uid: '2', food: food('black-beans'), grams: 150, prep: 'as_listed' },
    ]);
    expect(m.protein.effectiveDiaas).toBeGreaterThan(m.protein.diaas);
  });

  it('collagen cannot be retained as plastic myofibrillar protein', () => {
    expect(analyzeFood(food('collagen'), 30).protein.plastic).toBe(0);
  });

  it('infers sensible parameters for an external food', () => {
    const f = inferFood({ id: 'x', name: 'Almonds, raw', source: 'usda', protein: 21, fat: 50, carbsTotal: 21.6, fiber: 12.5, sugars: 4.4 });
    expect(f.category).toBe('nut');
    expect(f.matrix).toBeLessThan(0.85);
    expect(f.carbs).toBeCloseTo(9.1, 1);
    expect(classifyCategory('Peanut butter, smooth').category).toBe('nut_butter');
    expect(classifyCategory('Oil, olive, salad or cooking').category).toBe('oil');
    expect(classifyCategory('Peanuts, oil-roasted').category).toBe('nut');
    expect(classifyCategory('Beans, kidney, red, boiled').category).toBe('legume');
  });
});

describe('metabolism engine', () => {
  it('produces a plausible demand and a positive matrix advantage', () => {
    const r = computeMetabolism(DEFAULT_METABOLIC_INPUT);
    expect(r.bmr.organ).toBeGreaterThan(1500);
    expect(r.bmr.organ).toBeLessThan(2200);
    expect(Math.abs(r.bmr.organ - r.bmr.katch) / r.bmr.katch).toBeLessThan(0.08);
    expect(r.netDemand).toBeGreaterThan(r.bmr.selected);
    expect(r.exchange[9].requiredLabel).toBeGreaterThan(r.exchange[0].requiredLabel);
    expect(r.selected.advantage).toBeGreaterThan(0);
    expect(r.atpKgPerDay).toBeGreaterThan(30);
  });
});
