import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Source-scan tests (no Supabase-touching-loader test harness exists in
// this repo -- see realignment-service-wiring.test.ts's own header
// comment for the established reasoning) verifying the consent-flow
// contracts the pure engine itself can't prove: no workout/notification
// state changes before Accept, Accept applies only the stated action,
// Dismiss leaves everything else untouched, and the 14-day suppression
// window is actually time-bounded rather than a permanent fingerprint
// match (adaptation cards deliberately differ from realignment_proposals
// here -- see this file's own header comment in
// adaptation-cards-service.ts).

const SERVICE = readFileSync(join(__dirname, "../../../src/lib/private-coaching/adaptation-cards-service.ts"), "utf8");

function functionBody(name: string): string {
  const start = SERVICE.indexOf(`export async function ${name}(`);
  expect(start, `could not find export async function ${name}(`).toBeGreaterThan(-1);
  const nextExport = SERVICE.indexOf("\nexport ", start + 1);
  return SERVICE.slice(start, nextExport === -1 ? undefined : nextExport);
}

describe("createOrRefreshAdaptationCards never updates or deletes scheduled_workouts or completed_workouts -- generating a card is read-only", () => {
  const body = functionBody("createOrRefreshAdaptationCards");

  it("only reads scheduled_workouts/completed_workouts, only writes adaptation_cards", () => {
    expect(body).not.toMatch(/scheduled_workouts[\s\S]{0,60}\.(update|delete)\(/);
    expect(body).not.toMatch(/completed_workouts[\s\S]{0,60}\.(update|delete|insert)\(/);
    expect(body).toContain('.from("adaptation_cards")\n    .insert(');
  });

  it("never calls createNotification -- generating a card is advisory only, nothing is sent until Accept", () => {
    expect(body).not.toContain("createNotification(");
  });

  it("skips a signal when an identical-fingerprint dismissal is still inside the suppression window", () => {
    expect(body).toContain("DISMISSAL_SUPPRESSION_DAYS");
    expect(body).toMatch(/suppressingDismissal/);
  });

  it("the suppression lookup is time-bounded (decided_at compared against a cutoff), not a permanent fingerprint match", () => {
    expect(body).toMatch(/decided_at\.slice\(0, 10\) >= suppressionCutoff/);
  });

  it("never generates a second pending card for the same (athlete, signal) -- the 'one card at a time' rule", () => {
    expect(body).toMatch(/alreadyPending/);
  });
});

describe("acceptAdaptationCard applies exactly the stated action per signal, and always forces a draft for any workout it touches", () => {
  const body = functionBody("acceptAdaptationCard");

  it("only acts on a card that is still pending", () => {
    expect(body).toContain('.eq("status", "pending")');
  });

  it("every scheduled_workouts write this function makes sets published_at to null -- Accept is not Publish", () => {
    const workoutWrites = body.match(/\.from\("scheduled_workouts"\)[\s\S]{0,500}/g) ?? [];
    expect(workoutWrites.length).toBeGreaterThan(0);
    for (const write of workoutWrites) {
      expect(write).toMatch(/published_at:\s*null/);
    }
  });

  it("fitness_up requires a coach-chosen date and never applies without one", () => {
    expect(body).toMatch(/if \(row\.signal === "fitness_up"\)/);
    expect(body).toContain("options.chosenDate");
    expect(body).toMatch(/if \(!options\.chosenDate\) return \{ error:/);
  });

  it("going_quiet calls createNotification and makes no scheduled_workouts write", () => {
    const goingQuietStart = body.indexOf('} else {');
    const goingQuietBlock = body.slice(goingQuietStart, body.indexOf("\n  }", goingQuietStart));
    expect(goingQuietBlock).toContain("createNotification(");
    expect(goingQuietBlock).toContain('type: "checkin_requested"');
    expect(goingQuietBlock).not.toContain("scheduled_workouts");
  });

  it("marks the card accepted only after applying the action", () => {
    expect(body).toMatch(/status: "accepted"/);
  });
});

describe("dismissAdaptationCard writes nothing but the card's own status", () => {
  const body = functionBody("dismissAdaptationCard");

  it("only touches adaptation_cards, and only a card that is still pending", () => {
    expect(body).toContain('.from("adaptation_cards")');
    expect(body).not.toContain("scheduled_workouts");
    expect(body).not.toContain("createNotification(");
    expect(body).toContain('.eq("status", "pending")');
  });
});
