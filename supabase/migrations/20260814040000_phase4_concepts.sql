-- Phase 4 (Learning Content Coverage & Path Completion): seeds the 9 new
-- Concept rows added to CONCEPT_SEEDS in src/lib/mastery/taxonomy.ts this
-- phase (marathon-training x3, how-to-start-running x2, training-philosophy
-- x2, workout-library x2), using the exact same insert-select-per-topic-
-- slug pattern as the original seed in 20260813010000_learning_progress.sql
-- (taxonomy.ts is the source of truth this mirrors; there is no separate
-- seed script that reads it automatically -- despite that file's own
-- header comment, the actual concepts/topics tables have always been
-- seeded by hand-written migrations like this one).
--
-- Corrective, not purely additive: the prior migration in this same phase
-- (20260814030000_phase4_content_knowledge_checks.sql) already inserted 9
-- knowledge_checks rows referencing these concept slugs via a LEFT JOIN
-- that silently resolved to NULL, since these concept rows didn't exist
-- yet at that point -- a real sequencing bug, not by design. The UPDATE
-- block below backfills concept_id on exactly those 9 rows, matched by a
-- distinctive substring of each question's own text (each is unique to
-- one specific question, verified by direct query before writing this).

insert into public.concepts (topic_id, slug, title, glossary_term_id)
select t.id, 'medium-long-run', 'The Medium-Long Run', 'medium-long-run' from public.topics t where t.slug = 'marathon-training'
union all
select t.id, 'marathon-pace-paradox', 'The Marathon Pace Paradox', 'marathon-pace-paradox' from public.topics t where t.slug = 'marathon-training'
union all
select t.id, 'buildup-cycle-length', 'Buildup Cycle Length', 'buildup-cycle-length' from public.topics t where t.slug = 'marathon-training'
union all
select t.id, 'beginner-progression', 'The Beginner Progression', 'beginner-progression' from public.topics t where t.slug = 'how-to-start-running'
union all
select t.id, 'training-heart-rate-formula', 'Training Heart Rate Formula', 'training-heart-rate-formula' from public.topics t where t.slug = 'how-to-start-running'
union all
select t.id, 'individualization', 'Individualization', 'individualization' from public.topics t where t.slug = 'training-philosophy'
union all
select t.id, 'consistency-beats-perfection', 'Consistency Beats Perfection', 'consistency-beats-perfection' from public.topics t where t.slug = 'training-philosophy'
union all
select t.id, 'advanced-periodization', 'Advanced Periodization', 'advanced-periodization' from public.topics t where t.slug = 'workout-library'
union all
select t.id, 'matching-interval-pace', 'Matching Interval Pace to Fitness', 'matching-interval-pace' from public.topics t where t.slug = 'workout-library'
on conflict (slug) do nothing;

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'medium-long-run'
  and kc.question ilike '%medium-long run whenever the week feels busy%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'marathon-pace-paradox'
  and kc.question ilike '%20-mile long run entirely at marathon goal pace%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'buildup-cycle-length'
  and kc.question ilike '%past 24 weeks of continuously increasing volume%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'beginner-progression'
  and kc.question ilike '%Stage 2 of the beginner progression%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'training-heart-rate-formula'
  and kc.question ilike '%220-minus-age formula%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'individualization'
  and kc.question ilike '%nearly opposite training plans by their coach%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'consistency-beats-perfection'
  and kc.question ilike '%burns out and stops for six weeks%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'advanced-periodization'
  and kc.question ilike '%six to eight hours apart%';

update public.knowledge_checks kc
set concept_id = c.id
from public.concepts c
where kc.concept_id is null
  and c.slug = 'matching-interval-pace'
  and kc.question ilike '%31-minute 10K fitness level%';
