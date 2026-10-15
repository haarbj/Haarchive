import { describe, expect, it } from "vitest";

import {
  caffeinePreloadDoseMg,
  caloriesFromCarbGrams,
  computeHomemadeDrinkRecipe,
  findCaffeineVariant,
  FUEL_PRODUCTS,
  GENERIC_PRODUCTS,
  generateFuelingSchedule,
  totalsForSchedule,
} from "@/lib/fueling-products";

describe("computeHomemadeDrinkRecipe", () => {
  it("scales sugar and salt to the bottle size relative to the hourly rate, defaulting to a plain 1:1 sucrose recipe", () => {
    // 75g carb/hr, 400mg sodium/hr, 700mL fluid/hr -> a 700mL bottle should equal one full hour
    const fullHour = computeHomemadeDrinkRecipe(75, 400, 700, 700);
    expect(fullHour.sucroseGrams).toBe(75);
    expect(fullHour.waterMl).toBe(700);
    // 400mg / 393 mg-per-gram-salt ~= 1.0g
    expect(fullHour.saltGrams).toBeCloseTo(1.0, 1);

    // a half-size bottle should need half the sugar/salt
    const halfBottle = computeHomemadeDrinkRecipe(75, 400, 700, 350);
    expect(halfBottle.sucroseGrams).toBe(38); // rounded
    expect(halfBottle.saltGrams).toBeCloseTo(0.5, 1);
  });

  it("returns zero recipe when the hourly fluid rate is zero", () => {
    const recipe = computeHomemadeDrinkRecipe(75, 400, 0, 500);
    expect(recipe.sucroseGrams).toBe(0);
    expect(recipe.saltGrams).toBe(0);
  });

  it("splits into maltodextrin + fructose for a 2:1 or 1:0.8 ratio, summing back to the same total carbs", () => {
    const oneToOne = computeHomemadeDrinkRecipe(90, 400, 700, 700, "1:1");
    const twoToOne = computeHomemadeDrinkRecipe(90, 400, 700, 700, "2:1");
    expect(twoToOne.sucroseGrams).toBeUndefined();
    expect(twoToOne.maltodextrinGrams).toBeDefined();
    expect(twoToOne.fructoseGrams).toBeDefined();
    const total = twoToOne.maltodextrinGrams! + twoToOne.fructoseGrams!;
    expect(total).toBe(oneToOne.sucroseGrams);
    // 2:1 ratio -> roughly 2/3 maltodextrin, 1/3 fructose
    expect(twoToOne.maltodextrinGrams!).toBeGreaterThan(twoToOne.fructoseGrams!);
  });
});

describe("generateFuelingSchedule", () => {
  const gel = FUEL_PRODUCTS.find((p) => p.id === "gel-gu")!;

  it("returns an empty schedule for zero duration or zero carb target", () => {
    expect(generateFuelingSchedule(0, 75, 700, 400, gel)).toEqual([]);
    expect(generateFuelingSchedule(150, 0, 700, 400, gel)).toEqual([]);
  });

  it("spaces servings evenly across the full duration", () => {
    // 75g/hr for 2.5h = 187.5g total; gel is 22g/serving -> round(187.5/22)=9 servings
    const schedule = generateFuelingSchedule(150, 75, 700, 400, gel);
    expect(schedule.length).toBe(9);
    expect(schedule[0].minute).toBe(0);
    // last serving should land near, not after, the end of the session
    expect(schedule[schedule.length - 1].minute).toBeLessThan(150);
    // even spacing (each rounded to the nearest minute, so allow +-1)
    const gaps = schedule.slice(1).map((e, i) => e.minute - schedule[i].minute);
    for (const gap of gaps) {
      expect(Math.abs(gap - gaps[0])).toBeLessThanOrEqual(1);
    }
  });

  it("gel/chew/bar servings carry separate water; drink servings carry their own fluid", () => {
    const drink = FUEL_PRODUCTS.find((p) => p.id === "drink-tailwind")!;
    const gelSchedule = generateFuelingSchedule(60, 75, 700, 400, gel);
    const drinkSchedule = generateFuelingSchedule(60, 75, 700, 400, drink);

    expect(gelSchedule[0].fluidMl).toBeGreaterThan(0);
    expect(gelSchedule[0].fluidMl).not.toBe(drink.fluidPerServingMl);

    expect(drinkSchedule[0].fluidMl).toBe(drink.fluidPerServingMl);
  });

  it("always schedules at least one serving even for a very short session", () => {
    const schedule = generateFuelingSchedule(10, 75, 700, 400, gel);
    expect(schedule.length).toBeGreaterThanOrEqual(1);
  });

  it("returns an empty schedule (not a divide-by-zero/infinite loop) for a real 0g-carb electrolyte product", () => {
    const electrolyteOnly = FUEL_PRODUCTS.find((p) => p.carbsPerServingG === 0);
    expect(electrolyteOnly).toBeDefined();
    const schedule = generateFuelingSchedule(150, 75, 700, 400, electrolyteOnly!);
    expect(schedule).toEqual([]);
  });

  it("with caffeine enabled, notes a pre-load on the first serving and swaps the halfway serving for a caffeinated variant when one exists", () => {
    const schedule = generateFuelingSchedule(150, 75, 700, 400, gel, {
      useCaffeine: true,
      bodyWeightKg: 72,
      catalog: FUEL_PRODUCTS,
    });
    expect(schedule[0].note).toMatch(/pre-load/i);
    const variant = findCaffeineVariant(gel, FUEL_PRODUCTS);
    if (variant) {
      const swapped = schedule.find((e) => e.product.id === variant.id);
      expect(swapped).toBeDefined();
      expect(swapped!.note).toMatch(/caffeinated/i);
    }
  });

  it("without caffeine enabled, no entry carries a note", () => {
    const schedule = generateFuelingSchedule(150, 75, 700, 400, gel);
    expect(schedule.every((e) => e.note === undefined)).toBe(true);
  });
});

describe("findCaffeineVariant", () => {
  it("finds the caffeinated counterpart of a known base product", () => {
    const base = FUEL_PRODUCTS.find((p) => p.id === "gel-maurten-100")!;
    const variant = findCaffeineVariant(base, FUEL_PRODUCTS);
    expect(variant).not.toBeNull();
    expect(variant!.isCaffeine).toBe(true);
  });

  it("returns null for a product that is already the caffeinated variant", () => {
    const already = FUEL_PRODUCTS.find((p) => p.isCaffeine)!;
    expect(findCaffeineVariant(already, FUEL_PRODUCTS)).toBeNull();
  });
});

describe("caffeinePreloadDoseMg", () => {
  it("scales with body weight at roughly 3mg/kg, rounded to the nearest 25mg", () => {
    expect(caffeinePreloadDoseMg(72)).toBe(225); // 216 -> nearest 25 -> 225
    expect(caffeinePreloadDoseMg(100)).toBeGreaterThan(caffeinePreloadDoseMg(50));
  });
});

describe("caloriesFromCarbGrams", () => {
  it("uses the standard 4 kcal/g carbohydrate conversion", () => {
    expect(caloriesFromCarbGrams(100)).toBe(400);
    expect(caloriesFromCarbGrams(0)).toBe(0);
  });
});

describe("totalsForSchedule", () => {
  it("sums carbs, fluid, and sodium across every entry", () => {
    const gel = FUEL_PRODUCTS.find((p) => p.id === "gel-gu")!;
    const schedule = generateFuelingSchedule(60, 66, 700, 400, gel); // 3 servings of 22g
    const totals = totalsForSchedule(schedule);
    expect(totals.carbsG).toBe(schedule.length * gel.carbsPerServingG);
    expect(totals.sodiumMg).toBe(schedule.length * gel.sodiumPerServingMg);
  });
});

describe("product catalogs", () => {
  it("every named and generic product has non-negative carbs and sodium (a few real electrolyte-only products have 0g carbs)", () => {
    for (const product of [...FUEL_PRODUCTS, ...GENERIC_PRODUCTS]) {
      expect(product.carbsPerServingG).toBeGreaterThanOrEqual(0);
      expect(product.sodiumPerServingMg).toBeGreaterThanOrEqual(0);
    }
  });

  it("has no duplicate ids across the named and generic catalogs", () => {
    const ids = [...FUEL_PRODUCTS, ...GENERIC_PRODUCTS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 266 real named products across gels, drinks, and chews/bars", () => {
    expect(FUEL_PRODUCTS.length).toBe(266);
    expect(FUEL_PRODUCTS.filter((p) => p.format === "Gels").length).toBe(125);
    expect(FUEL_PRODUCTS.filter((p) => p.format === "Drink").length).toBe(80);
    expect(FUEL_PRODUCTS.filter((p) => p.format === "ChewsBars").length).toBe(61);
  });
});
