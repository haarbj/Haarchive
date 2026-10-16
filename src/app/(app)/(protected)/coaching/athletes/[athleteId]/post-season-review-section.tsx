"use client";

import { useEffect, useState } from "react";

import {
  loadPostSeasonReviewAnswers,
  loadSentReviewRequests,
  sendPostSeasonReview,
  type PostSeasonReviewAnswerView,
  type SentReviewRequest,
} from "./schedule/post-race-actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/labeled-input";
import { FormError } from "@/components/ui/form-error";
import { formatDate } from "@/lib/format";

// Part H follow-up: the manual send path for an athlete with no goal race
// in the system at all -- a newly onboarded athlete who raced recently
// without this coach's involvement. PostRacePanel (schedule page) only
// ever appears once a goal race has passed; this is the other door,
// reachable any time, for exactly the case that one can't cover.
//
// recentRaces comes from the page's own already-loaded race_results (the
// "Recent Races" section just above this one) -- no second query for the
// same five rows.

export type RecentRaceOption = { raceName: string; raceDate: string };

export function PostSeasonReviewSection({ athleteId, recentRaces }: { athleteId: string; recentRaces: RecentRaceOption[] }) {
  const [requests, setRequests] = useState<SentReviewRequest[] | null>(null);
  const [open, setOpen] = useState(false);
  const [raceName, setRaceName] = useState("");
  const [raceDate, setRaceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateRequestId, setDuplicateRequestId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<PostSeasonReviewAnswerView[] | null>(null);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSentReviewRequests({ athleteId }).then((result) => {
      if (!cancelled) setRequests(result.requests ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const today = new Date().toISOString().slice(0, 10);
  const trimmedName = raceName.trim();
  // The live, client-side match -- same (race_name, race_date) comparison
  // sendPostSeasonReview's own findExistingReviewRequest uses server-side,
  // so a race already sent for shows "View answers" the moment the coach
  // types/picks it, before they ever click Send.
  const match = (requests ?? []).find((r) => r.raceName === trimmedName && r.raceDate === raceDate);
  const matchedRequestId = duplicateRequestId ?? match?.id ?? null;
  const matchedSubmitted = duplicateRequestId ? true : (match?.submittedAt ?? null) != null;

  function resetForm() {
    setOpen(false);
    setRaceName("");
    setRaceDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setDuplicateRequestId(null);
    setAnswers(null);
    setAnswersError(null);
  }

  async function loadAnswersFor(requestId: string) {
    setAnswersLoading(true);
    setAnswersError(null);
    const result = await loadPostSeasonReviewAnswers({ athleteId, requestId });
    setAnswersLoading(false);
    if (result.error) return setAnswersError(result.error);
    setAnswers(result.answers ?? []);
  }

  // Shown independent of the send form, keyed by request id -- this is
  // the thing a "Brody Haar submitted their post-season review" coach
  // notification should actually land on, regardless of whether the
  // review was sent manually (no goal race, nothing on the schedule
  // page's own PostRacePanel to find it in) or through the goal-race
  // flow. The coach never has to re-type a race name/date they already
  // sent to find it again.
  const [listAnswersFor, setListAnswersFor] = useState<string | null>(null);
  const [listAnswers, setListAnswers] = useState<PostSeasonReviewAnswerView[] | null>(null);
  const [listAnswersLoading, setListAnswersLoading] = useState(false);
  const [listAnswersError, setListAnswersError] = useState<string | null>(null);

  async function toggleListAnswers(request: SentReviewRequest) {
    if (listAnswersFor === request.id) {
      setListAnswersFor(null);
      setListAnswers(null);
      return;
    }
    setListAnswersFor(request.id);
    setListAnswers(null);
    setListAnswersError(null);
    setListAnswersLoading(true);
    const result = await loadPostSeasonReviewAnswers({ athleteId, requestId: request.id });
    setListAnswersLoading(false);
    if (result.error) return setListAnswersError(result.error);
    setListAnswers(result.answers ?? []);
  }

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Post-season review</p>

      {requests && requests.length > 0 ? (
        <div className="mt-3 space-y-2">
          {requests.map((request) => (
            <Card key={request.id} padding="md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{request.raceName ?? "Race"}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {request.raceDate ? formatDate(request.raceDate) : null}
                    {request.submittedAt ? " · Submitted" : " · Not submitted yet"}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={listAnswersLoading && listAnswersFor === request.id} onClick={() => toggleListAnswers(request)}>
                  {listAnswersLoading && listAnswersFor === request.id ? "Loading…" : listAnswersFor === request.id ? "Hide" : "View answers"}
                </Button>
              </div>
              {listAnswersFor === request.id ? (
                <div className="mt-3 space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
                  {listAnswersError ? (
                    <FormError>{listAnswersError}</FormError>
                  ) : !request.submittedAt ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Not submitted yet -- showing whatever they&rsquo;ve saved so far.
                    </p>
                  ) : null}
                  {listAnswers && listAnswers.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No answers yet.</p>
                  ) : (
                    (listAnswers ?? []).map((a) => (
                      <div key={`${a.sectionHeading}-${a.questionIndex}`}>
                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{a.question}</p>
                        <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                          {a.answer.trim() ? a.answer : <span className="italic text-zinc-400">No answer yet</span>}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      <Card padding="md" className="mt-3">
        {!open ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Send the structured post-season review for a race, with or without a goal race on record.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              Send review
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentRaces.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Quick pick a recent race</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {recentRaces.map((race) => (
                    <button
                      key={`${race.raceName}-${race.raceDate}`}
                      type="button"
                      className="rounded-pill border border-black/10 px-3 py-1 text-xs text-zinc-700 hover:border-black/20 dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20"
                      onClick={() => {
                        setRaceName(race.raceName);
                        setRaceDate(race.raceDate);
                        setDuplicateRequestId(null);
                        setAnswers(null);
                      }}
                    >
                      {race.raceName} &middot; {formatDate(race.raceDate)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LabeledInput
                id="post-season-review-race-name"
                label="Race name"
                value={raceName}
                required
                onChange={(e) => {
                  setRaceName(e.target.value);
                  setDuplicateRequestId(null);
                  setAnswers(null);
                }}
              />
              <LabeledInput
                id="post-season-review-race-date"
                label="Race date"
                type="date"
                value={raceDate}
                max={today}
                onChange={(e) => {
                  setRaceDate(e.target.value);
                  setDuplicateRequestId(null);
                  setAnswers(null);
                }}
              />
            </div>

            {matchedRequestId ? (
              <div>
                {answers === null ? (
                  <Button type="button" variant="outline" size="sm" disabled={answersLoading} onClick={() => loadAnswersFor(matchedRequestId)}>
                    {answersLoading ? "Loading…" : matchedSubmitted ? "View answers" : "View answers (not submitted yet)"}
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
                    {!matchedSubmitted ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Not submitted yet -- showing whatever they&rsquo;ve saved so far.
                      </p>
                    ) : null}
                    {answers.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No answers yet.</p>
                    ) : (
                      answers.map((a) => (
                        <div key={`${a.sectionHeading}-${a.questionIndex}`}>
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{a.question}</p>
                          <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                            {a.answer.trim() ? a.answer : <span className="italic text-zinc-400">No answer yet</span>}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {answersError ? <FormError className="mt-2">{answersError}</FormError> : null}
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={sending || !trimmedName || !raceDate}
                onClick={async () => {
                  setSending(true);
                  setError(null);
                  const result = await sendPostSeasonReview({ athleteId, raceName: trimmedName, raceDate });
                  setSending(false);
                  if (result.error) {
                    setError(result.error);
                    // A race condition (sent from elsewhere between this
                    // list loading and Send being clicked) still surfaces
                    // the real request rather than just an error -- the
                    // server's own dedup check is the actual guard here,
                    // this is just making its result usable.
                    if (result.requestId) setDuplicateRequestId(result.requestId);
                    return;
                  }
                  loadSentReviewRequests({ athleteId }).then((r) => setRequests(r.requests ?? []));
                }}
              >
                {sending ? "Sending…" : "Send review"}
              </Button>
            )}

            {error ? <FormError>{error}</FormError> : null}

            <div>
              <button
                type="button"
                className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
