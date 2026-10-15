"use client";

import { useId } from "react";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import {
  estimatedFluidLossMlPerHour,
  estimatedSodiumLossMgPerHour,
  fluidTargetMlPerHour,
  type GiTrainingLevel,
  type HeartRateZone,
  sodiumTargetMgPerHour,
  suggestedCarbsPerHour,
} from "@/lib/endurance-fueling-math";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  caffeinePreloadDoseMg,
  caloriesFromCarbGrams,
  computeHomemadeDrinkRecipe,
  FUEL_PRODUCTS,
  type FuelFormat,
  type FuelProduct,
  GENERIC_PRODUCTS,
  generateFuelingSchedule,
  type GlucoseFructoseRatio,
  totalsForSchedule,
} from "@/lib/fueling-products";
import {
  detailsBodyClass,
  detailsClass,
  groupLabelClass,
  heroCardClass,
  segmentedButtonClass,
  statCardClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";

const STORAGE_KEY = "haarchive-endurance-fueling-calculator-state";

type PersistedState = {
  zone: HeartRateZone;
  giTraining: GiTrainingLevel;
  weightInput: string;
  weightUnit: "kg" | "lbs";
  tempInput: string;
  tempUnit: "c" | "f";
  durationHoursInput: string;
  durationMinutesInput: string;
  customCarbTargetInput: string;
  useCaffeine: boolean;
  fuelFormat: FuelFormat;
  productId: string;
  useHomemadeDrink: boolean;
  glucoseFructoseRatio: GlucoseFructoseRatio;
  customCarbsInput: string;
  customSodiumInput: string;
  bottleMlInput: string;
  sweatRateOverrideInput: string;
  sodiumConcentrationOverrideInput: string;
  showMethodology: boolean;
};

const ZONE_OPTIONS: { value: HeartRateZone; label: string; description: string }[] = [
  { value: "50-60%", label: "50-60%", description: "Very light effort. Easy recovery pace, full conversation." },
  { value: "60-70%", label: "60-70%", description: "Comfortable aerobic pace. Main endurance-building zone." },
  { value: "70-80%", label: "70-80%", description: "“Tempo” or marathon pace. Short sentences only." },
  { value: "80-90%", label: "80-90%", description: "Threshold effort. Uncomfortable, a few words at a time." },
  { value: "90-100%", label: "90-100%", description: "Max effort. Cannot speak." },
];

const GI_OPTIONS: { value: GiTrainingLevel; label: string; description: string }[] = [
  { value: "Not", label: "Not Trained", description: "New to fueling, or frequent GI issues. Handles < 60g/hr." },
  { value: "Moderate", label: "Moderately Trained", description: "Regular fuel user in training. Handles 60-90g/hr." },
  { value: "Well", label: "Well Trained", description: "Practiced high-intake fueling. Handles > 90g/hr." },
  { value: "HighCarbMachine", label: "High Carb Machine", description: "Handles 120g/hr+ regardless of intensity." },
];

const FORMAT_OPTIONS: FuelFormat[] = ["Gels", "Drink", "Mixed", "ChewsBars"];
const FORMAT_LABEL: Record<FuelFormat, string> = { Gels: "Gels", Drink: "Drink", Mixed: "Mixed", ChewsBars: "Chews/Bars" };
const RATIO_OPTIONS: GlucoseFructoseRatio[] = ["1:1", "2:1", "1:0.8"];
const CUSTOM_PRODUCT_ID = "custom";

function kgToLbs(kg: number): number {
  return kg * 2.20462;
}
function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
}
function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}
function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}
function formatClockFromMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}

const WEIGHT_DEFAULT_KG = 72;
const TEMP_DEFAULT_C = 15;
const ALL_NAMED_PRODUCTS = [...FUEL_PRODUCTS, ...GENERIC_PRODUCTS];

export function EnduranceFuelingCalculator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [zone, setZone] = usePersistedField<HeartRateZone>(persisted?.zone, "70-80%");
  const [giTraining, setGiTraining] = usePersistedField<GiTrainingLevel>(persisted?.giTraining, "Moderate");
  const [weightInput, setWeightInput] = usePersistedField(persisted?.weightInput, String(WEIGHT_DEFAULT_KG));
  const [weightUnit, setWeightUnit] = usePersistedField<"kg" | "lbs">(persisted?.weightUnit, "kg");
  const [tempInput, setTempInput] = usePersistedField(persisted?.tempInput, String(TEMP_DEFAULT_C));
  const [tempUnit, setTempUnit] = usePersistedField<"c" | "f">(persisted?.tempUnit, "c");
  const [durationHoursInput, setDurationHoursInput] = usePersistedField(persisted?.durationHoursInput, "2");
  const [durationMinutesInput, setDurationMinutesInput] = usePersistedField(persisted?.durationMinutesInput, "30");
  const [customCarbTargetInput, setCustomCarbTargetInput] = usePersistedField(persisted?.customCarbTargetInput, "");
  const [useCaffeine, setUseCaffeine] = usePersistedField(persisted?.useCaffeine, false);
  const [fuelFormat, setFuelFormat] = usePersistedField<FuelFormat>(persisted?.fuelFormat, "Gels");
  const [productId, setProductId] = usePersistedField(persisted?.productId, "gel-gu");
  const [useHomemadeDrink, setUseHomemadeDrink] = usePersistedField(persisted?.useHomemadeDrink, false);
  const [glucoseFructoseRatio, setGlucoseFructoseRatio] = usePersistedField<GlucoseFructoseRatio>(
    persisted?.glucoseFructoseRatio,
    "1:1",
  );
  const [customCarbsInput, setCustomCarbsInput] = usePersistedField(persisted?.customCarbsInput, "25");
  const [customSodiumInput, setCustomSodiumInput] = usePersistedField(persisted?.customSodiumInput, "50");
  const [bottleMlInput, setBottleMlInput] = usePersistedField(persisted?.bottleMlInput, "500");
  const [sweatRateOverrideInput, setSweatRateOverrideInput] = usePersistedField(persisted?.sweatRateOverrideInput, "");
  const [sodiumConcentrationOverrideInput, setSodiumConcentrationOverrideInput] = usePersistedField(
    persisted?.sodiumConcentrationOverrideInput,
    "",
  );
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  function handleWeightUnitChange(next: "kg" | "lbs") {
    if (next === weightUnit) return;
    const parsed = Number(weightInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      const converted = next === "kg" ? lbsToKg(parsed) : kgToLbs(parsed);
      setWeightInput(String(Math.round(converted)));
    }
    setWeightUnit(next);
  }

  function handleTempUnitChange(next: "c" | "f") {
    if (next === tempUnit) return;
    const parsed = Number(tempInput);
    if (Number.isFinite(parsed)) {
      setTempInput(String(Math.round(next === "f" ? cToF(parsed) : fToC(parsed))));
    }
    setTempUnit(next);
  }

  function handleFormatChange(next: FuelFormat) {
    setFuelFormat(next);
    const firstMatch = ALL_NAMED_PRODUCTS.find((p) => next === "Mixed" || p.format === next);
    if (firstMatch) setProductId(firstMatch.id);
  }

  const weightRaw = Number(weightInput);
  const weightValid = Number.isFinite(weightRaw) && weightRaw > 0;
  const weightKg = weightValid ? (weightUnit === "kg" ? weightRaw : lbsToKg(weightRaw)) : WEIGHT_DEFAULT_KG;

  const tempRaw = Number(tempInput);
  const tempValid = Number.isFinite(tempRaw);
  const tempC = tempValid ? (tempUnit === "f" ? fToC(tempRaw) : tempRaw) : TEMP_DEFAULT_C;

  const durationHoursRaw = Number(durationHoursInput) || 0;
  const durationMinutesRaw = Number(durationMinutesInput) || 0;
  const durationTotalMinutes = Math.max(0, durationHoursRaw * 60 + durationMinutesRaw);

  const suggestedCarbs = suggestedCarbsPerHour(zone, giTraining);
  const customCarbTargetRaw = Number(customCarbTargetInput);
  const customCarbTargetValid = customCarbTargetInput.trim() !== "" && Number.isFinite(customCarbTargetRaw) && customCarbTargetRaw > 0;
  const carbsPerHour = customCarbTargetValid ? customCarbTargetRaw : suggestedCarbs;

  const modeledFluidLoss = estimatedFluidLossMlPerHour(weightKg, tempC, zone);
  const modeledFluidTarget = fluidTargetMlPerHour(tempC);
  const modeledSodiumLoss = estimatedSodiumLossMgPerHour(tempC);
  const modeledSodiumTarget = sodiumTargetMgPerHour(tempC);

  // A self-measured sweat rate (from a real sweat test) is more accurate
  // than the population-modeled estimate, so when set it overrides the
  // loss estimate -- the target is then rescaled by the same
  // target/loss ratio the model already uses at this temperature, to
  // preserve the same "controlled deficit" logic with the runner's own
  // real number.
  const sweatRateOverrideRaw = Number(sweatRateOverrideInput);
  const sweatRateOverrideValid = sweatRateOverrideInput.trim() !== "" && Number.isFinite(sweatRateOverrideRaw) && sweatRateOverrideRaw > 0;
  const fluidLossMlPerHour = sweatRateOverrideValid ? sweatRateOverrideRaw * 1000 : modeledFluidLoss;
  const fluidTargetFraction = modeledFluidLoss > 0 ? modeledFluidTarget / modeledFluidLoss : 1;
  const fluidTarget = sweatRateOverrideValid ? Math.round(fluidLossMlPerHour * fluidTargetFraction) : modeledFluidTarget;

  const sodiumConcentrationOverrideRaw = Number(sodiumConcentrationOverrideInput);
  const sodiumConcentrationOverrideValid =
    sodiumConcentrationOverrideInput.trim() !== "" && Number.isFinite(sodiumConcentrationOverrideRaw) && sodiumConcentrationOverrideRaw >= 0;
  const sodiumLossMgPerHour = sodiumConcentrationOverrideValid
    ? Math.round((sodiumConcentrationOverrideRaw * fluidLossMlPerHour) / 1000)
    : modeledSodiumLoss;
  const sodiumTargetFraction = modeledSodiumLoss > 0 ? modeledSodiumTarget / modeledSodiumLoss : 1;
  const sodiumTarget = sodiumConcentrationOverrideValid
    ? Math.round(sodiumLossMgPerHour * sodiumTargetFraction)
    : modeledSodiumTarget;

  const measuredSweatRateLPerHour = Math.round((fluidLossMlPerHour / 1000) * 10) / 10;

  const formatProducts = ALL_NAMED_PRODUCTS.filter((p) => fuelFormat === "Mixed" || p.format === fuelFormat);
  const selectedProduct: FuelProduct | null =
    productId === CUSTOM_PRODUCT_ID
      ? {
          id: CUSTOM_PRODUCT_ID,
          name: "Your product",
          format: fuelFormat === "Mixed" ? "Gels" : fuelFormat,
          carbsPerServingG: Math.max(1, Number(customCarbsInput) || 1),
          sodiumPerServingMg: Math.max(0, Number(customSodiumInput) || 0),
          fluidPerServingMl: fuelFormat === "Drink" ? Math.max(1, Number(bottleMlInput) || 1) : 0,
          ratio: "",
          isCaffeine: false,
        }
      : (formatProducts.find((p) => p.id === productId) ?? formatProducts[0] ?? null);

  const bottleMl = Math.max(1, Number(bottleMlInput) || 500);
  const homemadeRecipe = computeHomemadeDrinkRecipe(carbsPerHour, sodiumTarget, fluidTarget, bottleMl, glucoseFructoseRatio);

  const schedule =
    !useHomemadeDrink && selectedProduct
      ? generateFuelingSchedule(durationTotalMinutes, carbsPerHour, fluidTarget, sodiumTarget, selectedProduct, {
          useCaffeine,
          bodyWeightKg: weightKg,
          catalog: FUEL_PRODUCTS,
        })
      : [];
  const scheduleTotals = totalsForSchedule(schedule);
  const totalEnergyKcal = caloriesFromCarbGrams(scheduleTotals.carbsG || carbsPerHour * (durationTotalMinutes / 60));
  const kcalPerHour = caloriesFromCarbGrams(carbsPerHour);

  return (
    <div className="mt-10 space-y-10">
      <div className={statCardClass}>
        <p className={statLabelClass}>Your effort</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ZONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setZone(option.value)}
              aria-pressed={zone === option.value}
              title={option.description}
              className={segmentedButtonClass(zone === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
          {ZONE_OPTIONS.find((o) => o.value === zone)?.description}
        </p>
      </div>

      <div className={statCardClass}>
        <p className={statLabelClass}>GI training</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GI_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGiTraining(option.value)}
              aria-pressed={giTraining === option.value}
              title={option.description}
              className={segmentedButtonClass(giTraining === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
          {GI_OPTIONS.find((o) => o.value === giTraining)?.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <label htmlFor={`${baseId}-weight`} className={labelClass}>
            Body weight
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`${baseId}-weight`}
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
              className={`w-24 ${fieldClass}`}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleWeightUnitChange("kg")}
                aria-pressed={weightUnit === "kg"}
                className={segmentedButtonClass(weightUnit === "kg")}
              >
                kg
              </button>
              <button
                type="button"
                onClick={() => handleWeightUnitChange("lbs")}
                aria-pressed={weightUnit === "lbs"}
                className={segmentedButtonClass(weightUnit === "lbs")}
              >
                lbs
              </button>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor={`${baseId}-temp`} className={labelClass}>
            Temperature
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`${baseId}-temp`}
              type="number"
              inputMode="decimal"
              value={tempInput}
              onChange={(event) => setTempInput(event.target.value)}
              className={`w-20 ${fieldClass}`}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleTempUnitChange("c")}
                aria-pressed={tempUnit === "c"}
                className={segmentedButtonClass(tempUnit === "c")}
              >
                °C
              </button>
              <button
                type="button"
                onClick={() => handleTempUnitChange("f")}
                aria-pressed={tempUnit === "f"}
                className={segmentedButtonClass(tempUnit === "f")}
              >
                °F
              </button>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor={`${baseId}-duration-h`} className={labelClass}>
            Session duration
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${baseId}-duration-h`}
              type="number"
              inputMode="numeric"
              min={0}
              value={durationHoursInput}
              onChange={(event) => setDurationHoursInput(event.target.value)}
              className={`w-16 ${fieldClass}`}
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">h</span>
            <input
              id={`${baseId}-duration-m`}
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={durationMinutesInput}
              onChange={(event) => setDurationMinutesInput(event.target.value)}
              className={`w-16 ${fieldClass}`}
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">min</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <p className={statLabelClass}>Suggested fueling, per hour</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Total energy: <span className="font-semibold text-zinc-900 dark:text-white">{totalEnergyKcal} kcal</span>{" "}
            (~{kcalPerHour} kcal/hr)
          </p>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className={heroCardClass}>
            <p className={statLabelClass}>Carbs</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-white">{carbsPerHour} g/hr</p>
            {customCarbTargetValid && (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Suggested: {suggestedCarbs} g/hr</p>
            )}
          </div>
          <div className={heroCardClass}>
            <p className={statLabelClass}>Fluid target</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-white">{fluidTarget} mL/hr</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              Est. loss: ~{fluidLossMlPerHour} mL/hr &mdash; a full replacement isn&rsquo;t necessary; see
              &ldquo;Behind the calculator&rdquo; below.
            </p>
          </div>
          <div className={statCardClass}>
            <p className={statLabelClass}>Sodium target</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{sodiumTarget} mg/hr</p>
          </div>
          <div className={statCardClass}>
            <p className={statLabelClass}>Sodium (estimated loss)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{sodiumLossMgPerHour} mg/hr</p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor={`${baseId}-custom-carb-target`} className={labelClass}>
            Set custom carb target (g/hr)
          </label>
          <input
            id={`${baseId}-custom-carb-target`}
            type="number"
            inputMode="decimal"
            placeholder="Leave blank for suggestion"
            value={customCarbTargetInput}
            onChange={(event) => setCustomCarbTargetInput(event.target.value)}
            className={`mt-1 w-48 ${fieldClass}`}
          />
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Only set this if you have a specific goal from a coach, are testing a rate in training, or know your
            own tolerance differs from the suggestion.
          </p>
        </div>
      </div>

      <div className={statCardClass}>
        <p className={statLabelClass}>Strategy options</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUseCaffeine((v) => !v)}
            aria-pressed={useCaffeine}
            className={segmentedButtonClass(useCaffeine)}
          >
            Include caffeine strategy
          </button>
          <button
            type="button"
            onClick={() => setUseHomemadeDrink((v) => !v)}
            aria-pressed={useHomemadeDrink}
            className={segmentedButtonClass(useHomemadeDrink)}
          >
            Use a homemade (DIY) sports drink instead
          </button>
        </div>
        {useCaffeine && (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            A ~{caffeinePreloadDoseMg(weightKg)}mg pre-load (~60 min before start) plus one mid-session serving
            swapped for a caffeinated version of your chosen product, when one exists in the catalog.
          </p>
        )}

        <div className="mt-5">
          <label htmlFor={`${baseId}-sweat-rate`} className={labelClass}>
            Sweat rate (L/hr)
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id={`${baseId}-sweat-rate`}
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={`Not set (est. ${measuredSweatRateLPerHour} L/hr)`}
              value={sweatRateOverrideInput}
              onChange={(event) => setSweatRateOverrideInput(event.target.value)}
              className={`w-48 ${fieldClass}`}
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-300">
              From a real sweat test (weigh yourself before/after a run), this replaces the estimate above.
            </span>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor={`${baseId}-sodium-conc`} className={labelClass}>
            Sodium loss (mg/L sweat)
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id={`${baseId}-sodium-conc`}
              type="number"
              inputMode="decimal"
              placeholder="Leave blank to estimate"
              value={sodiumConcentrationOverrideInput}
              onChange={(event) => setSodiumConcentrationOverrideInput(event.target.value)}
              className={`w-48 ${fieldClass}`}
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-300">From a sweat sodium test, if you have one.</span>
          </div>
        </div>
      </div>

      <div className={statCardClass}>
        <p className={statLabelClass}>Fuel type</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => handleFormatChange(format)}
              aria-pressed={fuelFormat === format}
              className={segmentedButtonClass(fuelFormat === format)}
            >
              {FORMAT_LABEL[format]}
            </button>
          ))}
        </div>

        {!useHomemadeDrink && (
          <div className="mt-4">
            <label htmlFor={`${baseId}-product`} className={labelClass}>
              Product
            </label>
            <select
              id={`${baseId}-product`}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className={`mt-1 w-full max-w-md ${fieldClass}`}
            >
              <optgroup label={`Named products (${formatProducts.length}) -- approximate, verify against your label`}>
                {formatProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.carbsPerServingG}g C / {p.sodiumPerServingMg}mg Na
                    {p.ratio ? ` / ${p.ratio}` : ""})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Your own product">
                <option value={CUSTOM_PRODUCT_ID}>Custom -- enter your own label values</option>
              </optgroup>
            </select>

            {productId === CUSTOM_PRODUCT_ID && (
              <div className="mt-3 flex flex-wrap gap-4">
                <div>
                  <label htmlFor={`${baseId}-custom-carbs`} className={labelClass}>
                    Carbs / serving (g)
                  </label>
                  <input
                    id={`${baseId}-custom-carbs`}
                    type="number"
                    inputMode="decimal"
                    value={customCarbsInput}
                    onChange={(event) => setCustomCarbsInput(event.target.value)}
                    className={`mt-1 w-24 ${fieldClass}`}
                  />
                </div>
                <div>
                  <label htmlFor={`${baseId}-custom-sodium`} className={labelClass}>
                    Sodium / serving (mg)
                  </label>
                  <input
                    id={`${baseId}-custom-sodium`}
                    type="number"
                    inputMode="decimal"
                    value={customSodiumInput}
                    onChange={(event) => setCustomSodiumInput(event.target.value)}
                    className={`mt-1 w-24 ${fieldClass}`}
                  />
                </div>
                {fuelFormat === "Drink" && (
                  <div>
                    <label htmlFor={`${baseId}-custom-bottle`} className={labelClass}>
                      Serving volume (mL)
                    </label>
                    <input
                      id={`${baseId}-custom-bottle`}
                      type="number"
                      inputMode="decimal"
                      value={bottleMlInput}
                      onChange={(event) => setBottleMlInput(event.target.value)}
                      className={`mt-1 w-24 ${fieldClass}`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {useHomemadeDrink && (
          <div className="mt-4">
            <p className={groupLabelClass}>Glucose:Fructose ratio</p>
            <div className="flex flex-wrap gap-2">
              {RATIO_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setGlucoseFructoseRatio(r)}
                  aria-pressed={glucoseFructoseRatio === r}
                  className={segmentedButtonClass(glucoseFructoseRatio === r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              {glucoseFructoseRatio === "1:1"
                ? "Plain table sugar (sucrose) is naturally a 1:1 glucose:fructose mix -- the simplest, cheapest option, matching the two intestinal carb transporters (SGLT1 and GLUT5)."
                : "A maltodextrin:fructose blend in this ratio, the same multiple-transportable-carbohydrate approach most commercial dual-carb products use to support higher intake rates."}
            </p>

            <label htmlFor={`${baseId}-bottle`} className={`${labelClass} mt-4 block`}>
              Bottle size (mL)
            </label>
            <input
              id={`${baseId}-bottle`}
              type="number"
              inputMode="decimal"
              value={bottleMlInput}
              onChange={(event) => setBottleMlInput(event.target.value)}
              className={`mt-1 w-24 ${fieldClass}`}
            />
            <p className={`${groupLabelClass} mt-4`}>Per bottle, to match your hourly targets</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              {homemadeRecipe.sucroseGrams !== undefined ? (
                <div className={statCardClass}>
                  <p className={statLabelClass}>Table sugar</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">{homemadeRecipe.sucroseGrams} g</p>
                </div>
              ) : (
                <>
                  <div className={statCardClass}>
                    <p className={statLabelClass}>Maltodextrin</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">{homemadeRecipe.maltodextrinGrams} g</p>
                  </div>
                  <div className={statCardClass}>
                    <p className={statLabelClass}>Fructose</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">{homemadeRecipe.fructoseGrams} g</p>
                  </div>
                </>
              )}
              <div className={statCardClass}>
                <p className={statLabelClass}>Table salt</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">{homemadeRecipe.saltGrams} g</p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>Water</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">{homemadeRecipe.waterMl} mL</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {!useHomemadeDrink && selectedProduct && selectedProduct.carbsPerServingG <= 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {selectedProduct.name} has no carbohydrate content, so it can&rsquo;t be scheduled against a carb
          target on its own &mdash; it&rsquo;s an electrolyte/hydration product. Pick a carb-containing product,
          or use it alongside one via Custom.
        </p>
      )}

      {!useHomemadeDrink && selectedProduct && schedule.length > 0 && (
        <div className="print:mt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={statLabelClass}>
              Fueling schedule ({formatClockFromMinutes(durationTotalMinutes)}, {schedule.length}{" "}
              {schedule.length === 1 ? "serving" : "servings"})
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-black/5 print:hidden dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              Save as PDF
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left dark:border-white/10">
                  <th className="py-2 pr-4 font-semibold text-zinc-600 dark:text-zinc-300">Time</th>
                  <th className="py-2 pr-4 font-semibold text-zinc-600 dark:text-zinc-300">Fuel</th>
                  <th className="py-2 pr-4 font-semibold text-zinc-600 dark:text-zinc-300">Fluid</th>
                  <th className="py-2 pr-4 font-semibold text-zinc-600 dark:text-zinc-300">Carbs</th>
                  <th className="py-2 font-semibold text-zinc-600 dark:text-zinc-300">Sodium</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {schedule.map((entry, i) => (
                  <tr key={i} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4 align-top">{entry.minute === 0 ? "Start" : formatClockFromMinutes(entry.minute)}</td>
                    <td className="py-2 pr-4 align-top">
                      {entry.product.name}
                      {entry.note && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{entry.note}</p>}
                    </td>
                    <td className="py-2 pr-4 align-top">{entry.fluidMl > 0 ? `${entry.fluidMl} mL` : "—"}</td>
                    <td className="py-2 pr-4 align-top">{entry.carbsG} g</td>
                    <td className="py-2 align-top">{entry.sodiumMg} mg</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/10 font-semibold dark:border-white/10">
                  <td className="py-2 pr-4" colSpan={2}>
                    Total
                  </td>
                  <td className="py-2 pr-4">{scheduleTotals.fluidMl} mL</td>
                  <td className="py-2 pr-4">{scheduleTotals.carbsG} g</td>
                  <td className="py-2">{scheduleTotals.sodiumMg} mg</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <SaveCalculationButton
            calculatorType="endurance-fueling"
            input={{
              zone,
              giTraining,
              weightKg: Math.round(weightKg),
              tempC: Math.round(tempC),
              durationMinutes: durationTotalMinutes,
              product: selectedProduct.name,
              useCaffeine,
            }}
            output={{ carbsPerHour, fluidTarget, fluidLossMlPerHour, sodiumTarget, sodiumLossMgPerHour, totalEnergyKcal, scheduleTotals }}
            label={`${carbsPerHour}g carbs/hr, ${schedule.length} servings over ${formatClockFromMinutes(durationTotalMinutes)}`}
          />
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowMethodology((value) => !value)}
          aria-expanded={showMethodology}
          className="flex items-center gap-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Behind the calculator: formulas, assumptions, and limitations
          <span aria-hidden="true" className="text-sm font-normal">
            {showMethodology ? "↑" : "↓"}
          </span>
        </button>
        {showMethodology && (
          <div className="mt-4 max-w-[64ch] space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                How these targets are calculated
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Carb rate is driven purely by effort intensity and your own gut-training level &mdash; body
                  weight, temperature, and session length don&rsquo;t change it (set a custom target above to
                  override it entirely). &ldquo;High Carb Machine&rdquo; is a flat 120g/hr regardless of effort,
                  matching real high-intake-trained athletes who can absorb that rate at any intensity. Fluid
                  loss (how much you&rsquo;re actually sweating out) scales with body weight, effort, and heat,
                  but the fluid <em>target</em> shown above it is a deliberately smaller number driven by heat
                  alone &mdash; a controlled, incomplete fluid replacement (typically a 1&ndash;2% body-weight
                  deficit) doesn&rsquo;t hurt performance and is a genuine, common hydration strategy, not a
                  shortfall to fix. Sodium works the same way: the loss estimate and the (deliberately lower)
                  target both scale with heat alone. A real sweat test (weighing yourself before/after a run)
                  is more accurate than either estimate, so entering your own measured sweat rate or sodium
                  concentration above replaces the modeled number, rescaled to the same controlled-deficit
                  logic.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Caffeine strategy
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  A ~3mg/kg body-weight pre-exercise caffeine dose is a widely-cited, ACSM/ISSN-consistent
                  guideline for endurance performance (studied effective range is roughly 3&ndash;6mg/kg; this
                  is the conservative low end). When enabled, this calculator notes that pre-load dose about 60
                  minutes before your session, and swaps roughly the serving closest to halfway through your
                  schedule for a caffeinated version of your chosen product, when one exists in the catalog
                  &mdash; a real, common pacing choice (an early dose plus a mid-session boost) rather than
                  loading all your caffeine at the start.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                How the schedule is built
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The schedule below uses the carb, fluid, and sodium <em>targets</em> shown above (already the
                  calculator&rsquo;s own controlled-deficit numbers, not a raw sweat-loss estimate) and
                  multiplies each by your session length to get a total, then divides that by your chosen
                  product&rsquo;s carbs-per-serving to space servings evenly across the session. That flat
                  rate-&times;-duration multiplication is a deliberately simpler choice than the source
                  calculator&rsquo;s own cumulative-total behavior, which this site collected real data on but
                  couldn&rsquo;t fit reliably enough to reproduce exactly &mdash; the real relationship between
                  session length and total intake appears to involve more than each hourly rate staying flat for
                  the whole session. Treat the schedule as a reasonable planning estimate, not an exact
                  reproduction of the source tool&rsquo;s own numbers. Total energy (kcal) uses the standard
                  4 kcal/g carbohydrate conversion.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Product data and the DIY recipe
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The 266-product catalog (gels, drinks, chews, and bars) is a direct transcription of the real
                  product list the source calculator displays, read the same way every value in this
                  calculator is read: as output rendered on a page this site&rsquo;s owner has legitimate access
                  to, not from source code. Manufacturers do change formulations, so treat every named value as
                  a snapshot rather than a live label; use Custom (type in your own product&rsquo;s current
                  label) whenever precision matters. The homemade drink recipe uses standard DIY sports-drink
                  chemistry: table sugar is ~100% carbohydrate by mass, table salt is ~39% sodium by mass (1g
                  salt supplies ~393mg sodium), and a 2:1 or 1:0.8 glucose:fructose blend uses maltodextrin plus
                  fructose in that mass ratio.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Source
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  The per-hour carb, fluid, and sodium rates above are independently reverse-engineered from
                  Göran Winblad&rsquo;s{" "}
                  <a
                    href="https://goranwinblad.se/endurancefuelingcalculator/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    GW Endurance Fueling Calculator
                  </a>
                  : every rate was fit from real collected inputs and outputs, not read from source code. The
                  fuel-product catalog is read directly from that page&rsquo;s own displayed output (see above); the
                  DIY recipe math, caffeine dosing, energy conversion, and session schedule are this
                  site&rsquo;s own, independently-sourced additions.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
