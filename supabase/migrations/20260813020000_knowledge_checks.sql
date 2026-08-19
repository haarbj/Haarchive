-- Knowledge Checks (Phase 2) -- the first genuinely *verified* learning
-- signal. Reading, notes, tool use, and revisits (Phase 1/1.1) can push a
-- topic up through Advanced; only a correctly-answered knowledge check can
-- unlock Mastered (see the algorithm.ts change in this same phase).
--
-- One new table, no new attempts table: an answer is a learning_events row
-- (event_type = 'knowledge_check_answered', metadata carries questionId/
-- selectedOptionId/correct/attemptNumber) -- learning_events stays the one
-- source of truth, matching this feature's own standing rule against a
-- second, parallel analytics table.
--
-- RLS is intentionally the article_tag_options.sql shape (zero policies
-- for authenticated/public), not the topics/concepts shape (public
-- select) -- this table holds an actual secret (correct_option_id), so a
-- blanket "select to public using (true)" would let any client read the
-- answer key directly off the table, defeating server-side answer
-- verification entirely. Every read goes through a service-role server
-- action (src/app/knowledge-check-actions.ts) that explicitly column-limits
-- what it returns before submission.
create table public.knowledge_checks (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete set null,
  question text not null,
  -- [{ "id": "a", "text": "..." }, ...] -- short stable option ids (not the
  -- option's own text) so correct_option_id stays a simple string
  -- comparison and distractor wording can be edited without touching
  -- correct_option_id or any stored learning_events.metadata.
  options jsonb not null,
  correct_option_id text not null,
  explanation text not null,
  -- Free text, not an enum -- matches event_type/level's own "allowed to
  -- grow without a migration" convention elsewhere in this schema. Only
  -- 'standard' is used in this initial seed.
  difficulty text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_knowledge_checks_topic_id on public.knowledge_checks (topic_id);
create index idx_knowledge_checks_concept_id on public.knowledge_checks (concept_id);

create trigger on_knowledge_checks_updated
  before update on public.knowledge_checks
  for each row execute function public.set_updated_at();

alter table public.knowledge_checks enable row level security;
-- No select/insert/update/delete policies -- service-role only, on purpose.

-- ---------------------------------------------------------------------
-- Seed data: 14 curated questions across the 5 topics with the strongest
-- existing concept coverage (exercise-physiology, the-aerobic-base,
-- data-and-analytics, nutrition-and-fueling, sports-psychology). Every
-- question is grounded directly in that topic's real prose in
-- src/lib/sections.ts -- read before writing, not drafted from memory or
-- outside facts (see this migration's own header comment, and the Phase 2
-- audit's "no outside facts" requirement). Deliberately small and curated
-- rather than exhaustive -- quality over quantity, per spec.
-- ---------------------------------------------------------------------

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Two runners have identical VO2 max test results. Based on the Haarchive''s discussion of VO2 max, why might one be able to hold a hard pace far longer than the other once things get acidic?', '[{"id": "a", "text": "VO2 max is a single number, so a matched score means their race performance should be identical."}, {"id": "b", "text": "VO2 max reflects two separable adaptations -- a slow-building aerobic base and a faster-building tolerance for acidic, high-intensity conditions -- and they may not have trained both equally."}, {"id": "c", "text": "The runner with more fast-twitch fibers will always outperform the other regardless of training."}, {"id": "d", "text": "VO2 max only measures anaerobic capacity, so aerobic training wouldn''t affect this at all."}]'::jsonb, 'b', 'VO2 max combines a slow-building aerobic contribution (capillary density and mitochondrial volume, built over years) with a faster-building anaerobic-chemistry contribution (buffering capacity trained at 95-100% of VO2 max pace, developing in as little as 4-5 weeks). A runner who has built one without the other will share the same VO2 max number but have a very different ability to hold a hard effort once acidosis sets in.'
from public.topics t
left join public.concepts c on c.slug = 'vo2-max' and c.topic_id = t.id
where t.slug = 'exercise-physiology';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'According to the size principle, why can''t easy aerobic running by itself develop a runner''s biggest, most explosive muscle fibers (Type IIB)?', '[{"id": "a", "text": "Motor units are recruited smallest-to-largest, and an easy run''s demand never rises high enough to call the biggest, most explosive units into play at all."}, {"id": "b", "text": "Type IIB fibers only respond to diet changes, not to any kind of training stimulus."}, {"id": "c", "text": "Easy running actually damages Type IIB fibers, which is why hard workouts are needed to repair them."}, {"id": "d", "text": "The size principle only applies to sprinting events, not distance running."}]'::jsonb, 'a', 'The nervous system recruits motor units smallest-to-largest. A comfortable aerobic run''s demand never rises far enough to force recruitment of the largest, most explosive fibers -- reaching them requires either a sudden eccentric-to-concentric action (like hill bounding) or genuinely heavy loading, above roughly 85% of a one-rep max.'
from public.topics t
left join public.concepts c on c.slug = 'size-principle' and c.topic_id = t.id
where t.slug = 'exercise-physiology';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A cyclist''s leg muscles are nowhere near physical failure, yet they stop pedaling because the effort feels unbearable. Which idea from the Haarchive''s discussion of endurance limits does this best illustrate?', '[{"id": "a", "text": "The central governor and psychobiological models fully disagree, and this only supports one side."}, {"id": "b", "text": "Perceived effort, not a hard physiological limit, is often what actually governs when someone stops -- a conclusion both competing models converge on."}, {"id": "c", "text": "This proves the athlete simply lacks willpower and needs more motivation."}, {"id": "d", "text": "This can only happen in a lab setting and has no bearing on real racing."}]'::jsonb, 'b', 'Followed far enough, the central-governor and psychobiological models land in the same place: effort, not any single physiological variable, is what most directly governs how long an effort can continue. Studies described on the page show muscles far from true failure while perceived effort had already reached its limit.'
from public.topics t
left join public.concepts c on c.slug = 'central-governor' and c.topic_id = t.id
where t.slug = 'exercise-physiology';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A runner trains hard every single day with minimal rest, assuming more stress always means more fitness gained. According to the adaptation curve described in the Haarchive, what''s the most likely result?', '[{"id": "a", "text": "Fitness accumulates fastest with daily hard stress, since more stimulus always means more adaptation."}, {"id": "b", "text": "Fitness only rebounds during the recovery that follows a stress -- without adequate rest, the curve never gets the chance to rebound above baseline."}, {"id": "c", "text": "The body automatically down-regulates soreness, so hard training every day is always safe."}, {"id": "d", "text": "Super-compensation only applies to sprint training, not distance training."}]'::jsonb, 'b', 'Every workout is a stress that temporarily makes you less fit; fitness only rebounds during the recovery that follows, often landing slightly above where you started (super-compensation). Training success = moderate stress + adequate rest -- push too hard or rest too little and the curve never gets the chance to rebound.'
from public.topics t
left join public.concepts c on c.slug = 'super-compensation' and c.topic_id = t.id
where t.slug = 'the-aerobic-base';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A comparative study found Kenyan runners averaged nearly double the capillaries per muscle cell compared to Swedish runners, in the same working muscles. According to the Haarchive, what does this gap primarily reflect?', '[{"id": "a", "text": "It''s entirely genetic, and capillary density can''t meaningfully be trained."}, {"id": "b", "text": "Capillary density and fat-oxidizing enzyme concentration are both adaptations built by sustained aerobic volume, not inherited outright, though genetics plays some role."}, {"id": "c", "text": "It reflects a difference in muscle fiber type alone, unrelated to training volume."}, {"id": "d", "text": "Capillary density is cosmetic and has no real effect on performance."}]'::jsonb, 'b', 'Genetics plays some role in a gap like that, but both adaptations -- capillary density and fat-oxidizing enzyme concentration -- are exactly the ones built by sustained aerobic volume, not inherited outright.'
from public.topics t
left join public.concepts c on c.slug = 'mitochondria' and c.topic_id = t.id
where t.slug = 'the-aerobic-base';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Why does building a bigger aerobic base extend how long a runner can go before ''bonking''?', '[{"id": "a", "text": "It has no effect -- bonking is caused only by dehydration, not fuel source."}, {"id": "b", "text": "Training raises the fat-fueled ceiling from roughly 50% of capacity to roughly 80%, sparing glycogen (a finite fuel) for longer before it runs out."}, {"id": "c", "text": "Aerobic training eliminates the need for carbohydrate entirely."}, {"id": "d", "text": "Bonking only happens in races longer than a marathon."}]'::jsonb, 'b', 'An untrained athlete typically can''t fuel much past 50% of capacity on fat alone before switching to carbohydrate; a well-trained aerobic athlete can push that ceiling to roughly 80%. Since carbohydrate stores are finite and fat stores effectively aren''t, a higher fat-fueled ceiling means a longer runway before bonking becomes a risk.'
from public.topics t
left join public.concepts c on c.slug = 'bonking' and c.topic_id = t.id
where t.slug = 'the-aerobic-base';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Why does the Haarchive recommend the talk test as a practical alternative to a 30-minute time trial for estimating lactate threshold?', '[{"id": "a", "text": "It''s more accurate than a lab test in every case."}, {"id": "b", "text": "It gives a usable threshold estimate without requiring the maximal, genuinely unpleasant effort a 30-minute time trial demands."}, {"id": "c", "text": "It measures VO2 max directly instead of lactate threshold."}, {"id": "d", "text": "It only works for elite athletes with a coach present."}]'::jsonb, 'b', 'The 30-minute time trial is accurate but genuinely unpleasant. The talk test estimates the same anchor number (lactate threshold heart rate) by finding the last pace where speaking still feels comfortable, without requiring the same maximal effort.'
from public.topics t
left join public.concepts c on c.slug = 'talk-test' and c.topic_id = t.id
where t.slug = 'data-and-analytics';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A runner notices their heart rate climbs gradually over a long steady session even though their pace hasn''t changed. According to the Haarchive, what does this cardiac drift most likely mean?', '[{"id": "a", "text": "It''s always a sign of overtraining and the session should be stopped immediately."}, {"id": "b", "text": "It''s an expected physiological response to sustained load (driven by factors like mild dehydration and rising core temperature), not necessarily a bad sign."}, {"id": "c", "text": "It means the runner''s GPS watch is malfunctioning."}, {"id": "d", "text": "It means the runner has crossed into anaerobic effort."}]'::jsonb, 'b', 'A rising heart rate at a fixed pace late in a long session isn''t necessarily a bad sign -- it''s an expected physiological response to sustained load. It''s worth tracking over time, since drifting noticeably more than usual at the same pace is a useful signal something is off that day.'
from public.topics t
left join public.concepts c on c.slug = 'cardiac-drift' and c.topic_id = t.id
where t.slug = 'data-and-analytics';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'How does critical power differ from lactate threshold as a way of understanding an athlete''s limits, according to the Haarchive?', '[{"id": "a", "text": "They''re the same measurement with two different names."}, {"id": "b", "text": "Lactate threshold is a chemical signal marking when the effort of holding on starts rising, while critical power marks the actual ceiling for how long any intensity above it can be sustained at all, regardless of pain tolerance."}, {"id": "c", "text": "Critical power only applies to cycling, not running."}, {"id": "d", "text": "Lactate threshold is always a higher intensity than critical power."}]'::jsonb, 'b', 'Lactate threshold marks the point blood lactate starts climbing steadily -- useful, but a chemical signal, not a direct measure of how much longer an effort can hold. Critical power is sharper: the highest output sustainable in genuine steady state, with everything above it eventually forcing a stop no matter the will to continue.'
from public.topics t
left join public.concepts c on c.slug = 'critical-power' and c.topic_id = t.id
where t.slug = 'data-and-analytics';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A runner plans to take in 90 g/h of carbohydrate for the first time on race day, having never practiced it in training. According to the Haarchive, what''s the most likely outcome?', '[{"id": "a", "text": "No issue -- the body automatically adapts to any carbohydrate intake in real time."}, {"id": "b", "text": "A reliable way to get GI distress, since gut tolerance to carbohydrate intake is built gradually through repeated practice, not improvised on race day."}, {"id": "c", "text": "This is the recommended approach, since race-day adrenaline improves digestion."}, {"id": "d", "text": "It only matters for ultra-distance races, not marathons."}]'::jsonb, 'b', 'Jumping straight to 90-120 g/h on race day without practice is a reliable way to get GI distress. Regularly taking in carbohydrate during training raises tolerance and reduces symptoms over time -- gut tolerance is a trainable skill, built gradually, never debuted for the first time on race day.'
from public.topics t
left join public.concepts c on c.slug = 'gut-training' and c.topic_id = t.id
where t.slug = 'nutrition-and-fueling';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Why does the Haarchive recommend testing a carb-loading routine in training before race day, rather than just following the grams-per-kilogram target on race morning?', '[{"id": "a", "text": "The target itself is unreliable and shouldn''t be trusted."}, {"id": "b", "text": "Even with a correct target, execution details -- timing, digestion competing with muscles for blood flow, individual gut tolerance -- can go wrong if untested, so the exact routine needs a trial run first."}, {"id": "c", "text": "Carb loading has no real effect on performance, so testing it doesn''t matter either way."}, {"id": "d", "text": "Race organizers require a pre-race nutrition log."}]'::jsonb, 'b', 'The recommended target is roughly 8-12 g/kg/day for 24-48 hours before the event, but digestion competes with running muscles for blood flow and gut tolerance varies -- the guidance is to test the exact routine in training first, not for the first time on race morning.'
from public.topics t
left join public.concepts c on c.slug = 'carb-loading' and c.topic_id = t.id
where t.slug = 'nutrition-and-fueling';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Why does combining glucose (or maltodextrin) with fructose typically allow a runner to absorb and oxidize more total carbohydrate per hour than glucose alone, according to the Haarchive?', '[{"id": "a", "text": "Fructose suppresses appetite, so more carbohydrate can be consumed without feeling full."}, {"id": "b", "text": "Glucose and fructose use separate gut absorption pathways (SGLT1 and GLUT5), so combining them lets the gut use both at once rather than saturating a single transporter."}, {"id": "c", "text": "Fructose is absorbed directly into muscle tissue, bypassing the gut entirely."}, {"id": "d", "text": "The combination has no real advantage; it''s mainly a flavor preference."}]'::jsonb, 'b', 'Glucose and maltodextrin mainly use the SGLT1 transporter; fructose mainly uses a separate one, GLUT5. Combining them lets the gut use both pathways at once, raising the total carbohydrate that can be absorbed and oxidized -- glucose-only fueling tends to plateau around 1.0-1.1 g/min, while glucose plus fructose pushes that ceiling higher.'
from public.topics t
left join public.concepts c on c.slug = 'carbohydrate-oxidation' and c.topic_id = t.id
where t.slug = 'nutrition-and-fueling';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A study found pain tolerance rose 41% in a group training with high-intensity intervals, but didn''t move at all in a group training with medium-intensity continuous cycling, despite both groups achieving equal fitness gains. What does the Haarchive conclude from this?', '[{"id": "a", "text": "Pain tolerance and fitness always improve together automatically, so the comparison doesn''t matter."}, {"id": "b", "text": "It''s intensity specifically, not just sustained discomfort or fitness gains, that builds pain tolerance -- a real, separate reason to keep interval work in a program."}, {"id": "c", "text": "Continuous cycling is a superior training method overall since it avoided raising pain tolerance."}, {"id": "d", "text": "Pain tolerance is a fixed personality trait unrelated to training type."}]'::jsonb, 'b', 'The interval group''s pain tolerance rose 41% while the continuous group''s didn''t move at all, despite equal fitness gains -- it''s intensity specifically that builds pain tolerance, a real, separate reason to keep interval work in a program beyond its VO2 max and threshold benefits.'
from public.topics t
left join public.concepts c on c.slug = 'pain-tolerance' and c.topic_id = t.id
where t.slug = 'sports-psychology';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'A 1978 study gave dental-surgery patients either IV morphine or plain saline. Some saline patients felt real pain relief -- but that relief disappeared immediately when naloxone (an opioid blocker) was added. What does the Haarchive say this shows about belief effects?', '[{"id": "a", "text": "Placebo relief is purely imaginary and has no measurable physiological basis."}, {"id": "b", "text": "The placebo response runs through the body''s own endorphin system -- a genuine physiological mechanism, not just imagination."}, {"id": "c", "text": "Naloxone causes pain on its own, which is why the relief stopped."}, {"id": "d", "text": "Only saline, never morphine, can produce a real placebo effect."}]'::jsonb, 'b', 'Adding naloxone shut the relief off immediately, proving the placebo response ran through the body''s own endorphin system, not imagination -- a physiological mechanism, not simply ''in your head.'''
from public.topics t
left join public.concepts c on c.slug = 'belief-effects' and c.topic_id = t.id
where t.slug = 'sports-psychology';

-- total questions: 14
