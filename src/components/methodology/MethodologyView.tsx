import type { ReactNode } from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';
import {
  ATP_PER_KCAL,
  CPT1_AFFINITY,
  NME,
  NOVA_TEF,
  PEPTIDE_SYNTHESIS_KCAL_PER_G,
  PLASTIC_RETENTION,
  POSTPRANDIAL_OXIDATION,
} from '../../engine/bioenergeticsEngine';
import { ORGAN_SMR } from '../../engine/metabolismEngine';
import { Card, fmt } from '../common/ui';

const SECTIONS = [
  ['atwater', 'Atwater vs Livesey NME'],
  ['pipeline', 'The 4-stage pipeline'],
  ['matrix', 'Food matrix & fibre'],
  ['protein', 'Protein quality & plastic partitioning'],
  ['lipid', 'Lipid oxidation & uncoupling'],
  ['respiration', 'Cellular respiration mechanics'],
  ['hierarchy', 'Oxidative priority hierarchy'],
  ['bmr', 'True cellular BMR & ATP-TDEE'],
  ['exchange', 'Plate exchange rate'],
  ['inference', 'Inference engine'],
  ['limits', 'Limitations'],
  ['refs', 'References'],
] as const;

export function MethodologyView() {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="hidden lg:block">
        <div className="sticky top-[84px] space-y-0.5">
          <div className="label-xs mb-2 flex items-center gap-1.5">
            <BookOpen size={12} /> Contents
          </div>
          {SECTIONS.map(([id, title]) => (
            <a key={id} href={`#/methodology`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="block rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-100">
              {title}
            </a>
          ))}
        </div>
      </nav>

      <article className="min-w-0 space-y-5 text-sm leading-relaxed text-slate-300">
        <Card className="border-nme/20">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 shrink-0 text-nme" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-white">Scientific Methodology</h2>
              <p className="mt-1 text-slate-400">
                BioEnergetics OS is a deterministic, fully transparent model. Every number on screen is produced by the formulas below
                (source: <code className="text-nme">src/engine/bioenergeticsEngine.ts</code> and <code className="text-nme">src/engine/metabolismEngine.ts</code>).
                Coefficients come from peer-reviewed literature where available; where evidence is thin, the model uses explicitly labelled heuristics.
                It is an educational and analytical tool — not a medical device.
              </p>
            </div>
          </div>
        </Card>

        <Doc id="atwater" title="1 · Atwater vs Livesey Net Metabolizable Energy">
          <p>
            Wilbur Atwater (1896–1900) burned foods in a bomb calorimeter, subtracted average faecal and urinary losses of mixed American diets,
            and rounded the result to the <b>general factors</b> 4 · 4 · 9 kcal/g. They describe <i>metabolizable energy</i> (ME): energy that crosses the gut
            wall and is not excreted in urine. ME ignores what the body must spend to <i>use</i> each substrate.
          </p>
          <p>
            Geoffrey Livesey's <b>Net Metabolizable Energy</b> (NME, adopted by FAO 2003) subtracts obligatory thermogenesis — the ATP cost of
            ureagenesis, gluconeogenesis, glycogen synthesis, lipid re-esterification and colonic fermentation — expressing each substrate's capacity to
            regenerate ATP on a common glucose-equivalent basis.
          </p>
          <Table
            head={['Substrate', 'Atwater ME (kcal/g)', 'Livesey NME (kcal/g)', 'NME / ME']}
            rows={[
              ['Protein', '4.0', NME.protein.toFixed(1), '0.80'],
              ['Fat', '9.0', NME.fat.toFixed(1), '0.99'],
              ['Available carbohydrate', '4.0', NME.carbohydrate.toFixed(1), '0.95'],
              ['Fermentable fibre / RS', '2.0 (label: 4)', NME.colonic.toFixed(1), '0.70'],
              ['Alcohol', '7.0', NME.alcohol.toFixed(1), '0.90'],
              ['Polyols', '2.4', NME.polyols.toFixed(1), '0.92'],
            ]}
          />
        </Doc>

        <Doc id="pipeline" title="2 · The 4-stage bioenergetic pipeline">
          <Formula>{`Stage 1  Atwater label  E₁ = 4·P + 4·(CHO_avail + fibre) + 9·F + 7·EtOH + 4·polyols

Stage 2  Digestible absorbed (ME, post-matrix)
         E₂ = min(4P, 4·P·f_P / 0.92) + 9·F·m + 4·(CHO − RS)·f_C
              + 2·[fibre + RS + (CHO − RS)(1 − f_C)] + 7·EtOH + 2.4·polyols
         f_P = min(m, ileal digestibility)       f_C = 1 − (1 − m)·0.5

Stage 3  Livesey NME
         E₃ = Σ ME_i·(NME_i / ME_i) − TEF_NOVA − Q_lipid

Stage 4  Net mitochondrial oxidisable fuel
         E₄ = E₃ − P_plastic·(NME_P − urea_P) − P_plastic·${PEPTIDE_SYNTHESIS_KCAL_PER_G.toFixed(2)} − L_struct·8.9`}</Formula>
          <p>
            <b>m</b> is the food's <i>Matrix Absorption Coefficient</i>. Because the Atwater protein factor already assumes ~92 % digestibility,
            absorbed protein energy is normalised by 0.92 and capped at the label value. Escaped starch, resistant starch and fibre are fermented in the
            colon to short-chain fatty acids (SCFA) worth ≈ 2 kcal/g ME and 1.4 kcal/g NME.
          </p>
        </Doc>

        <Doc id="matrix" title="3 · Food matrix, cell-wall integrity & fibre">
          <p>
            Intact plant cell walls (cellulose–pectin–hemicellulose) are not hydrolysed by human enzymes. Lipid droplets and starch granules inside
            unruptured cells are <b>bioinaccessible</b> and pass to the colon or faeces (Grundy et al. 2016). Measured ME of whole almonds is ~129 kcal per
            28 g vs 170 kcal on the label (Novotny 2012) — a coefficient of ~0.76. Grinding into butter restores near-complete absorption (Gebauer 2016).
          </p>
          <Table
            head={['Food', 'm (lipid/starch release)', 'Mechanism']}
            rows={[
              ['Whole raw almonds', '0.75–0.80', 'Cotyledon cell walls survive mastication'],
              ['Walnuts', '0.79', 'Baer 2016 — 21 % below Atwater'],
              ['Lentils, beans', '0.82–0.86', 'Starch encapsulated in cotyledon cells'],
              ['Whole grains / oats', '0.92–0.95', 'Bran barrier, β-glucan viscosity'],
              ['Cooked eggs', '0.96–0.97', 'Near-complete; protein ileal 91–94 %'],
              ['Refined oils, sugars', '0.985–1.00', 'No matrix'],
            ]}
          />
          <p>
            <b>Preparation modifiers</b>: <i>Boiled &amp; cooled</i> adds retrograded RS3 = 8 % of remaining starch; <i>Finely ground</i> moves m 80 % of the way
            to 0.985 and halves RS; <i>Roasted</i> moves m 15 % towards 0.985 with a 3 % DIAAS penalty (Maillard lysine damage); <i>Raw egg</i> drops ileal
            digestibility to 0.55 (Evenepoel 1998).
          </p>
        </Doc>

        <Doc id="protein" title="4 · Protein quality, urea cycle & plastic partitioning">
          <p>
            <b>DIAAS</b> (FAO 2013) scores the most limiting indispensable amino acid after true ileal digestion. Oxidising amino acids costs ATP: each urea
            molecule requires ~4 ATP equivalents, and carbon skeletons pass through gluconeogenesis — hence protein NME is only 3.2 kcal/g.
          </p>
          <Formula>{`DIAAS_eff = DIAAS + share(min(lysine-limited, sulphur-limited)) · 0.6 · (1 − DIAAS)
usable    = min(P_abs · min(1, DIAAS_eff),  0.4 g/kg body mass)        (MPS saturation per meal)
P_plastic = usable · r      r = ${PLASTIC_RETENTION.maintenance} rest · ${PLASTIC_RETENTION.training} training · ${PLASTIC_RETENTION.recovery} post-HIT recovery
cost      = 4 ATP / peptide bond ÷ 110 g/mol residue × ${fmt(1 / ATP_PER_KCAL.carbohydrate, 1)} kcal/mol ATP = ${PEPTIDE_SYNTHESIS_KCAL_PER_G.toFixed(2)} kcal/g`}</Formula>
          <p>
            Plastic amino acids are not deaminated, so their urea cost is refunded, while the energy locked in tissue and the peptide-bond synthesis cost
            are deducted from oxidisable fuel. Collagen (no tryptophan → DIAAS 0) contributes no myofibrillar plastic protein.
          </p>
        </Doc>

        <Doc id="lipid" title="5 · Postprandial lipid oxidation & uncoupling affinity">
          <p>
            Long-chain fatty acids require carnitine palmitoyltransferase-1 (CPT-1) to enter mitochondria; CPT-1 is inhibited by malonyl-CoA in the fed state.
            Medium-chain FAs (C6–C10) travel via the portal vein and cross the inner membrane independently of CPT-1. Stable-isotope studies show
            cumulative 9-h oxidation of lauric 41 %, oleic ~21 %, linoleic ~18 %, palmitic 16 % and stearic 13 % (DeLany 2000).
          </p>
          <Table
            head={['FA class', 'CPT-1 affinity', '9-h oxidation', 'Extra thermogenesis']}
            rows={[
              ['MCT (C6–C10)', String(CPT1_AFFINITY.mct), `${POSTPRANDIAL_OXIDATION.mct * 100}%`, '5 %'],
              ['PUFA', String(CPT1_AFFINITY.pufa), `${POSTPRANDIAL_OXIDATION.pufa * 100}%`, '0.8 %'],
              ['MUFA', String(CPT1_AFFINITY.mufa), `${POSTPRANDIAL_OXIDATION.mufa * 100}%`, '1.2 %'],
              ['Long-chain SFA', String(CPT1_AFFINITY.sfaLong), `${POSTPRANDIAL_OXIDATION.sfaLong * 100}%`, '0 %'],
            ]}
          />
          <Formula>{`UCP uplift = 2.5 % · (1 − exp(−ρ / 80))      ρ = polyphenols (mg) per 100 g absorbed fat, pooled per meal
Q_lipid    = 9·F_abs · (Σ sᵢ·thermoᵢ + UCP uplift)
Index      = 0.5·CPT1 + 0.3·(oxidation / 0.6)·100 + 0.2·(UCP / 2.5 %)·100`}</Formula>
          <p>
            Olive-oil phenolics (oleocanthal, hydroxytyrosol), catechins and other polyphenols upregulate UCP1/UCP3 and AMPK in animal and cell models.
            The magnitude in humans is modest and uncertain, so the model caps the effect at 2.5 % of lipid energy.
          </p>
        </Doc>

        <Doc id="respiration" title="6 · Cellular respiration mechanics">
          <p>
            Energy in food is stored in C–H bonds. Dehydrogenases strip electrons (as hydride) onto NAD⁺ and FAD, forming <b>NADH</b> and <b>FADH₂</b>.
            Complexes I, III and IV of the electron-transport chain pass these electrons to O₂ and pump protons into the intermembrane space, building a
            proton-motive force of ~200 mV. <b>ATP synthase</b> (Complex V) lets ~2.7 H⁺ flow back per ATP, giving P/O ratios of ≈ 2.5 (NADH) and 1.5 (FADH₂).
          </p>
          <Table
            head={['Substrate', 'ATP per molecule', 'ATP / kcal']}
            rows={[
              ['Glucose', '32', ATP_PER_KCAL.carbohydrate.toFixed(4)],
              ['Palmitate (C16)', '106', ATP_PER_KCAL.lcfa.toFixed(4)],
              ['Octanoate (C8, MCT)', '50', ATP_PER_KCAL.mct.toFixed(4)],
              ['Ethanol', '13', ATP_PER_KCAL.alcohol.toFixed(4)],
              ['Amino acids (per NME kcal)', '—', ATP_PER_KCAL.aminoAcids.toFixed(4)],
            ]}
          />
          <p>
            At the standard ΔG°′ of ATP hydrolysis (−30.5 kJ/mol) only ~33–38 % of substrate energy is conserved in ATP; ~60–65 % is dissipated as heat. Under
            cellular conditions (ΔG ≈ −50 to −57 kJ/mol) the conserved fraction is higher. <b>Proton leak</b> through uncoupling proteins (UCP1 in brown
            adipose tissue, UCP3 in muscle) and adenine-nucleotide translocase short-circuits the gradient, converting fuel directly into heat.
          </p>
        </Doc>

        <Doc id="hierarchy" title="7 · Oxidative priority hierarchy">
          <p>The body oxidises substrates in inverse order of its capacity to store them (Flatt; Prentice):</p>
          <ol className="ml-5 list-decimal space-y-1">
            <li><b>Alcohol</b> — no storage; acetate oxidation suppresses all other fuels.</li>
            <li><b>MCT / ketogenic MCFA</b> — portal delivery, CPT-1 independent.</li>
            <li><b>Excess amino acids</b> — no storage pool; deaminated and oxidised.</li>
            <li><b>Carbohydrate</b> — glycogen buffer of only ~400–500 g; oxidation auto-regulates to intake.</li>
            <li><b>Dietary long-chain fat</b> — virtually unlimited adipose storage; oxidised last.</li>
          </ol>
        </Doc>

        <Doc id="bmr" title="8 · True cellular BMR & ATP-TDEE">
          <Formula>{`Katch-McArdle  BMR = 370 + 21.6 · LBM
Cunningham     BMR = 500 + 22 · LBM
Organ-tissue   BMR = Σ massᵢ · Kᵢ   (Elia 1992 / Wang 2010)
  K (kcal/kg/d): brain ${ORGAN_SMR.brain} · liver ${ORGAN_SMR.liver} · heart ${ORGAN_SMR.heart} · kidneys ${ORGAN_SMR.kidneys}
                 skeletal muscle ${ORGAN_SMR.skeletalMuscle} · adipose ${ORGAN_SMR.adipose} · residual ${ORGAN_SMR.residual}

Steps   = steps · 0.415·height · kg · 0.5 kcal/kg/km
HIT     = (MET − 1)·kg·h  +  EPOC  +  glycogen·(2 ATP/glucosyl)  +  MPS·(4 ATP/peptide bond)
MPS     = muscle protein · ΔFSR · hours        (ΔFSR 0.025–0.05 %/h for 24–48 h)
EPOC    = max(0, BMR·elevation·hours/24 − MPS − glycogen)

Net Cellular ATP Demand = BMR + steps + NEAT + HIT(all components)/7·sessions + cardio`}</Formula>
          <p>
            TEF is <i>not</i> added to demand: it is already subtracted on the food side by the NME conversion. Daily ATP turnover (mol) = demand × 0.0463;
            multiplied by 507 g/mol this is typically 40–80 kg of ATP recycled per day.
          </p>
        </Doc>

        <Doc id="exchange" title="9 · Plate exchange rate & matrix metabolic advantage">
          <p>
            For a Diet Matrix Integrity Score s ∈ [1, 10] the engine builds a representative whole-day diet with your macro split and interpolates: matrix
            coefficient 0.985 → 0.90, fibre 6 → 24 g/1000 kcal, RS 1 → 7 % of starch, NOVA-TEF {NOVA_TEF[4]} → +{NOVA_TEF[1]}, polyphenols 80 → 1400 mg/1000 kcal,
            MUFA share 34 → 52 %. That diet runs through the same 4-stage pipeline.
          </p>
          <Formula>{`ratio(s) = [E₃ − (TEF_freq·TEF_timing − 1)·(E₂ − E₃) − transit·E₂] / E₁
Required label kcal  = Net Cellular ATP Demand / ratio(s)
Matrix advantage     = Required(s) − Required(1)`}</Formula>
          <p>
            Meal frequency modifies TEF (OMAD ×1.04 … 6 meals ×0.98, Tai 1991) and timing (front-loaded ×1.05, evening ×0.90; Romon 1993, Morris 2015).
            The respiratory quotient over 24 h equals the diet's food quotient at energy balance; meal frequency changes how many hours are spent fed vs in
            fat-dominant post-absorptive oxidation.
          </p>
        </Doc>

        <Doc id="inference" title="10 · Bioenergetic inference engine for external foods">
          <ol className="ml-5 list-decimal space-y-1">
            <li><b>Category</b> — ordered keyword rules on the product name, then database category text, then a macro-based fallback.</li>
            <li><b>NOVA</b> — OpenFoodFacts value when present; otherwise processing keywords and USDA data type.</li>
            <li><b>Available carbohydrate</b> — USDA "by difference" minus fibre; OpenFoodFacts convention resolved by energy closure (which interpretation reproduces declared kcal).</li>
            <li><b>Fatty acids</b> — measured where present; missing classes split by category profile; MCT from coconut/MCT keywords.</li>
            <li><b>Resistant starch</b> — category fraction of starch; ×1.6 for cooled/parboiled; 40 % for green banana/plantain.</li>
            <li><b>Matrix</b> — category base, adjusted by fibre-to-carbohydrate ratio, refining keywords (butter, flour, juice, powder…) and NOVA.</li>
            <li><b>Protein quality & polyphenols</b> — category defaults with keyword overrides (whey, casein, collagen, extra-virgin, cocoa, berries…).</li>
          </ol>
          <p>Every inferred field is listed on the food card with an overall inference-confidence score.</p>
        </Doc>

        <Doc id="limits" title="11 · Limitations">
          <ul className="ml-5 list-disc space-y-1">
            <li>Individual variation (microbiome, chewing efficiency, gut transit, mitochondrial density) can move real values by ±10 % or more.</li>
            <li>UCP/polyphenol, NOVA-TEF and transit modifiers are hypothesis-grade heuristics with deliberately conservative magnitudes.</li>
            <li>Plastic retention reflects short-term postprandial partitioning; at steady state net protein balance is ~zero unless lean mass is accruing.</li>
            <li>Inferred parameters for external foods are estimates; curated core foods are more reliable.</li>
            <li>Not intended for diagnosing, treating or managing any medical condition.</li>
          </ul>
        </Doc>

        <Doc id="refs" title="12 · Key references">
          <ul className="space-y-1 text-xs text-slate-400">
            {[
              'Atwater WO, Bryant AP (1900). The availability and fuel value of food materials. USDA.',
              'Livesey G (2001). A perspective on food energy standards for nutrition labelling. Br J Nutr 85:271–287.',
              'FAO (2003). Food energy — methods of analysis and conversion factors. FAO Food & Nutrition Paper 77.',
              'FAO (2013). Dietary protein quality evaluation in human nutrition (DIAAS). FAO FNP 92.',
              'Novotny JA, Gebauer SK, Baer DJ (2012). Discrepancy between the Atwater factor predicted and empirically measured energy values of almonds. Am J Clin Nutr 96:296.',
              'Baer DJ, Gebauer SK, Novotny JA (2016). Walnuts consumed by healthy adults provide less available energy than predicted. J Nutr 146:9.',
              'Gebauer SK et al. (2016). Food processing and structure impact the metabolizable energy of almonds. Food Funct 7:4231.',
              'Grundy MM et al. (2016). Re-evaluation of the mechanisms of dietary fibre and implications for macronutrient bioaccessibility. Br J Nutr 116:816.',
              'Evenepoel P et al. (1998). Amount and fate of egg protein escaping assimilation. J Nutr 128:1716.',
              'DeLany JP et al. (2000). Differential oxidation of individual dietary fatty acids in humans. Am J Clin Nutr 72:905.',
              'St-Onge MP, Jones PJ (2002). Physiological effects of medium-chain triglycerides. J Nutr 132:329.',
              'Barr SB, Wright JC (2010). Postprandial energy expenditure in whole-food and processed-food meals. Food Nutr Res 54.',
              'Elia M (1992). Organ and tissue contribution to metabolic rate. In: Energy Metabolism, Raven Press.',
              'Wang Z et al. (2010). Specific metabolic rates of major organs and tissues across adulthood. Am J Clin Nutr 92:1369.',
              'Phillips SM et al. (1997). Mixed muscle protein synthesis and breakdown after resistance exercise in humans. Am J Physiol 273:E99.',
              'Schoenfeld BJ, Aragon AA (2018). How much protein can the body use in a single meal? JISSN 15:10.',
              'Morris CJ et al. (2015). The human circadian system has a dominating role in causing the morning/evening difference in diet-induced thermogenesis. Obesity 23:2053.',
            ].map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </Doc>
      </article>
    </div>
  );
}

function Doc({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card card-pad scroll-mt-24 space-y-3">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <pre className="scrollbar-thin overflow-x-auto rounded-xl border border-nme/15 bg-void-950/80 p-4 font-mono text-[12px] leading-relaxed text-nme-soft">
      {children}
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {head.map((h, i) => (
              <th key={h} className={`py-2 font-medium text-slate-400 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-white/5">
              {r.map((c, i) => (
                <td key={i} className={`py-1.5 ${i === 0 ? 'text-slate-200' : 'num text-right text-slate-300'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
