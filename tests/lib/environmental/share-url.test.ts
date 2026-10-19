import { describe, expect, it } from "vitest";

import {
  buildShareUrl,
  parseShareUrlParams,
  serializeShareUrlParams,
  SHARE_URL_PARAM_KEYS,
  type ShareableFields,
} from "@/lib/environmental/share-url";

const BASE_FIELDS: ShareableFields = {
  mode: "analyze",
  course: "road",
  dist: "5k",
  cdist: "5000",
  rep: "400m",
  effort: "constant-effort",
  t: "20:00",
  wt: "150",
  wu: "lbs",
  hd: 0,
  wprof: "suburban",
  wexp: 50,
  egain: "0",
  eloss: "0",
  eunit: "ft",
  tempA: "59",
  tuA: "f",
  humA: "50",
  windA: "5",
  wuA: "mph",
  wdA: 0,
  altA: "",
  tempB: "50",
  tuB: "f",
  humB: "40",
  windB: "0",
  wuB: "mph",
  wdB: 0,
  altB: "",
  wtype: "tempo",
  wpace: "7:00",
  wmode: "distance",
  wdist: "4",
  wdur: "28:00",
  pu: "mi",
};

describe("round-trip for every goal mode", () => {
  for (const mode of ["analyze", "predict", "convert", "adjust"] as const) {
    it(`restores an exact match for mode=${mode}`, () => {
      const fields: ShareableFields = { ...BASE_FIELDS, mode };
      const parsed = parseShareUrlParams(serializeShareUrlParams(fields));
      expect(parsed).toEqual(fields);
    });
  }
});

describe("round-trip for a fully-custom state", () => {
  it("restores an exact match when every field is non-default", () => {
    const fields: ShareableFields = {
      mode: "convert",
      course: "track",
      dist: "custom",
      cdist: "12345",
      rep: "600m-alt",
      effort: "constant-speed",
      t: "62.4",
      wt: "68",
      wu: "kg",
      hd: 271,
      wprof: "urban",
      wexp: 12,
      egain: "320",
      eloss: "280",
      eunit: "m",
      tempA: "35",
      tuA: "c",
      humA: "88",
      windA: "22",
      wuA: "knots",
      wdA: 134,
      altA: "2400",
      tempB: "-5",
      tuB: "c",
      humB: "15",
      windB: "3",
      wuB: "ms",
      wdB: 9,
      altB: "0",
      wtype: "vo2max",
      wpace: "5:45",
      wmode: "duration",
      wdist: "8.5",
      wdur: "1:02:30",
      pu: "km",
    };
    const parsed = parseShareUrlParams(serializeShareUrlParams(fields));
    expect(parsed).toEqual(fields);
  });
});

describe("malformed, garbage, and out-of-range input", () => {
  it("drops an unrecognized enum value entirely, rather than passing it through", () => {
    const parsed = parseShareUrlParams("mode=teleport&course=moon&wu=stone");
    expect(parsed.mode).toBeUndefined();
    expect(parsed.course).toBeUndefined();
    expect(parsed.wu).toBeUndefined();
  });

  it("drops a non-numeric value for a numeric-string field", () => {
    const parsed = parseShareUrlParams("tempA=warm&wt=heavy&cdist=far");
    expect(parsed.tempA).toBeUndefined();
    expect(parsed.wt).toBeUndefined();
    expect(parsed.cdist).toBeUndefined();
  });

  it("clamps an out-of-range humidity instead of dropping it", () => {
    expect(parseShareUrlParams("humA=250").humA).toBe("100");
    expect(parseShareUrlParams("humA=-40").humA).toBe("0");
  });

  it("clamps an out-of-range wind exposure score", () => {
    expect(parseShareUrlParams("wexp=999").wexp).toBe(100);
    expect(parseShareUrlParams("wexp=-10").wexp).toBe(0);
  });

  it("wraps an out-of-range heading/wind-angle into [0, 360) instead of dropping it", () => {
    expect(parseShareUrlParams("hd=370").hd).toBe(10);
    expect(parseShareUrlParams("hd=-10").hd).toBe(350);
    expect(parseShareUrlParams("wdA=720").wdA).toBe(0);
  });

  it("drops a garbage time string that isn't a real clock or bare-seconds value", () => {
    expect(parseShareUrlParams("t=not-a-time").t).toBeUndefined();
    expect(parseShareUrlParams("wdur=12:ab").wdur).toBeUndefined();
  });

  it("accepts a track-mode bare-seconds time (no colon) via the parseTrackTime-compatible fallback", () => {
    expect(parseShareUrlParams("t=62.4").t).toBe("62.4");
  });

  it("falls back silently (empty result) for a completely empty query string", () => {
    expect(parseShareUrlParams("")).toEqual({});
  });

  it("ignores unknown params instead of erroring", () => {
    const parsed = parseShareUrlParams("bogusParam=1&mode=predict");
    expect(parsed.mode).toBe("predict");
    expect(Object.keys(parsed)).toEqual(["mode"]);
  });

  it("treats an empty altitude as a valid, meaningful value rather than dropping it", () => {
    expect(parseShareUrlParams("altA=").altA).toBe("");
  });

  it("clamps a negative altitude up to 0 rather than dropping it", () => {
    expect(parseShareUrlParams("altA=-500").altA).toBe("0");
  });
});

describe("Conditions A and B survive independently", () => {
  it("keeps A and B distinct through a full serialize/parse round trip in convert mode", () => {
    const fields: ShareableFields = {
      ...BASE_FIELDS,
      mode: "convert",
      tempA: "90",
      tuA: "f",
      humA: "80",
      windA: "15",
      altA: "100",
      tempB: "40",
      tuB: "f",
      humB: "20",
      windB: "2",
      altB: "8000",
    };
    const parsed = parseShareUrlParams(serializeShareUrlParams(fields));
    expect(parsed.tempA).toBe("90");
    expect(parsed.tempB).toBe("40");
    expect(parsed.humA).toBe("80");
    expect(parsed.humB).toBe("20");
    expect(parsed.windA).toBe("15");
    expect(parsed.windB).toBe("2");
    expect(parsed.altA).toBe("100");
    expect(parsed.altB).toBe("8000");
  });

  it("is unaffected by goal mode -- B survives even outside convert mode", () => {
    const fields: ShareableFields = { ...BASE_FIELDS, mode: "analyze", tempB: "12", humB: "33" };
    const parsed = parseShareUrlParams(serializeShareUrlParams(fields));
    expect(parsed.tempB).toBe("12");
    expect(parsed.humB).toBe("33");
  });
});

describe("drift detection -- every documented param must actually be read", () => {
  it("round-trips every key in SHARE_URL_PARAM_KEYS with no silent drops", () => {
    const query = serializeShareUrlParams(BASE_FIELDS);
    const parsed = parseShareUrlParams(query);
    for (const key of SHARE_URL_PARAM_KEYS) {
      expect(parsed, `param "${key}" was not read back from the query string`).toHaveProperty(key);
    }
    expect(Object.keys(parsed).sort()).toEqual([...SHARE_URL_PARAM_KEYS].sort());
  });

  it("every key BASE_FIELDS declares is itself a documented param (keeps the test fixture honest)", () => {
    expect(Object.keys(BASE_FIELDS).sort()).toEqual([...SHARE_URL_PARAM_KEYS].sort());
  });
});

describe("buildShareUrl", () => {
  it("combines origin, pathname, and the serialized query into one URL", () => {
    const url = buildShareUrl("/tools/environmental-calculator", BASE_FIELDS, "https://example.com");
    expect(url.startsWith("https://example.com/tools/environmental-calculator?")).toBe(true);
    const query = url.split("?")[1];
    expect(parseShareUrlParams(query)).toEqual(BASE_FIELDS);
  });

  it("omits the origin when not given", () => {
    const url = buildShareUrl("/tools/environmental-calculator", BASE_FIELDS);
    expect(url.startsWith("/tools/environmental-calculator?")).toBe(true);
  });
});
