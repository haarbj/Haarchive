-- Phase 3: closes the "coaching" onboarding orientation's dead end -- the
-- coaching-philosophy learning path (recommend.ts) previously had zero
-- knowledge-check coverage across all 5 of its topics, meaning a user who
-- answered "I coach runners" during onboarding could never reach Mastered
-- on anything their own path recommended. No schema change: same
-- knowledge_checks table from 20260813020000_knowledge_checks.sql, same
-- RLS (already applied, nothing to redo), same security model.
--
-- 3 questions for coaching-library, grounded directly in real prose read
-- before writing (src/components/coaches/coaching-library-home.tsx's
-- "Shared Principles" section, and src/lib/coaches/data.ts's Daniels/
-- Norwegian System coach entries) -- not drafted from memory. Each maps to
-- one of coaching-library's 3 existing seeded concepts (vdot,
-- double-threshold, periodization); no new concept invented to attach a
-- question. This intentionally does NOT attempt to cover every
-- topic/concept still missing knowledge checks -- see the Phase 3 audit
-- for the full list; this migration closes only the specific dead-end path.
insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Jack Daniels recalculates a runner''s VDOT and its five training paces as fitness changes, rather than writing a fixed plan months in advance. According to the Haarchive, why?', '[{"id": "a", "text": "Because race rules require official retesting at set intervals."}, {"id": "b", "text": "Because VDOT is derived from a runner''s current fitness, so recalculating it keeps every prescribed pace matched to present ability rather than a static, aging plan."}, {"id": "c", "text": "Because VDOT only works for elite runners and needs constant correction for recreational ones."}, {"id": "d", "text": "Because Daniels believes toughness and volume matter more than precision, and recalculation compensates for that."}]'::jsonb, 'b', 'VDOT is a single number derived from a recent race result, mapped onto five training paces. Because it''s recalculated as fitness changes, the target pace always matches current ability rather than a static plan written months in advance -- precision, not volume or toughness, is what separates a good plan from a wasted one in Daniels'' framing.'
from public.topics t
left join public.concepts c on c.slug = 'vdot' and c.topic_id = t.id
where t.slug = 'coaching-library';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'The Norwegian double-threshold system splits a day''s threshold work into two shorter sessions rather than one longer hard session. According to the Haarchive, what problem does this specifically solve?', '[{"id": "a", "text": "It lets an athlete complete two full hard days back-to-back without any consequence."}, {"id": "b", "text": "It fits a large volume of high-value threshold work into a week at a muscular cost closer to one long session than two full hard days, by holding each session just below where lactate starts accumulating faster than it can clear."}, {"id": "c", "text": "It eliminates the need for an aerobic base entirely."}, {"id": "d", "text": "It replaces the need for any lactate testing, since pace alone is precise enough."}]'::jsonb, 'b', 'The Norwegian model holds that running''s real ceiling on hard training is usually muscular, not cardiovascular. By holding two sessions a day just below the point where lactate starts accumulating faster than the body can clear it, tracked with frequent blood-lactate testing, the system fits a large volume of high-value work into a week at a muscular cost closer to one long session than two full hard days.'
from public.topics t
left join public.concepts c on c.slug = 'double-threshold' and c.topic_id = t.id
where t.slug = 'coaching-library';

insert into public.knowledge_checks (topic_id, concept_id, question, options, correct_option_id, explanation)
select t.id, c.id, 'Despite their real differences, the Haarchive''s Coaching Library identifies a shared principle across all seven coaching philosophies about how training should be structured over time. What is it?', '[{"id": "a", "text": "Every system agrees hard work should always come before any aerobic base is built."}, {"id": "b", "text": "Progression has to move toward race specificity: general fitness eventually has to convert into the exact demand of the goal race."}, {"id": "c", "text": "All seven systems agree recovery should never be deliberately managed, only taken passively."}, {"id": "d", "text": "Every philosophy treats mental and technical coaching as equally central to their system."}]'::jsonb, 'b', 'One of the Coaching Library''s identified shared principles, despite real disagreements elsewhere: progression has to move toward race specificity -- general fitness eventually has to convert into the exact demand of the goal race, even though systems disagree about exactly how much threshold work or how prescriptive that progression should be.'
from public.topics t
left join public.concepts c on c.slug = 'periodization' and c.topic_id = t.id
where t.slug = 'coaching-library';
