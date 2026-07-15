"use client";

import { useState } from "react";

import { CoachGenomeChart } from "./coach-genome-chart";
import type { Coach } from "@/lib/coaches/types";
import { fieldClass, labelClass } from "@/lib/form-styles";

type CoachGenomeCompareProps = {
  coaches: Coach[];
};

// The interactive half of "Coach Genome" -- two pickers, defaulted to the
// first two coaches, each driving its own chart. All seven coaches' data is
// small enough (ten numbers each) to pass down from the server page as a
// prop and slice client-side; no fetch needed for a swap.
export function CoachGenomeCompare({ coaches }: CoachGenomeCompareProps) {
  const [leftSlug, setLeftSlug] = useState(coaches[0]?.slug);
  const [rightSlug, setRightSlug] = useState(coaches[1]?.slug ?? coaches[0]?.slug);

  const left = coaches.find((c) => c.slug === leftSlug) ?? coaches[0];
  const right = coaches.find((c) => c.slug === rightSlug) ?? coaches[0];

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {[
        { coach: left, value: leftSlug, onChange: setLeftSlug },
        { coach: right, value: rightSlug, onChange: setRightSlug },
      ].map((side, i) => (
        <div key={i}>
          <label className={labelClass} htmlFor={`coach-genome-compare-${i}`}>
            Coach
          </label>
          <select
            id={`coach-genome-compare-${i}`}
            value={side.value}
            onChange={(e) => side.onChange(e.target.value)}
            className={`${fieldClass} w-full`}
          >
            {coaches.map((coach) => (
              <option key={coach.slug} value={coach.slug}>
                {coach.name}
              </option>
            ))}
          </select>
          {side.coach ? (
            <div className="mt-4">
              <CoachGenomeChart genome={side.coach.genome} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
