-- Phase 4 (Learning Content Coverage & Path Completion): 12 curated
-- knowledge-check questions across the 5 Tier 1 topics identified by the
-- Phase 4 coverage audit (marathon-training, research-library,
-- how-to-start-running, training-philosophy, workout-library). Same
-- subquery-join-on-slug pattern as the two prior knowledge-check
-- migrations -- never a hardcoded UUID. Every question is grounded
-- directly in that topic's real prose in src/lib/sections.ts (or, for
-- training-philosophy, src/components/training-philosophy-page.tsx),
-- read in full before writing, and each is paired with the real Concept
-- (taxonomy.ts) its topic just gained in this same phase, except
-- research-library's, whose 5 concepts already existed and only needed
-- verification, not new concept anchors.

-- ---------------------------------------------------------------------
-- Marathon Training (3 questions)
-- ---------------------------------------------------------------------

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A marathon plan drops its midweek medium-long run whenever the week feels busy, replacing it with a second quality workout instead. According to the Haarchive, what''s the real cost of that swap?', '[{"id": "a", "text": "It trades away one of the few places a normal week repeats the long run''s aerobic stimulus, since that benefit accumulates disproportionately in a run''s later miles -- a distance runner rarely needs a second dose of speed work in the same week."}, {"id": "b", "text": "None -- a second hard workout builds fitness faster than an easy medium-long run would."}, {"id": "c", "text": "It only matters if the medium-long run is skipped more than once a month."}, {"id": "d", "text": "The medium-long run exists purely to build confidence before race day, not to build fitness."}]'::jsonb, 'a', 'A marathon week''s aerobic benefit from the long run accumulates disproportionately in its later miles, once the body has shifted into a sustained-effort adaptation mode -- and a midweek run of 50-75% of that distance, at the same easy effort, is one of the few other places in a normal week that stimulus gets repeated. Trading it for a second quality workout usually means trading real aerobic development for speed work a distance runner rarely needs two doses of in the same week.'
from public.topics t
left join public.concepts c on c.slug = 'medium-long-run' and c.topic_id = t.id
where t.slug = 'marathon-training';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'An athlete plans to run a full 20-mile long run entirely at marathon goal pace, reasoning that if they can do it in training, it will hold up on race day. According to the Haarchive, what''s the actual problem with this approach?', '[{"id": "a", "text": "Nothing -- rehearsing the exact race-day pace for the full distance is the most reliable way to prepare."}, {"id": "b", "text": "Marathon pace is always too slow to produce any training benefit at all."}, {"id": "c", "text": "Marathon pace sits in an awkward middle zone: too fast to build the aerobic capacity easy volume builds, and not fast enough to build the aerobic strength tempo and threshold work builds -- so a full marathon-pace long run mostly just trains the narrow, low-transfer skill of holding that one pace for that one distance."}, {"id": "d", "text": "The only problem is that it uses too much of the week''s fueling budget."}]'::jsonb, 'c', 'Marathon pace is genuinely too fast to reliably build the aerobic capacity that easy volume builds, and not fast enough to build the aerobic strength that tempo and threshold work builds. Extended marathon-pace running outside a race-specific workout mostly trains the narrow, low-transfer skill of holding that exact pace for that exact stretch -- and a full-distance marathon-pace long run spends a large chunk of a week''s recovery budget for comparatively little aerobic-capacity or aerobic-strength benefit in return.'
from public.topics t
left join public.concepts c on c.slug = 'marathon-pace-paradox' and c.topic_id = t.id
where t.slug = 'marathon-training';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A runner pushes their marathon buildup past 24 weeks of continuously increasing volume without a break, reasoning that more weeks of building can only mean more fitness. According to the Haarchive, what actually happens?', '[{"id": "a", "text": "Fitness keeps climbing at the same rate indefinitely, since volume and fitness scale together with no real ceiling."}, {"id": "b", "text": "The body adapts fully within the first few weeks, so anything past that point is wasted time regardless of a break."}, {"id": "c", "text": "Pushing past 24 weeks is fine as long as the runner also increases quality-workout frequency to match."}, {"id": "d", "text": "Around 24 weeks, further volume increases stop producing fitness gains and start just producing fatigue -- and counterintuitively, taking a real recovery block and starting a fresh cycle lets the runner reach a higher peak than if the buildup had never stopped."}]'::jsonb, 'd', 'Most runners hit a wall around 24 weeks of steadily building volume, after which further increases stop producing fitness gains and start just producing fatigue -- that ceiling is why serious marathon buildups run in cycles rather than one long uninterrupted ramp. Counterintuitively, a runner who takes a real recovery block of at least a couple of weeks comes back able to train harder and reach a higher peak than if the buildup had never stopped, despite losing some fitness during the break itself.'
from public.topics t
left join public.concepts c on c.slug = 'buildup-cycle-length' and c.topic_id = t.id
where t.slug = 'marathon-training';

-- ---------------------------------------------------------------------
-- How to Start Running (2 questions)
-- ---------------------------------------------------------------------

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A new runner finds Stage 2 of the beginner progression (alternating 15- and 30-minute days) still feels too hard after the recommended 6-8 weeks. According to the Haarchive''s Golden Rules, what should they do?', '[{"id": "a", "text": "Repeat the stage rather than advancing on schedule -- the schedule is a guide, not an order, and listening to the body over the plan on paper is one of the program''s own explicit rules."}, {"id": "b", "text": "Push ahead to Stage 3 anyway, since the schedule''s timeline is what determines readiness, not how the runner feels."}, {"id": "c", "text": "Stop running for at least a month before attempting Stage 2 again from the beginning."}, {"id": "d", "text": "Switch immediately to running by pace instead of by time, since that removes the difficulty."}]'::jsonb, 'a', 'The Golden Rules are explicit: if a week (or stage) feels too hard, repeat it rather than pushing forward on schedule, and listen to your body over the plan on paper, since the schedule is a guide, not an order. The whole beginner progression is built around progressing by how it actually feels, not by calendar time alone.'
from public.topics t
left join public.concepts c on c.slug = 'beginner-progression' and c.topic_id = t.id
where t.slug = 'how-to-start-running';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A beginner calculates their training heart rate range using the 220-minus-age formula, but on a given run, holding that exact heart rate feels noticeably harder than it should. According to the Haarchive, what should they do?', '[{"id": "a", "text": "Keep running at the calculated heart rate regardless of how it feels, since the formula is precise enough to override perceived effort."}, {"id": "b", "text": "Stop using heart rate entirely and switch to tracking distance instead."}, {"id": "c", "text": "Treat the formula as a rough guideline, not gospel -- how the effort actually feels should override what a number on a screen says."}, {"id": "d", "text": "Assume the heart rate monitor is broken, since the formula is always accurate for a healthy runner."}]'::jsonb, 'c', 'The Haarchive is explicit that the 220-minus-age-based training heart rate formula is a rough guideline, not gospel: it''s a reasonable starting estimate, but how an effort feels should always override what a number on a screen says. This is the same reasoning behind offering the talk test as a more individualized alternative.'
from public.topics t
left join public.concepts c on c.slug = 'training-heart-rate-formula' and c.topic_id = t.id
where t.slug = 'how-to-start-running';

-- ---------------------------------------------------------------------
-- Training Philosophy (2 questions)
-- ---------------------------------------------------------------------

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Two runners training for the same goal race, at the same goal time, are given nearly opposite training plans by their coach. According to the Haarchive''s Training Philosophy, what''s the most likely explanation?', '[{"id": "a", "text": "One of the two plans must be wrong, since two runners with the same goal should train the same way."}, {"id": "b", "text": "Training doesn''t respond to the goal alone -- it responds to the runner, including factors like training history, injury history, age, mileage, recovery, stress, and their individual goals."}, {"id": "c", "text": "The coach is being deliberately inconsistent to keep the athletes from comparing notes."}, {"id": "d", "text": "This can only happen if one of the runners is significantly more talented than the other."}]'::jsonb, 'b', 'The Haarchive''s Training Philosophy page states this directly: two runners chasing the same goal race can need almost opposite training, because training doesn''t respond to the goal alone -- it responds to the runner. Training history, injury history, age, mileage, recovery, and stress are all named as real factors that can make two reasonable plans, for the same goal, look very different.'
from public.topics t
left join public.concepts c on c.slug = 'individualization' and c.topic_id = t.id
where t.slug = 'training-philosophy';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'One runner trains brilliantly for six weeks, then burns out and stops for six weeks. A second runner trains consistently at roughly 90% of their theoretical best plan the entire time. According to the Haarchive''s Training Philosophy, who develops more?', '[{"id": "a", "text": "The six-weeks-brilliant runner, since the peak quality of training matters more than steady consistency."}, {"id": "b", "text": "They develop identically, since both runners average out to the same total training over time."}, {"id": "c", "text": "Neither develops meaningfully without a coach directly supervising every session."}, {"id": "d", "text": "The consistent runner -- the aerobic engine takes years to fully mature, so no single missed or brilliant week moves that timeline much, and a runner training consistently near their best will out-develop one alternating between brilliance and burnout."}]'::jsonb, 'd', 'Training Philosophy states this directly: years matter more than individual workouts, and the aerobic engine takes years to fully mature, so no single week, hit or missed, moves that timeline much. A runner training consistently at 90% of their theoretical best plan will out-develop one training brilliantly for six weeks and burning out for six.'
from public.topics t
left join public.concepts c on c.slug = 'consistency-beats-perfection' and c.topic_id = t.id
where t.slug = 'training-philosophy';

-- ---------------------------------------------------------------------
-- Workout Library (2 questions)
-- ---------------------------------------------------------------------

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A coach structures a double-threshold day with two sessions six to eight hours apart, rather than one long combined session or the same volume spread across two separate days. According to the Haarchive, what''s the physiological reasoning behind the timing?', '[{"id": "a", "text": "The soreness response to a hard session is delayed by 24-72 hours, while muscle tone (what governs readiness for the next hard rep) can drop back down within hours -- running the second session before the delayed damage response kicks in lets the body absorb both as one extended stimulus rather than a second stressor stacked on an already-fatigued system."}, {"id": "b", "text": "It''s purely a scheduling convenience with no physiological basis."}, {"id": "c", "text": "It''s timed around when blood lactate is at its daily minimum, regardless of muscle soreness."}, {"id": "d", "text": "The gap exists only to allow enough time for a full meal between sessions."}]'::jsonb, 'a', 'The mechanism is timing-based: structural soreness is delayed by 24-72 hours, while muscle tone (the variable that actually governs how ready a muscle is for its next hard rep) can drop back down within hours. Running the second session before the delayed damage response has kicked in lets the body absorb it as one extended stimulus with a long rest built into the middle, rather than as a second full stressor stacked on an already-fatigued system.'
from public.topics t
left join public.concepts c on c.slug = 'advanced-periodization' and c.topic_id = t.id
where t.slug = 'workout-library';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A runner with a genuine 31-minute 10K fitness level tries to hammer 400m repeats at the pace of a 3:45 1500m runner, a goal they haven''t actually earned yet. According to the Haarchive, what''s the real problem with this?', '[{"id": "a", "text": "Nothing -- running at an aspirational pace is the fastest way to earn it."}, {"id": "b", "text": "The only issue is that 400m repeats are too short to be useful for any runner."}, {"id": "c", "text": "They''re accumulating acidosis without the aerobic base to buffer it, rather than rehearsing the goal -- interval pace should come from current, honest fitness, with the VO2 max system built first before layering faster glycolytic repetitions on top."}, {"id": "d", "text": "This approach is fine as long as the recovery between reps is shortened to compensate."}]'::jsonb, 'c', 'The fix requires building the VO2 max system first with longer intervals at 95-100% of VO2 max pace, and only once that''s established should shorter, faster glycolytic repetitions get layered on top -- run at the athlete''s current realistic race pace, not a pace borrowed from an unearned goal. A runner hammering reps at a pace they haven''t earned isn''t rehearsing the goal; they''re just accumulating acidosis without the aerobic base to buffer it.'
from public.topics t
left join public.concepts c on c.slug = 'matching-interval-pace' and c.topic_id = t.id
where t.slug = 'workout-library';

-- ---------------------------------------------------------------------
-- Research Library (3 questions -- concepts already existed pre-Phase-4)
-- ---------------------------------------------------------------------

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A runner''s training log shows a lot of time spent at a "comfortably hard" threshold pace -- productive-feeling, sustainable, not quite easy and not quite maximal. According to Seiler''s research on polarized training discussed in the Haarchive, what''s the issue with this pattern?', '[{"id": "a", "text": "Nothing -- threshold pace is the single most efficient intensity for building fitness, so more time there is always better."}, {"id": "b", "text": "Threshold-paced running is a kind of gravitational trap: it feels productive and sustainable enough to drift into by default, but it accumulates fatigue faster than low-intensity work while building fitness no faster than genuinely hard intervals."}, {"id": "c", "text": "It''s a problem only because threshold pace is dangerous for the cardiovascular system."}, {"id": "d", "text": "Polarized training says threshold pace should make up exactly 50% of a well-structured week."}]'::jsonb, 'b', 'Seiler''s research describes the threshold zone as a trap disguised as a sweet spot: it''s easy to drift there by default because it feels productive and sustainable, even though it accumulates fatigue faster than low-intensity work while building fitness no faster than genuinely hard intervals. The polarized model instead concentrates training at two distinct poles (roughly 65% and 90% of VO2max) with comparatively little time in between.'
from public.topics t
left join public.concepts c on c.slug = 'polarized-training' and c.topic_id = t.id
where t.slug = 'research-library';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Two runners complete different sessions of equal duration -- one an easy long run, the other a series of short sprints. The long run leaves the runner far more fatigued afterward, in a lingering way the sprint session doesn''t. According to the Haarchive''s Research Library, what''s a distinct, separate mechanism behind that difference?', '[{"id": "a", "text": "Sprinting burns more total calories than easy running, so the long run should actually feel less fatiguing."}, {"id": "b", "text": "The long run is only more fatiguing because of dehydration, which sprinting sessions don''t cause."}, {"id": "c", "text": "IL-6 release is driven entirely by pace, which is why sprinting should release more of it than an easy run."}, {"id": "d", "text": "Prolonged low-intensity running releases large amounts of interleukin-6 (IL-6), triggered primarily by glycogen depletion in the working muscles and tracking with duration more than pace -- a distinct mechanism from the capillary and mitochondrial growth that duration also builds."}]'::jsonb, 'd', 'Prolonged low-intensity running releases large amounts of IL-6, a cell-signaling compound triggered primarily by glycogen depletion in the working muscles rather than by speed -- which is why IL-6 release tracks with duration more than pace. It''s described as a distinct mechanism from the capillary and mitochondrial growth already covered elsewhere: a second, separate reason duration matters on its own.'
from public.topics t
left join public.concepts c on c.slug = 'il-6' and c.topic_id = t.id
where t.slug = 'research-library';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A runner starts consciously trying to rebuild their stride mechanics mid-run, based on the theory that deliberately correcting form will make them faster. According to the Haarchive''s Research Library, what does the evidence actually suggest?', '[{"id": "a", "text": "Deliberately imposed changes to a runner''s natural stride almost always make performance worse, not better -- the stride behaves like a self-optimizing system that improves automatically as training volume accumulates, without conscious tinkering."}, {"id": "b", "text": "Conscious form correction works, but only if practiced during every single run, not just occasionally."}, {"id": "c", "text": "Running form has no effect on performance at all, so neither approach matters."}, {"id": "d", "text": "Deliberately rebuilding stride mechanics is the single most reliable way to improve running economy."}]'::jsonb, 'a', 'A recurring finding across running-form research is that deliberately imposed changes to a runner''s natural stride almost always make performance worse, not better. The brain continuously searches for the movement pattern that produces a given speed with the least muscular effort, and that search runs automatically as training volume accumulates -- the most reliable way to a more efficient stride is running enough mileage for the body to optimize against, not consciously rebuilding mechanics.'
from public.topics t
left join public.concepts c on c.slug = 'running-economy' and c.topic_id = t.id
where t.slug = 'research-library';

-- total questions: 12
