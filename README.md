# BioEnergetics OS — *NME-Core: Beyond Atwater*

A client-side nutritional-bioenergetics platform that replaces 19th-century Atwater label calories (4 · 4 · 9 kcal/g) with a model of what actually reaches your mitochondria and how much ATP it regenerates.

Built with **React 18 + TypeScript + Vite + Tailwind CSS + Recharts + Lucide**. Runs entirely in the browser and deploys to **GitHub Pages**.

---

## Modules

### 1. Bioenergetic Food Encyclopedia & Comparator
- **152 curated core foods** (`src/data/coreFoods.json`): eggs, dairy, cheeses, meats, fish, legumes, soy, whole and refined grains, tubers, vegetables, fruits, nuts and seeds (whole vs butter), oils (high-polyphenol EVOO vs refined olive vs MCT vs butter), fungi and algae, protein isolates, ultra-processed foods and beverages. Each has macros, fibre, resistant starch, SFA/MUFA/PUFA/MCT, polyphenols, DIAAS, true ileal digestibility, a matrix absorption coefficient, NOVA class and limiting amino acid.
- **Live global search** over **USDA FoodData Central** (built-in `DEMO_KEY`, or your own key in Settings) and **OpenFoodFacts**. Every result goes through the deterministic **Bioenergetic Inference Engine**, which infers category, NOVA, available carbohydrate, fatty-acid split, RS, matrix coefficient, DIAAS and polyphenols, and lists every inferred field with a confidence score.
- **Label Illusion vs Cellular Reality** side by side: Atwater ME vs Livesey NME vs net mitochondrial fuel vs ATP (mol).
- **Matrix Absorption Coefficient**, **protein partitioning** (ileal absorption, urea-cycle loss, plastic/anabolic retention, peptide-bond ATP cost), **Lipid Bio-Thermogenesis Index** (CPT-1 affinity, 9-h oxidation, UCP1/UCP3 polyphenol uplift), ATP by substrate and the **oxidative priority hierarchy**.
- **Comparator**: up to 5 foods, per 100 g or isoenergetic (per 100 label kcal).

### 2. Interactive Meal Builder
Combine foods and preparation methods (*Raw*, *Cooked*, *Boiled & cooled – retrograded RS*, *Finely ground/refined*, *Roasted*). The meal is analysed jointly: amino-acid complementarity (e.g. rice + beans), pooled polyphenols, per-meal MPS saturation. It is shown as a 4-stage waterfall:

1. Atwater label calories
2. Digestible absorbed energy (after the matrix and fibre barrier)
3. Livesey NME (after TEF and the urea cycle)
4. Net mitochondrial oxidisable fuel (after the plastic/anabolic deduction)

### 3. True Cellular BMR & ATP-TDEE Calculator
- **BMR**: organ-tissue partitioning (Elia/Wang specific metabolic rates for brain, liver, heart, kidneys, muscle, adipose and residual tissue), Katch-McArdle, Cunningham and Mifflin.
- **Mechanical & recovery expenditure**: steps, NEAT, cardio, and **HIT recovery cost**, split into mechanical work, 24–72 h EPOC, glycogen resynthesis and myofibrillar protein synthesis at 4 ATP per peptide bond.
- **Feeding regimen**: meal frequency (OMAD to 6 meals) and circadian timing, which change TEF, intestinal transit, the food quotient/RQ and the fat-oxidation window.
- **Plate Exchange Rate Translator**: Net Cellular ATP Demand → the label calories you need to eat, as a function of the **Diet Matrix Integrity Score** (1 = ultra-processed … 10 = whole grains, legumes, eggs, fibrous vegetables, EVOO). It also shows the **Matrix Metabolic Advantage**.

### 4. Methodology
An in-app reference with every formula, constant and citation.

---

## The scientific framework (summary)

| Stage | Formula |
|---|---|
| 1 · Atwater | `4P + 4(CHO_avail + fibre) + 9F + 7·EtOH` |
| 2 · Absorbed | `min(4P, 4P·f_P/0.92) + 9F·m + 4(CHO−RS)·f_C + 2·colonic + 7·EtOH`, where `f_P = min(m, ileal)` and `f_C = 1 − (1−m)/2` |
| 3 · NME | ME × Livesey ratios (protein 3.2/4, fat 8.9/9, CHO 3.8/4, fibre 1.4/2, alcohol 6.3/7) − NOVA facultative TEF − lipid thermogenesis |
| 4 · Fuel | NME − plastic protein (+ refunded urea cost) − peptide-bond cost (0.76 kcal/g) − structural lipids |
| ATP | fuel × substrate-specific ATP/kcal (glucose 32/670, palmitate 106/2398, octanoate 50/1147, ethanol 13/327) |

**Validation anchors** (automated tests in `src/engine/engine.test.ts`):
- Whole almonds absorb ≈ 76 % of Atwater energy (Novotny 2012), and grinding raises it.
- Raw egg protein is far less digestible than cooked (Evenepoel 1998).
- Cooling rice increases RS3 and lowers absorbed energy.
- Collagen (DIAAS 0) yields no plastic myofibrillar protein.
- The organ-tissue BMR agrees with Katch-McArdle to within 8 %.

> ⚠️ Educational and analytical model. Several modifiers (UCP/polyphenol uplift, NOVA-TEF, transit) are explicitly labelled heuristics with conservative magnitudes. This is not medical advice.

---

## Project structure

```
src/
├── engine/
│   ├── bioenergeticsEngine.ts   # constants, absorption, NME, partitioning, ATP, inference engine
│   ├── metabolismEngine.ts      # BMR models, HIT recovery, feeding dynamics, plate exchange rate
│   └── engine.test.ts           # Vitest validation suite
├── data/
│   ├── coreFoods.json           # 152 curated foods
│   └── foods.ts                 # typed loader + local search
├── services/foodApi.ts          # USDA FoodData Central + OpenFoodFacts clients
├── components/
│   ├── common/                  # UI primitives, settings modal
│   ├── foods/                   # browser, detail, comparator
│   ├── meal/                    # meal builder, waterfall chart
│   ├── metabolism/              # BMR & ATP-TDEE calculator
│   └── methodology/             # scientific documentation
├── hooks/                       # hash routing, localStorage state
└── types/                       # domain types
```

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine validation suite
npm run build      # type-check + production build → dist/
```

## Deploying to GitHub Pages

The app uses `base: './'` (relative asset URLs) and hash routing (`#/foods`, `#/meal`, …), so it works at any sub-path with no server rewrites.

**Option A — GitHub Actions (recommended)**
1. Push the repository to GitHub with `main` as the default branch.
2. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` (install → test → build → deploy). The site is published at `https://<user>.github.io/<repo>/`.

**Option B — `gh-pages` branch**
```bash
npm run deploy     # builds and pushes dist/ to the gh-pages branch
```
Then set **Settings → Pages → Source: Deploy from a branch → gh-pages / root**.

## API keys

- **USDA FoodData Central** works out of the box with `DEMO_KEY` (about 30 requests/hour per IP). Get a free personal key at <https://fdc.nal.usda.gov/api-key-signup> and paste it in the in-app **Settings** (gear icon). It is stored only in your browser's localStorage.
- **OpenFoodFacts** needs no key. Data © Open Food Facts contributors, ODbL.
  - **Barcode lookup** (type an 8–14-digit EAN/UPC in Global search) uses the product API and works from any browser.
  - **Text search**: the app tries `search.openfoodfacts.org`, then the legacy `cgi/search.pl`. As of October 2026, OFF refuses browser-originated text searches (HTTP 503 with no CORS header). When that happens the app shows an explanatory message, and USDA results still appear.

## Key references

Livesey 2001 (Br J Nutr) · FAO 2003 Food Energy (FNP 77) · FAO 2013 DIAAS (FNP 92) · Novotny 2012 & Baer 2016 (nut ME) · Gebauer 2016 · Grundy 2016 · Evenepoel 1998 · DeLany 2000 · St-Onge & Jones 2002 · Barr & Wright 2010 · Elia 1992 · Wang 2010 · Phillips 1997 · Schoenfeld & Aragon 2018 · Morris 2015.
