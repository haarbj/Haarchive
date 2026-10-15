// A real fuel-product catalog and session-schedule math for the Endurance
// Fueling Calculator, layered on top of the black-box-fit hourly targets
// in endurance-fueling-math.ts.
//
// Unlike that module, the product catalog below was NOT fit by regression
// -- it's a direct transcription of the real product list displayed by
// the source calculator (goranwinblad.se/endurancefuelingcalculator/,
// Goran Winblad): 266 real named products (125 gels, 80 drinks, 61
// chews/bars) with their real carb/sodium-per-serving values and
// glucose:fructose ratios, read the same way every other value in this
// codebase's reverse-engineered modules is read -- as displayed output on
// a page this site's owner has legitimate access to, not from source code
// or a downloaded data file. This replaces an earlier, smaller
// (~20-product) approximate list built from general nutrition-label
// knowledge, after a capability-parity review found the source
// calculator's real catalog to be both larger and directly readable.
//
// The DIY homemade-drink chemistry, the caffeine-dosing guideline, the
// kcal conversion, and the session-schedule arithmetic below are NOT
// reverse-engineered either -- they're ordinary, citable sports-nutrition
// math (see each section's own comment for its source), independently
// implemented to match the source calculator's real *capability*, not
// its literal formula.

export type FuelFormat = "Gels" | "Drink" | "Mixed" | "ChewsBars";

export type FuelProduct = {
  id: string;
  /** Full display name, brand included (the source catalog doesn't cleanly separate the two for every entry, e.g. "Carb-Boom! Energy Gel"). */
  name: string;
  format: Exclude<FuelFormat, "Mixed">;
  carbsPerServingG: number;
  sodiumPerServingMg: number;
  /** Typical fluid volume the serving itself contributes, for Drink-format products (mL). Gels/chews/bars are taken with separate water, so this is 0 for those. */
  fluidPerServingMl: number;
  /** The product's own stated glucose:fructose (or similar dual-carb) ratio, exactly as the source catalog lists it, e.g. "2:1", "1:0.8", "Natural Carbs", "Slow-release starch". Empty string when the source lists no ratio (typically a single-carb-source or electrolyte-only product). */
  ratio: string;
  /** True for products whose name identifies a caffeinated variant of a base product (see findCaffeineVariant below). */
  isCaffeine: boolean;
};

export const GENERATED_GEL_PRODUCTS: FuelProduct[] = [
  { id: "gel-32gi", name: "32Gi Endure Sports Gel", format: "Gels", carbsPerServingG: 21.0, sodiumPerServingMg: 59.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-6d-double-carb", name: "6d Sports Nutrition Double Carb Drink Gel", format: "Gels", carbsPerServingG: 60.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-6d-energy", name: "6d Sports Nutrition Energy Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-6d-energy-caf", name: "6d Sports Nutrition Energy Gel + Caffeine", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-6d-isotonic", name: "6d Sports Nutrition Isotonic Drink Gel", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-6d-salt", name: "6d Sports Nutrition Salt Gel", format: "Gels", carbsPerServingG: 0.0, sodiumPerServingMg: 300.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "gel-6d-ultra", name: "6d Sports Nutrition Ultra Gel", format: "Gels", carbsPerServingG: 45.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "1:1", isCaffeine: false },
  { id: "gel-amacx-drink", name: "Amacx Drink Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-amacx-turbo", name: "Amacx Turbo Gel", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-aptonia", name: "Aptonia Energy Gel", format: "Gels", carbsPerServingG: 23.0, sodiumPerServingMg: 46.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-bix", name: "BIX ACTIVE Energy Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-bpn-go", name: "BPN Go Gel", format: "Gels", carbsPerServingG: 24.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-bpn-go-caf", name: "BPN Go Gel + Caffeine", format: "Gels", carbsPerServingG: 24.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-cadence-c30", name: "Cadence C30 Energy Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-cadence-c30-caf", name: "Cadence C30+ Caffeine Energy Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-carb-boom", name: "Carb-Boom! Energy Gel", format: "Gels", carbsPerServingG: 26.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "1:0", isCaffeine: false },
  { id: "gel-carbs-fuel-original", name: "Carbs Fuel Original 50g Energy Gel", format: "Gels", carbsPerServingG: 50.0, sodiumPerServingMg: 105.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-carbs-fuel-salted", name: "Carbs Fuel Salted Original 50g Energy Gel", format: "Gels", carbsPerServingG: 50.0, sodiumPerServingMg: 450.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-chargel", name: "Chargel Gel Drink", format: "Gels", carbsPerServingG: 45.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "Mixed Carbs", isCaffeine: false },
  { id: "gel-clif-shot", name: "Clif Shot Energy Gel", format: "Gels", carbsPerServingG: 24.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-crank-e-gel", name: "Crank Sports e-Gel", format: "Gels", carbsPerServingG: 37.0, sodiumPerServingMg: 125.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-decathlon-108", name: "Decathlon Energy Gel 1:0.8", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-e-fuel", name: "E-Fuel Gel", format: "Gels", carbsPerServingG: 28.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-endurance-tap", name: "Endurance Tap Salted Maple Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "gel-enervit-c21pro", name: "Enervit C2:1PRO Carbo Gel", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-enervit-isotonic", name: "Enervit Isotonic Gel", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 80.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-enervit-liquid", name: "Enervit Liquid Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 25.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-enervit-liquid-caf", name: "Enervit Liquid Gel + Caffeine", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 25.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-enervit-sport", name: "Enervit Sport Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 20.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-first-endurance-liquid-shot", name: "First Endurance EFS Liquid Shot", format: "Gels", carbsPerServingG: 100.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-for-goodness", name: "For Goodness Shakes Energy Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-fon-ug-31", name: "Fuel of Norway - U.GEL 1:0.8 (31g carb)", format: "Gels", carbsPerServingG: 31.0, sodiumPerServingMg: 40.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-fon-ug-31-caf", name: "Fuel of Norway - U.GEL 1:0.8 (31g carb) + Caffeine", format: "Gels", carbsPerServingG: 31.0, sodiumPerServingMg: 40.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-fon-loaded-40", name: "Fuel of Norway - U.GEL LOADED 1:0.8 (40g carb)", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 153.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-fon-loaded-40-caf", name: "Fuel of Norway - U.GEL LOADED 1:0.8 (40g carb) + Caffeine", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 153.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-gatorade-endurance", name: "Gatorade Endurance Carb Energy Gel", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-generic", name: "Generic Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-gu", name: "GU Energy Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-gu-liquid", name: "GU Liquid Energy Gel", format: "Gels", carbsPerServingG: 23.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-gu-roctane", name: "GU Roctane Ultra Endurance Gel", format: "Gels", carbsPerServingG: 21.0, sodiumPerServingMg: 125.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-hammer", name: "Hammer Nutrition Hammer Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 25.0, fluidPerServingMl: 0, ratio: "1:0", isCaffeine: false },
  { id: "gel-high5-aqua", name: "High5 Aqua Gel", format: "Gels", carbsPerServingG: 23.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-high5-aqua-caffeine", name: "High5 Aqua Gel Caffeine", format: "Gels", carbsPerServingG: 23.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-high5", name: "High5 Energy Gel", format: "Gels", carbsPerServingG: 23.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-honey-stinger-gold", name: "Honey Stinger Gold Gel", format: "Gels", carbsPerServingG: 24.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-honey-stinger-plus", name: "Honey Stinger Plus Performance Gel", format: "Gels", carbsPerServingG: 24.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-huma-chia", name: "Huma Chia Energy Gel", format: "Gels", carbsPerServingG: 21.0, sodiumPerServingMg: 105.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-huma-plus", name: "Huma Plus Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 240.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-isostar", name: "Isostar Actifood Gel", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 40.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-kendal-mint", name: "Kendal Mint Co. KMC NRG GEL", format: "Gels", carbsPerServingG: 27.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-koda", name: "Koda Energy Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 36.0, fluidPerServingMl: 0, ratio: "1:0", isCaffeine: false },
  { id: "gel-maurten-100", name: "Maurten Gel 100", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-maurten-100-caf", name: "Maurten Gel 100 Caf 100", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-maurten-160", name: "Maurten Gel 160", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-maxim", name: "Maxim Energy Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-maxim-drink", name: "Maxim Energy Gel Drink", format: "Gels", carbsPerServingG: 31.0, sodiumPerServingMg: 35.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-maxim-supreme", name: "Maxim Supreme Gel + Caffeine", format: "Gels", carbsPerServingG: 21.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-mountain-fuel", name: "Mountain Fuel Sports Jelly+", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-muir", name: "Muir Energy Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 70.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-mule-bar", name: "Mule Bar Kicks Gel", format: "Gels", carbsPerServingG: 26.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-myprotein", name: "My Protein Energy Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-myprotein-elite", name: "My Protein Energy Gel Elite", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-naak", name: "Näak Ultra Energy Gel", format: "Gels", carbsPerServingG: 28.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-namedsport", name: "NamedSport Isotonic Power Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 70.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-neversecond-c30", name: "Neversecond C30 Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-neversecond-c30-caf", name: "Neversecond C30 Gel + Caffeine", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-ote", name: "OTE Energy Gel", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-ote-super", name: "OTE Super Gel", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-overstims", name: "OVERSTIM.s Coup de Fouet", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 40.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-powerbar-hydro", name: "PowerBar Hydro Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 300.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-powerbar-powergel", name: "Powerbar PowerGel", format: "Gels", carbsPerServingG: 26.0, sodiumPerServingMg: 205.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-precision-30-caf", name: "Precision Fuel PF 30 Caffeine Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-precision-30", name: "Precision Fuel PF 30 Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-precision-300-flow", name: "Precision Fuel PF 300 Flow Gel", format: "Gels", carbsPerServingG: 300.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-precision-90", name: "Precision Fuel PF 90 Gel", format: "Gels", carbsPerServingG: 90.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-pure-fluid", name: "PURE Fluid Energy Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-pure-fluid-caf", name: "PURE Fluid Energy Gel + Caffeine", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: true },
  { id: "gel-pure-race", name: "PURE Performance+ Race Energy Gel", format: "Gels", carbsPerServingG: 38.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-pure-race-caf", name: "PURE Performance+ Race Energy Gel + Caffeine", format: "Gels", carbsPerServingG: 38.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-rawvelo", name: "Rawvelo Energy Gel", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-rocketfuel-race", name: "RocketFuel Endurance RACE Gel", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-rocketfuel-race-plus", name: "RocketFuel Endurance RACE+ Gel", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-rocketfuel-train", name: "RocketFuel Endurance TRAIN Gel", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-santamadre-100", name: "Santamadre Unusual Gel 100CHO", format: "Gels", carbsPerServingG: 100.0, sodiumPerServingMg: 383.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-santamadre-30", name: "Santamadre Unusual Gel 30CHO", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 115.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-santamadre-30-caf", name: "Santamadre Unusual Gel 30CHO + Caffeine", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 115.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-santamadre-60", name: "Santamadre Unusual Gel 60CHO", format: "Gels", carbsPerServingG: 60.0, sodiumPerServingMg: 230.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-secret-training", name: "Secret Training STEALTH Energy Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 70.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-sis-beta", name: "SiS Beta Fuel + Electrolyte Gel", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-sis-beta-nootropics", name: "SiS Beta Fuel Gel + Nootropics", format: "Gels", carbsPerServingG: 40.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-sis-go-caf", name: "SiS Go + Caffeine Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 15.0, fluidPerServingMl: 0, ratio: "1:0", isCaffeine: true },
  { id: "gel-sis-go-electrolyte", name: "SiS Go Isotonic + Electrolyte Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 118.0, fluidPerServingMl: 0, ratio: "1:0", isCaffeine: false },
  { id: "gel-sis-go-isotonic", name: "SiS Go Isotonic Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 4.0, fluidPerServingMl: 0, ratio: "1:0", isCaffeine: false },
  { id: "gel-sponser-high", name: "Sponser High Energy Gel", format: "Gels", carbsPerServingG: 36.0, sodiumPerServingMg: 55.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-sponser-liquid", name: "Sponser Liquid Energy Plus", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 55.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-spring-awesome", name: "Spring Energy Awesome Sauce", format: "Gels", carbsPerServingG: 28.0, sodiumPerServingMg: 45.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-spring-canaberry", name: "Spring Energy Canaberry", format: "Gels", carbsPerServingG: 17.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-spring-hill-aid", name: "Spring Energy Hill Aid", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-spring-long-haul", name: "Spring Energy Long Haul", format: "Gels", carbsPerServingG: 19.0, sodiumPerServingMg: 140.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-spring-speednut", name: "Spring Energy Speednut", format: "Gels", carbsPerServingG: 19.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-styrkr-30", name: "Styrkr GEL30", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-styrkr-30-caf", name: "Styrkr GEL30 Caffeine + Nootropics", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-thefeedlab", name: "The Feed Lab Feed Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-thefeedlab-caf", name: "The Feed Lab Feed Gel + Caffeine", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-torq-caf", name: "Torq Caffeine Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 55.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-torq", name: "Torq Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 55.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-tribe", name: "TRIBE NUTRI-GEL", format: "Gels", carbsPerServingG: 25.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-ucan-edge", name: "UCAN Edge", format: "Gels", carbsPerServingG: 19.0, sodiumPerServingMg: 55.0, fluidPerServingMl: 0, ratio: "Slow-release starch", isCaffeine: false },
  { id: "gel-ucan-edge-caf", name: "UCAN Edge + Caffeine", format: "Gels", carbsPerServingG: 19.0, sodiumPerServingMg: 55.0, fluidPerServingMl: 0, ratio: "Slow-release starch", isCaffeine: true },
  { id: "gel-umara-1-0-8-20g", name: "Umara U Gel 1:0.8 (20g)", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 171.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-umara-1-0-8-20g-caf", name: "Umara U Gel 1:0.8 (20g) + Caffeine", format: "Gels", carbsPerServingG: 20.0, sodiumPerServingMg: 171.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-umara-1-0-8-30g", name: "Umara U Gel 1:0.8 (30g)", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 257.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "gel-umara-1-0-8-30g-caf", name: "Umara U Gel 1:0.8 (30g) + Caffeine", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 257.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: true },
  { id: "gel-untapped-maple", name: "UnTapped Maple Syrup Gel", format: "Gels", carbsPerServingG: 26.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "gel-untapped-raspberry", name: "UnTapped Salted Raspberry Gel", format: "Gels", carbsPerServingG: 26.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "gel-usn-energy", name: "USN Energy Gel", format: "Gels", carbsPerServingG: 24.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-usn-epic", name: "USN Epic Pro Energy Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-usn-iso", name: "USN Isotonic Energy Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 80.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-usn-vo2", name: "USN VO2 Max Energy Gel", format: "Gels", carbsPerServingG: 24.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-veloforte-doppio", name: "Veloforte Doppio (caffeine)", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: true },
  { id: "gel-veloforte", name: "Veloforte Energy Gel", format: "Gels", carbsPerServingG: 22.0, sodiumPerServingMg: 75.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "gel-vfuel", name: "VFuel Endurance Gel", format: "Gels", carbsPerServingG: 21.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-vfuel-caf", name: "VFuel Endurance Gel + Caffeine", format: "Gels", carbsPerServingG: 21.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "gel-victus", name: "Victus Energy Gel", format: "Gels", carbsPerServingG: 30.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "gel-winforce", name: "Winforce Ultra Energy Complex Gel", format: "Gels", carbsPerServingG: 45.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
];

export const GENERATED_DRINK_PRODUCTS: FuelProduct[] = [
  { id: "drink-226ers", name: "226ERS Energy Drink", format: "Drink", carbsPerServingG: 45.0, sodiumPerServingMg: 275.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-6d-energy", name: "6d Sports Nutrition Sports Drink", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-6d-isotonic", name: "6d Sports Nutrition Sports Drink Isotonic", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-active-root", name: "Active Root", format: "Drink", carbsPerServingG: 32.0, sodiumPerServingMg: 280.0, fluidPerServingMl: 500, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-amacx-energy", name: "Amacx Energy Drink", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-bpn-electrolytes", name: "BPN Electrolytes (Hydration)", format: "Drink", carbsPerServingG: 0.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
  { id: "drink-bpn-g1m", name: "BPN G.1.M Sport", format: "Drink", carbsPerServingG: 20.0, sodiumPerServingMg: 350.0, fluidPerServingMl: 355, ratio: "Cluster Dextrin (1:0.8)", isCaffeine: false },
  { id: "drink-bpn-intra-flight", name: "BPN Intra-Flight", format: "Drink", carbsPerServingG: 8.0, sodiumPerServingMg: 170.0, fluidPerServingMl: 355, ratio: "Cluster Dextrin (1:0.8)", isCaffeine: false },
  { id: "drink-cadence-c60", name: "Cadence C60 Energy Drink", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-carbopro", name: "Carbopro", format: "Drink", carbsPerServingG: 100.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 1000, ratio: "1:0", isCaffeine: false },
  { id: "drink-carbs-fuel", name: "Carbs Fuel Drink Mix", format: "Drink", carbsPerServingG: 80.0, sodiumPerServingMg: 1000.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-clif-hydration", name: "Clif Hydration Electrolyte Drink Mix", format: "Drink", carbsPerServingG: 16.0, sodiumPerServingMg: 420.0, fluidPerServingMl: 500, ratio: "1:0", isCaffeine: false },
  { id: "drink-decathlon-108-1kg", name: "Decathlon 1:0.8 Energy Drink Powder", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-decathlon-108-single", name: "Decathlon 1:0.8 Energy Drink Powder Single Sachet", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-enervit-c21pro", name: "Enervit C2:1PRO Carbo Drink", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 240.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-enervit-isotonic", name: "Enervit Isotonic Drink", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 210.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-f2c-glyco", name: "F2C Glyco-Durance", format: "Drink", carbsPerServingG: 80.0, sodiumPerServingMg: 425.0, fluidPerServingMl: 750, ratio: "2:1", isCaffeine: false },
  { id: "drink-first-endurance-efs", name: "First Endurance EFS", format: "Drink", carbsPerServingG: 29.0, sodiumPerServingMg: 300.0, fluidPerServingMl: 355, ratio: "2:1", isCaffeine: false },
  { id: "drink-first-endurance-efs-pro", name: "First Endurance EFS-PRO", format: "Drink", carbsPerServingG: 80.0, sodiumPerServingMg: 1200.0, fluidPerServingMl: 710, ratio: "2:1", isCaffeine: false },
  { id: "drink-flow-formulas", name: "Flow Formulas Endurance Drink Mix", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 1000.0, fluidPerServingMl: 1000, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-fluid-performance", name: "Fluid Performance", format: "Drink", carbsPerServingG: 50.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 620, ratio: "2:1", isCaffeine: false },
  { id: "drink-fon-60", name: "Fuel of Norway Sports Drink (60g)", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 330.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-fon-90", name: "Fuel of Norway Sports Drink (90g)", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-gatorade-endurance", name: "Gatorade Endurance Formula", format: "Drink", carbsPerServingG: 31.0, sodiumPerServingMg: 490.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-generic", name: "Generic Drink Mix", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 300.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-gnarly-fuel2o", name: "Gnarly Fuel2O", format: "Drink", carbsPerServingG: 25.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 355, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-gu-hydration-tabs", name: "GU Hydration Drink Tabs", format: "Drink", carbsPerServingG: 1.0, sodiumPerServingMg: 320.0, fluidPerServingMl: 475, ratio: "1:0", isCaffeine: false },
  { id: "drink-gu-roctane", name: "GU Roctane Energy Drink Mix", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 320.0, fluidPerServingMl: 620, ratio: "2:1", isCaffeine: false },
  { id: "drink-hammer-heed", name: "Hammer HEED", format: "Drink", carbsPerServingG: 27.0, sodiumPerServingMg: 35.0, fluidPerServingMl: 500, ratio: "1:0", isCaffeine: false },
  { id: "drink-hammer-perpetuem", name: "Hammer Perpetuem", format: "Drink", carbsPerServingG: 54.0, sodiumPerServingMg: 240.0, fluidPerServingMl: 710, ratio: "1:0", isCaffeine: false },
  { id: "drink-high5", name: "High5 Energy Drink", format: "Drink", carbsPerServingG: 44.0, sodiumPerServingMg: 240.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-honey-stinger", name: "Honey Stinger Performance", format: "Drink", carbsPerServingG: 24.0, sodiumPerServingMg: 160.0, fluidPerServingMl: 500, ratio: "Natural Carbs", isCaffeine: false },
  { id: "drink-huma-hydration", name: "Huma Hydration Drink Mix", format: "Drink", carbsPerServingG: 23.0, sodiumPerServingMg: 225.0, fluidPerServingMl: 500, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-infinit-go-far", name: "Infinit Go Far", format: "Drink", carbsPerServingG: 56.0, sodiumPerServingMg: 330.0, fluidPerServingMl: 600, ratio: "2:1", isCaffeine: false },
  { id: "drink-infinit-napalm", name: "Infinit Napalm", format: "Drink", carbsPerServingG: 125.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 600, ratio: "2:1", isCaffeine: false },
  { id: "drink-maurten-160", name: "Maurten Drink Mix 160", format: "Drink", carbsPerServingG: 40.0, sodiumPerServingMg: 160.0, fluidPerServingMl: 500, ratio: "1:0.5", isCaffeine: false },
  { id: "drink-maurten-320", name: "Maurten Drink Mix 320", format: "Drink", carbsPerServingG: 80.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-maxim", name: "Maxim Energy Drink", format: "Drink", carbsPerServingG: 56.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-mortal-hydration", name: "Mortal Hydration Drink Mix", format: "Drink", carbsPerServingG: 25.0, sodiumPerServingMg: 450.0, fluidPerServingMl: 500, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-myprotein-electrolyte", name: "My Protein Electrolyte Powder", format: "Drink", carbsPerServingG: 19.0, sodiumPerServingMg: 240.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-naak-ultra-energy", name: "Näak Ultra Energy Drink Mix", format: "Drink", carbsPerServingG: 55.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "Mixed Carbs + Protein", isCaffeine: false },
  { id: "drink-namedsport", name: "NamedSport HydraFit", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 350.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-neversecond-c30", name: "Neversecond C30 Drink Mix", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-neversecond-c90", name: "Neversecond C90 Drink Mix", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-nuun-endurance", name: "Nuun Endurance", format: "Drink", carbsPerServingG: 15.0, sodiumPerServingMg: 380.0, fluidPerServingMl: 500, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-nuun-sport", name: "Nuun Sport", format: "Drink", carbsPerServingG: 1.0, sodiumPerServingMg: 300.0, fluidPerServingMl: 475, ratio: "1:0", isCaffeine: false },
  { id: "drink-osmo-active", name: "Osmo Active Hydration", format: "Drink", carbsPerServingG: 18.0, sodiumPerServingMg: 190.0, fluidPerServingMl: 500, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-ote", name: "OTE Energy Drink", format: "Drink", carbsPerServingG: 40.0, sodiumPerServingMg: 290.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-powerbar-isoactive", name: "PowerBar Isoactive", format: "Drink", carbsPerServingG: 29.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-precision-carb-electrolyte-60", name: "Precision Fuel Carb & Electrolyte Drink Mix", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 1000.0, fluidPerServingMl: 1000, ratio: "2:1", isCaffeine: false },
  { id: "drink-precision-90", name: "Precision Fuel Carb Only Drink Mix (90g serving)", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 750, ratio: "2:1", isCaffeine: false },
  { id: "drink-precision-1000", name: "Precision Hydration PH 1000", format: "Drink", carbsPerServingG: 0.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "1:0", isCaffeine: false },
  { id: "drink-precision-1500", name: "Precision Hydration PH 1500", format: "Drink", carbsPerServingG: 0.0, sodiumPerServingMg: 750.0, fluidPerServingMl: 500, ratio: "1:0", isCaffeine: false },
  { id: "drink-saltstick", name: "SaltStick DrinkMix", format: "Drink", carbsPerServingG: 23.0, sodiumPerServingMg: 430.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-santamadre-isotonic", name: "Santamadre Isotonic Drink", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 465.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-sis-beta", name: "SiS Beta Fuel 80", format: "Drink", carbsPerServingG: 80.0, sodiumPerServingMg: 511.0, fluidPerServingMl: 600, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-sis-go", name: "SiS Go Electrolyte", format: "Drink", carbsPerServingG: 36.0, sodiumPerServingMg: 230.0, fluidPerServingMl: 500, ratio: "1:0", isCaffeine: false },
  { id: "drink-skratch-labs-sport", name: "Skratch Labs Sport Hydration", format: "Drink", carbsPerServingG: 19.0, sodiumPerServingMg: 380.0, fluidPerServingMl: 500, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "drink-skratch-labs-super", name: "Skratch Labs Super High-Carb", format: "Drink", carbsPerServingG: 100.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 600, ratio: "Cluster Dextrin + Fructose", isCaffeine: false },
  { id: "drink-styrkr-mix60", name: "Styrkr MIX60", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-styrkr-mix90", name: "Styrkr MIX90", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 80.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-sword", name: "Sword Endurance Drink", format: "Drink", carbsPerServingG: 23.0, sodiumPerServingMg: 480.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-tailwind", name: "Tailwind Endurance Fuel", format: "Drink", carbsPerServingG: 50.0, sodiumPerServingMg: 620.0, fluidPerServingMl: 710, ratio: "2:1", isCaffeine: false },
  { id: "drink-thefeedlab-fuel", name: "The Feed Lab Feed Fuel Original", format: "Drink", carbsPerServingG: 80.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-thefeedlab-fuel-caf", name: "The Feed Lab Feed Fuel+ Caffeine", format: "Drink", carbsPerServingG: 80.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: true },
  { id: "drink-torq", name: "Torq Energy Drink", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 204.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-umara-sport-30", name: "Umara U Sport (30g)", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-umara-sport-60", name: "Umara U Sport (60g)", format: "Drink", carbsPerServingG: 60.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-umara-sport-90", name: "Umara U Sport (90g)", format: "Drink", carbsPerServingG: 90.0, sodiumPerServingMg: 400.0, fluidPerServingMl: 500, ratio: "1:0.8", isCaffeine: false },
  { id: "drink-victory", name: "Victory Endurance Iso Energy", format: "Drink", carbsPerServingG: 31.0, sodiumPerServingMg: 298.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-victus-energy", name: "Victus Energy Drink", format: "Drink", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "drink-xendurance", name: "Xendurance Fuel-5", format: "Drink", carbsPerServingG: 22.0, sodiumPerServingMg: 150.0, fluidPerServingMl: 240, ratio: "2:1", isCaffeine: false },
  { id: "sodium-bpn-electrolytes", name: "BPN Electrolytes", format: "Drink", carbsPerServingG: 0.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
  { id: "sodium-huma-tabs", name: "Huma Hydration Electrolyte Tabs", format: "Drink", carbsPerServingG: 1.0, sodiumPerServingMg: 320.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
  { id: "sodium-liquid-iv", name: "Liquid I.V. Hydration Multiplier", format: "Drink", carbsPerServingG: 11.0, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
  { id: "sodium-lmnt", name: "LMNT Electrolyte Mix (1 Sachet)", format: "Drink", carbsPerServingG: 0.0, sodiumPerServingMg: 1000.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
  { id: "sodium-nuun-caffeine", name: "Nuun Sport + Caffeine Tablet", format: "Drink", carbsPerServingG: 2.0, sodiumPerServingMg: 300.0, fluidPerServingMl: 475, ratio: "", isCaffeine: true },
  { id: "sodium-precision-1000-tab", name: "Precision Hydration PH 1000 Tablet", format: "Drink", carbsPerServingG: 1.2, sodiumPerServingMg: 500.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
  { id: "sodium-precision-1500-tab", name: "Precision Hydration PH 1500 Tablet", format: "Drink", carbsPerServingG: 1.2, sodiumPerServingMg: 750.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
  { id: "sodium-sis-hydro", name: "SiS Hydro Tablet", format: "Drink", carbsPerServingG: 1.0, sodiumPerServingMg: 345.0, fluidPerServingMl: 500, ratio: "", isCaffeine: false },
];

export const GENERATED_CHEWS_BARS_PRODUCTS: FuelProduct[] = [
  { id: "chew-6d-bar", name: "6d Sports Nutrition Energy Bar", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-6d-cake", name: "6d Sports Nutrition Energy Cake", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 120.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-amacx-bar", name: "Amacx Energy Bar", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 10.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-bonk-breaker-bar", name: "Bonk Breaker Energy Bar", format: "ChewsBars", carbsPerServingG: 44.0, sodiumPerServingMg: 220.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-bonk-breaker-chews", name: "Bonk Breaker Energy Chews", format: "ChewsBars", carbsPerServingG: 40.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-bpn-field-bar", name: "BPN Field Bar", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 160.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-clif-bar", name: "Clif Bar", format: "ChewsBars", carbsPerServingG: 36.0, sodiumPerServingMg: 230.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-clif-bloks", name: "Clif Bloks Energy Chews", format: "ChewsBars", carbsPerServingG: 48.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-clif-bloks-caffeine", name: "Clif Bloks Energy Chews + Caffeine", format: "ChewsBars", carbsPerServingG: 48.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "chew-decathlon-108-date-raisin-banana", name: "Decathlon Date and Raisin Bar 1:0.8 Banana", format: "ChewsBars", carbsPerServingG: 36.0, sodiumPerServingMg: 20.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-decathlon-108-date-raisin-cocoa", name: "Decathlon Date and Raisin Bar 1:0.8 Cocoa", format: "ChewsBars", carbsPerServingG: 31.0, sodiumPerServingMg: 16.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-enervit-c21pro", name: "Enervit C2:1PRO Carbo Bar", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-enervit-performance", name: "Enervit Performance Bar", format: "ChewsBars", carbsPerServingG: 33.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-enervit-power-sport", name: "Enervit Power Sport Bar", format: "ChewsBars", carbsPerServingG: 29.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-gatorade", name: "Gatorade Endurance Chews", format: "ChewsBars", carbsPerServingG: 31.0, sodiumPerServingMg: 110.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-generic", name: "Generic Chews/Bar", format: "ChewsBars", carbsPerServingG: 40.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-gu-chews", name: "GU Energy Chews", format: "ChewsBars", carbsPerServingG: 44.0, sodiumPerServingMg: 80.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-gu-roctane-chews", name: "GU Roctane Energy Chews", format: "ChewsBars", carbsPerServingG: 40.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-gu-stroopwafel", name: "GU Stroopwafel", format: "ChewsBars", carbsPerServingG: 23.0, sodiumPerServingMg: 150.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-honey-stinger-chews", name: "Honey Stinger Energy Chews", format: "ChewsBars", carbsPerServingG: 39.0, sodiumPerServingMg: 80.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "chew-honey-stinger-waffle", name: "Honey Stinger Waffle", format: "ChewsBars", carbsPerServingG: 21.0, sodiumPerServingMg: 150.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-jelly-belly", name: "Jelly Belly Sport Beans", format: "ChewsBars", carbsPerServingG: 25.0, sodiumPerServingMg: 80.0, fluidPerServingMl: 0, ratio: "1:1 (Sucrose)", isCaffeine: false },
  { id: "chew-kind-energy", name: "KIND Energy Bar", format: "ChewsBars", carbsPerServingG: 29.0, sodiumPerServingMg: 140.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-maurten-160", name: "Maurten Solid 160", format: "ChewsBars", carbsPerServingG: 40.0, sodiumPerServingMg: 85.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-maurten-225", name: "Maurten Solid 225", format: "ChewsBars", carbsPerServingG: 44.0, sodiumPerServingMg: 270.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-maurten-c-160", name: "Maurten Solid C 160", format: "ChewsBars", carbsPerServingG: 40.0, sodiumPerServingMg: 85.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-maurten-c-225", name: "Maurten Solid C 225", format: "ChewsBars", carbsPerServingG: 42.0, sodiumPerServingMg: 270.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-myprotein-bar", name: "My Protein Energy Bar", format: "ChewsBars", carbsPerServingG: 26.0, sodiumPerServingMg: 20.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-nature-valley", name: "Nature Valley Crunchy Bar", format: "ChewsBars", carbsPerServingG: 29.0, sodiumPerServingMg: 180.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-neversecond-c30-bar", name: "Neversecond C30 Fuel Bar", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-powerbar-bar", name: "Powerbar Performance Energy Bar", format: "ChewsBars", carbsPerServingG: 45.0, sodiumPerServingMg: 200.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-powerbar-shots", name: "Powerbar Powergel Shots", format: "ChewsBars", carbsPerServingG: 49.0, sodiumPerServingMg: 35.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-precision-30-bar", name: "Precision Fuel PF 30 Bar", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-precision-30-chews", name: "Precision Fuel PF 30 Chews (2 chews)", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-precision-60-bar", name: "Precision Fuel PF 60 Chew Bar", format: "ChewsBars", carbsPerServingG: 60.0, sodiumPerServingMg: 0.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-probar-bolt", name: "Probar Bolt Energy Chews", format: "ChewsBars", carbsPerServingG: 46.0, sodiumPerServingMg: 190.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "chew-saltstick-energy-gummies", name: "SaltStick Energy Gummies", format: "ChewsBars", carbsPerServingG: 36.0, sodiumPerServingMg: 170.0, fluidPerServingMl: 0, ratio: "Mixed Carbs", isCaffeine: false },
  { id: "chew-sis-beta-chews", name: "SiS Beta Fuel Chews", format: "ChewsBars", carbsPerServingG: 46.0, sodiumPerServingMg: 20.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-sis-go-bake", name: "SiS GO Energy Bake", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 20.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-skratch-labs-bar", name: "Skratch Labs Anytime Energy Bar", format: "ChewsBars", carbsPerServingG: 29.0, sodiumPerServingMg: 180.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-skratch-labs-chews", name: "Skratch Labs Sport Energy Chews", format: "ChewsBars", carbsPerServingG: 36.0, sodiumPerServingMg: 160.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-styrkr-bar50", name: "Styrkr BAR50", format: "ChewsBars", carbsPerServingG: 50.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-torq-bar", name: "Torq Energy Bar", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-torq-chews", name: "Torq Energy Chews", format: "ChewsBars", carbsPerServingG: 30.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-torq-flapjack", name: "Torq Explore Flapjack", format: "ChewsBars", carbsPerServingG: 43.0, sodiumPerServingMg: 30.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-umara-bar-1-0-8", name: "Umara U Bar 1:0.8", format: "ChewsBars", carbsPerServingG: 50.0, sodiumPerServingMg: 160.0, fluidPerServingMl: 0, ratio: "1:0.8", isCaffeine: false },
  { id: "chew-veloforte-bar", name: "Veloforte Energy Bar", format: "ChewsBars", carbsPerServingG: 40.0, sodiumPerServingMg: 80.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-veloforte-chews", name: "Veloforte Energy Chews", format: "ChewsBars", carbsPerServingG: 44.0, sodiumPerServingMg: 60.0, fluidPerServingMl: 0, ratio: "Natural Carbs", isCaffeine: false },
  { id: "chew-victus-bar", name: "Victus Energy Bar", format: "ChewsBars", carbsPerServingG: 25.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-welchs", name: "Welch's Fruit Snacks", format: "ChewsBars", carbsPerServingG: 44.0, sodiumPerServingMg: 20.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "chew-xact-energy-bar", name: "Xact Nutrition Energy Bar", format: "ChewsBars", carbsPerServingG: 25.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "chew-xact-energy-bar-caf", name: "Xact Nutrition Energy Bar + Caffeine", format: "ChewsBars", carbsPerServingG: 25.0, sodiumPerServingMg: 50.0, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: true },
  { id: "sodium-226ers-salts", name: "226ERS SUB9 Salts Electrolytes", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "sodium-generic", name: "Generic Salt Tablet", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "sodium-gu-roctane-caps", name: "GU Roctane Electrolyte Capsules", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 140.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "sodium-hammer-extreme", name: "Hammer Endurolytes Extreme", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 120.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "sodium-precision-sweatsalt", name: "Precision Hydration SweatSalt Capsules", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "sodium-saltstick-caps", name: "SaltStick Caps", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 215.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "sodium-saltstick-plus", name: "SaltStick Caps Plus (Caffeine)", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 190.0, fluidPerServingMl: 0, ratio: "", isCaffeine: true },
  { id: "sodium-saltstick-fastchews", name: "SaltStick Fastchews (2 tablets)", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 100.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
  { id: "sodium-umara-salty", name: "Umara U Salty Capsules", format: "ChewsBars", carbsPerServingG: 0.0, sodiumPerServingMg: 250.0, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
];


export const FUEL_PRODUCTS: FuelProduct[] = [
  ...GENERATED_GEL_PRODUCTS,
  ...GENERATED_DRINK_PRODUCTS,
  ...GENERATED_CHEWS_BARS_PRODUCTS,
];

// --- Generic, round-number fallbacks (not tied to any specific brand) ----

export const GENERIC_PRODUCTS: FuelProduct[] = [
  { id: "generic-gel", name: "Generic Gel", format: "Gels", carbsPerServingG: 25, sodiumPerServingMg: 50, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "generic-isotonic-gel", name: "Generic Isotonic Gel", format: "Gels", carbsPerServingG: 20, sodiumPerServingMg: 200, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "generic-drink", name: "Generic Drink Mix (500mL)", format: "Drink", carbsPerServingG: 30, sodiumPerServingMg: 300, fluidPerServingMl: 500, ratio: "2:1", isCaffeine: false },
  { id: "generic-chews", name: "Generic Energy Chews", format: "ChewsBars", carbsPerServingG: 24, sodiumPerServingMg: 40, fluidPerServingMl: 0, ratio: "2:1", isCaffeine: false },
  { id: "generic-bar", name: "Generic Energy Bar", format: "ChewsBars", carbsPerServingG: 40, sodiumPerServingMg: 100, fluidPerServingMl: 0, ratio: "", isCaffeine: false },
];

// Finds the caffeinated counterpart of a product already in the catalog
// (e.g. "Maurten Gel 100" -> "Maurten Gel 100 Caf 100"), so the caffeine
// strategy (see buildCaffeineNotes below) can swap one serving for the
// same product's caffeinated version rather than an unrelated one. Tries
// the source catalog's own "-caf"/"-caffeine" id-suffix convention first
// (matches the large majority of pairs), then falls back to a name-based
// match for the handful of products that don't follow it.
export function findCaffeineVariant(product: FuelProduct, catalog: FuelProduct[]): FuelProduct | null {
  if (product.isCaffeine) return null;
  const bySuffix = catalog.find(
    (p) => p.format === product.format && p.isCaffeine && (p.id === `${product.id}-caf` || p.id.startsWith(`${product.id}-caf`)),
  );
  if (bySuffix) return bySuffix;
  const baseName = product.name.toLowerCase();
  return (
    catalog.find(
      (p) =>
        p.format === product.format &&
        p.isCaffeine &&
        p.name.toLowerCase().replace(/\s*\+?\s*caff?e?i?n?e?.*$/i, "").trim() === baseName,
    ) ?? null
  );
}

// --- Caffeine strategy ------------------------------------------------------
//
// A pre-exercise caffeine dose of ~3mg/kg body weight is a widely-cited,
// ACSM/ISSN-consistent guideline for endurance performance (the
// commonly-studied effective range is roughly 3-6mg/kg; this codebase
// uses the conservative low end as a default, matching the source
// calculator's own observed ~3mg/kg dosing at a 72kg reference weight).
// Not reverse-engineered -- a citable, independently-sourced number, like
// the DIY drink chemistry below.
const CAFFEINE_MG_PER_KG = 3;

export function caffeinePreloadDoseMg(bodyWeightKg: number): number {
  return Math.round(Math.max(0, bodyWeightKg) * CAFFEINE_MG_PER_KG / 25) * 25;
}

// --- DIY homemade sports drink -------------------------------------------
//
// Textbook DIY sports-drink chemistry, not a fitted model. Table sugar
// (sucrose) is ~100% carbohydrate by mass and hydrolyzes into a 1:1
// glucose:fructose mix during digestion -- a natural match for the two
// intestinal carbohydrate transporters (SGLT1 for glucose, GLUT5 for
// fructose), which is why a plain 1:1 ratio needs no separate ingredients.
// A 2:1 or 1:0.8 glucose:fructose ratio instead blends maltodextrin (a
// glucose-chain carbohydrate) with fructose in that mass ratio -- the
// same "multiple transportable carbohydrates" principle used by most
// commercial dual-carb-source products in the catalog above, which can
// support higher intake rates than a single carb source alone. Table
// salt (sodium chloride) is 39.3% sodium by mass (23.0 / 58.44 atomic
// mass ratio) -- 1g salt supplies ~393mg sodium.
const SODIUM_MG_PER_GRAM_SALT = 393;

export type GlucoseFructoseRatio = "1:1" | "2:1" | "1:0.8";

export type HomemadeDrinkRecipe = {
  waterMl: number;
  saltGrams: number;
  /** Set when ratio is "1:1" -- plain table sugar supplies the whole carb dose. */
  sucroseGrams?: number;
  /** Set when ratio is "2:1" or "1:0.8" -- a maltodextrin:fructose blend in that mass ratio. */
  maltodextrinGrams?: number;
  fructoseGrams?: number;
};

// A single serving/bottle's worth of DIY drink that delivers the same
// carb and sodium concentration as the runner's target hourly rates,
// sized to whatever bottle/fluid volume they'll actually drink.
export function computeHomemadeDrinkRecipe(
  carbsPerHourG: number,
  sodiumPerHourMg: number,
  fluidPerHourMl: number,
  bottleMl: number,
  ratio: GlucoseFructoseRatio = "1:1",
): HomemadeDrinkRecipe {
  const fraction = fluidPerHourMl > 0 ? bottleMl / fluidPerHourMl : 0;
  const totalCarbGrams = Math.round(carbsPerHourG * fraction);
  const saltGrams = Math.round(((sodiumPerHourMg * fraction) / SODIUM_MG_PER_GRAM_SALT) * 10) / 10;

  if (ratio === "1:1") {
    return { waterMl: bottleMl, saltGrams, sucroseGrams: totalCarbGrams };
  }
  const [glucosePart, fructosePart] = ratio === "2:1" ? [2, 1] : [1, 0.8];
  const glucoseFraction = glucosePart / (glucosePart + fructosePart);
  return {
    waterMl: bottleMl,
    saltGrams,
    maltodextrinGrams: Math.round(totalCarbGrams * glucoseFraction),
    fructoseGrams: Math.round(totalCarbGrams * (1 - glucoseFraction)),
  };
}

// --- Energy (kcal) ----------------------------------------------------------
//
// The standard Atwater conversion factor for carbohydrate (4 kcal/g) --
// textbook nutrition science, not fit from any calculator's output.
const KCAL_PER_GRAM_CARB = 4;

export function caloriesFromCarbGrams(carbGrams: number): number {
  return Math.round(carbGrams * KCAL_PER_GRAM_CARB);
}

// --- Session fueling schedule ---------------------------------------------
//
// Ordinary scheduling arithmetic, not a fitted model: total carbs needed
// (rate x duration) divided by the chosen product's carbs-per-serving
// gives a serving count, spaced evenly across the session. This is a
// deliberately simpler choice than the source calculator's own
// cumulative-total behavior -- see endurance-fueling-math.ts's own
// "What's not included" note for why that curve wasn't reproduced here.

export type ScheduleEntry = {
  minute: number;
  product: FuelProduct;
  carbsG: number;
  fluidMl: number;
  sodiumMg: number;
  /** A caffeine pre-load or mid-session swap note, when the caffeine strategy is active for this entry. */
  note?: string;
};

export type ScheduleOptions = {
  useCaffeine?: boolean;
  bodyWeightKg?: number;
  catalog?: FuelProduct[];
};

export function generateFuelingSchedule(
  durationMinutes: number,
  carbsPerHourG: number,
  fluidPerHourMl: number,
  sodiumTargetPerHourMg: number,
  product: FuelProduct,
  options: ScheduleOptions = {},
): ScheduleEntry[] {
  // A real electrolyte-only product (0g carbs, e.g. a sodium/hydration
  // product in the catalog) can't be scheduled against a carb target --
  // dividing by its carbsPerServingG would be a divide-by-zero, not a
  // sensible "0 servings needed" answer.
  if (durationMinutes <= 0 || carbsPerHourG <= 0 || product.carbsPerServingG <= 0) return [];

  const durationHours = durationMinutes / 60;
  const totalCarbsG = carbsPerHourG * durationHours;
  const servingCount = Math.max(1, Math.round(totalCarbsG / product.carbsPerServingG));
  const intervalMinutes = durationMinutes / servingCount;

  const caffeineVariant =
    options.useCaffeine && options.catalog ? findCaffeineVariant(product, options.catalog) : null;
  // The source calculator swaps roughly the serving closest to halfway
  // through the session for the caffeinated variant -- a common real
  // pacing choice (an early dose plus a mid-race boost, rather than
  // caffeine loaded only at the start).
  const caffeineSwapIndex = caffeineVariant ? Math.round(servingCount / 2) : -1;

  const entries: ScheduleEntry[] = [];
  for (let i = 0; i < servingCount; i++) {
    const minute = Math.round(i * intervalMinutes);
    const fluidThisInterval = Math.round((fluidPerHourMl * intervalMinutes) / 60);
    const useSwap = i === caffeineSwapIndex && caffeineVariant;
    const servingProduct = useSwap ? caffeineVariant! : product;
    let note: string | undefined;
    if (i === 0 && options.useCaffeine && options.bodyWeightKg) {
      note = `Caffeine pre-load: ~${caffeinePreloadDoseMg(options.bodyWeightKg)}mg (pill/coffee), ~60 min before start.`;
    } else if (useSwap) {
      note = `Swapped for the caffeinated version.`;
    }
    entries.push({
      minute,
      product: servingProduct,
      carbsG: servingProduct.carbsPerServingG,
      // A Drink-format serving already carries its own fluid; gels/chews/
      // bars need plain water alongside to hit the fluid rate.
      fluidMl: servingProduct.format === "Drink" ? servingProduct.fluidPerServingMl : fluidThisInterval,
      sodiumMg: servingProduct.sodiumPerServingMg,
      note,
    });
  }
  return entries;
}

export function totalsForSchedule(entries: ScheduleEntry[]): { carbsG: number; fluidMl: number; sodiumMg: number } {
  return entries.reduce(
    (acc, e) => ({ carbsG: acc.carbsG + e.carbsG, fluidMl: acc.fluidMl + e.fluidMl, sodiumMg: acc.sodiumMg + e.sodiumMg }),
    { carbsG: 0, fluidMl: 0, sodiumMg: 0 },
  );
}
