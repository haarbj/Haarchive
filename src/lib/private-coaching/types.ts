// Shared TypeScript shapes for the private 1-on-1 coaching product --
// named private-coaching/, not coaching-engine/ (the unrelated self-serve
// plan math) or coaches/ (the unrelated Coaching Library editorial
// content), to avoid exactly the naming collisions the Phase 0 audit
// flagged as a real risk in this codebase.

export type CoachingRelationshipStatus = "active" | "ended";

export type CoachAthlete = {
  id: string;
  coachId: string;
  athleteId: string;
  status: CoachingRelationshipStatus;
  startedAt: string;
  endedAt: string | null;
};

export type CoachAthleteInvite = {
  id: string;
  coachId: string;
  athleteEmail: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
};

export type RosterAthlete = {
  coachAthleteId: string;
  athleteId: string;
  displayName: string;
  avatarUrl: string | null;
  startedAt: string;
};

export type PendingInvite = {
  id: string;
  athleteEmail: string;
  createdAt: string;
  expiresAt: string;
};
