-- Learning Progress (Phase 1) -- personalization preferences + a topic-level
-- learning-progress model. Deliberately NOT "mastery"/XP/points in the
-- user-facing sense (see the app-level copy) -- internally this file still
-- uses "mastery" as the technical term for "how developed is this user's
-- understanding of this topic," matching the vocabulary the coaching-engine
-- and Coach.evidenceStrength already use for similar concepts elsewhere in
-- this schema.
--
-- Two real tables become a reference taxonomy (topics, concepts) and three
-- become genuinely personal, single-owner user data (learning_preferences,
-- learning_events, user_topic_mastery). The taxonomy tables exist as real
-- rows (not code, unlike sections.ts/coaches/data.ts) specifically because
-- user data below needs a stable FK target -- the same reasoning
-- article_tag_options.sql already used to backstop articles.tags' free
-- text, seeded once from sections.ts/PHYSIOLOGY_TOPICS rather than
-- live-synced to either.

-- ---------------------------------------------------------------------
-- Reference taxonomy: public read, service-role-only write. Unlike
-- article_tag_options.sql (which has no select policy at all -- every read
-- of that table is already service-role-mediated from the article editor),
-- topics/concepts have to be readable through the ordinary RLS-scoped
-- client: the dashboard, settings, and logLearningEvent all query them
-- directly as the signed-in user, not through a service-role code path. No
-- insert/update/delete policy is defined below, so only service-role (the
-- seed data at the bottom of this file, and any future admin tooling) can
-- write to either table -- regular users can never mutate the taxonomy.
-- ---------------------------------------------------------------------

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  -- Convention-FK, not a real one: sections.ts is code, not a database
  -- table, so there is nothing here to reference. Nullable because
  -- Coaching Library / Athlete Library / Training Plans topics have no
  -- sections.ts content array at all (see the migration's own audit).
  section_slug text,
  category_slug text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create index idx_topics_category_slug on public.topics (category_slug);

alter table public.topics enable row level security;
create policy "topics_select_public" on public.topics for select to public using (true);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  slug text unique not null,
  title text not null,
  -- Reuses glossary.ts's own id where one already exists for this concept,
  -- so the canonical href only ever needs resolving in one place. Nullable:
  -- not every concept has a matching glossary entry yet.
  glossary_term_id text,
  created_at timestamptz not null default now()
);

create index idx_concepts_topic_id on public.concepts (topic_id);

alter table public.concepts enable row level security;
create policy "concepts_select_public" on public.concepts for select to public using (true);

-- ---------------------------------------------------------------------
-- User data: single-owner, authenticated only -- the exact notes.sql
-- select_own/insert_own/update_own/delete_own shape, not service-role
-- mediation (there is no anonymous-write case for any of these three; see
-- the feature's own design doc on why persistent progress tracking is
-- deliberately authenticated-only).
-- ---------------------------------------------------------------------

create table public.learning_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- 'new_runner' | 'training_goal' | 'science' | 'coaching' | 'exploring'
  -- Plain text, not an enum, validated app-side (src/lib/validation) --
  -- matches article_type/evidence_category's own "grows without a
  -- migration each time" reasoning, since onboarding copy is likely to be
  -- iterated on.
  orientation text,
  interest_category_slugs text[] not null default '{}',
  onboarding_completed_at timestamptz,
  onboarding_skipped_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger on_learning_preferences_updated
  before update on public.learning_preferences
  for each row execute function public.set_updated_at();

alter table public.learning_preferences enable row level security;

create policy "learning_preferences_select_own" on public.learning_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "learning_preferences_insert_own" on public.learning_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "learning_preferences_update_own" on public.learning_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "learning_preferences_delete_own" on public.learning_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Append-only event log -- the source of truth user_topic_mastery is
-- derived from. topic_id/concept_id use `on delete set null`, not cascade:
-- deleting a topic (a taxonomy edit) must never delete a user's own
-- history, only orphan the reference -- content_slug is kept as a plain
-- string specifically so the event stays meaningful even then.
create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'content_viewed' | 'content_engaged' | 'note_taken' | 'topic_revisited'
  -- | 'concept_engaged' | 'tool_used' | 'knowledge_check_answered' (Phase 2)
  -- Plain text for the same reason orientation is -- this list is expected
  -- to grow in Phase 2 without a migration.
  event_type text not null,
  topic_id uuid references public.topics (id) on delete set null,
  concept_id uuid references public.concepts (id) on delete set null,
  content_slug text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_learning_events_user_topic on public.learning_events (user_id, topic_id, created_at desc);

-- Idempotency, enforced at the database, not just client-side (per the
-- feature's own explicit requirement): two different dedup scopes for two
-- different kinds of signal.
--
-- "Did this happen at all" signals -- first-visit and first-tool-use are
-- each a one-time confirmation, not something repeat visits should keep
-- re-earning. Same reasoning for concept_engaged: revisiting the SAME
-- concept doesn't add breadth, only touching a DIFFERENT one does.
create unique index idx_learning_events_once_ever
  on public.learning_events (user_id, topic_id, event_type)
  where event_type in ('content_viewed', 'tool_used');

create unique index idx_learning_events_concept_once_ever
  on public.learning_events (user_id, concept_id, event_type)
  where event_type = 'concept_engaged';

-- "Did this happen today" signals -- deep engagement and a spaced return
-- are each meant to reflect one genuine session, not every reload of the
-- same page in the same sitting. Scoped to the event's own calendar day
-- (UTC, matching every other timestamptz column in this schema) rather
-- than a rolling 24h window, so it's a simple, predictable boundary rather
-- than one that depends on exactly when in the day the first event landed.
-- `(created_at at time zone 'utc')::date`, not a plain `created_at::date`
-- cast -- a bare cast depends on the session's TimeZone setting (not
-- immutable, so Postgres rejects it in an index expression); pinning to a
-- literal 'utc' zone first makes the whole expression deterministic.
create unique index idx_learning_events_once_per_day
  on public.learning_events (user_id, topic_id, event_type, ((created_at at time zone 'utc')::date))
  where event_type in ('content_engaged', 'topic_revisited');

alter table public.learning_events enable row level security;

create policy "learning_events_select_own" on public.learning_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "learning_events_insert_own" on public.learning_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- No update/delete policy: an event log is append-only by design -- a user
-- can't edit or erase their own history (this is also what makes
-- recomputation trustworthy).

-- Derived + cached, never hand-written -- always recomputable from
-- learning_events, which is what makes an algorithm change or a taxonomy
-- edit safe without a backfill migration.
create table public.user_topic_mastery (
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  score numeric not null default 0,
  -- 'exploring' | 'familiar' | 'proficient' | 'advanced' | 'mastered'
  -- (Phase 2 only) -- plain text, validated against the algorithm's own
  -- MasteryLevel union in application code.
  level text not null default 'exploring',
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index idx_user_topic_mastery_user_id on public.user_topic_mastery (user_id);

alter table public.user_topic_mastery enable row level security;

create policy "user_topic_mastery_select_own" on public.user_topic_mastery
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_topic_mastery_insert_own" on public.user_topic_mastery
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_topic_mastery_update_own" on public.user_topic_mastery
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Seed data, generated from src/lib/mastery/taxonomy.ts (the source of
-- truth for both -- keep them in sync by hand if either changes). One
-- topic per real sections.ts entry (minus "contact", a form, not
-- content); concepts limited to what glossary.ts/PHYSIOLOGY_TOPICS
-- already curate (see taxonomy.ts's own header comment for the exact
-- inclusion/exclusion reasoning). on conflict do nothing so re-running
-- this migration, or hand-adding a row later, is never destructive.
-- ---------------------------------------------------------------------

insert into public.topics (slug, title, category_slug, section_slug) values
  ('how-to-start-running', 'How to Start Running', 'getting-started', 'how-to-start-running'),
  ('training-philosophy', 'Training Philosophy', 'foundations', 'training-philosophy'),
  ('the-philosophy-of-running', 'The Philosophy of Running', 'foundations', 'the-philosophy-of-running'),
  ('exercise-physiology', 'Exercise Physiology', 'the-science', 'exercise-physiology'),
  ('the-aerobic-base', 'The Aerobic Base', 'the-science', 'the-aerobic-base'),
  ('research-library', 'Research Library', 'the-science', 'research-library'),
  ('data-and-analytics', 'Data & Analytics', 'the-science', 'data-and-analytics'),
  ('what-a-race-result-can-tell-you', 'What One Race Result Can (and Can''t) Tell You', 'the-science', 'what-a-race-result-can-tell-you'),
  ('mostly-easy-genuinely-hard', 'The Case for Mostly Easy, Genuinely Hard Training', 'the-science', 'mostly-easy-genuinely-hard'),
  ('coaching-library', 'Coaching Library', 'coaching-and-training', 'coaching-library'),
  ('athlete-library', 'Athlete Library', 'coaching-and-training', 'athlete-library'),
  ('marathon-training', 'Marathon Training', 'coaching-and-training', 'marathon-training'),
  ('workout-library', 'Workout Library', 'coaching-and-training', 'workout-library'),
  ('trail-and-ultra-training', 'Trail & Ultra Running', 'coaching-and-training', 'trail-and-ultra-training'),
  ('strength-training', 'Strength Training for Runners', 'coaching-and-training', 'strength-training'),
  ('5k-training', '5K Training', 'coaching-and-training', '5k-training'),
  ('training-plans', 'Training Plans', 'coaching-and-training', 'training-plans'),
  ('nutrition-and-fueling', 'Nutrition & Fueling', 'recovery-and-fueling', 'nutrition-and-fueling'),
  ('recovery', 'Recovery', 'recovery-and-fueling', 'recovery'),
  ('training-across-the-menstrual-cycle', 'Training Across the Menstrual Cycle', 'recovery-and-fueling', 'training-across-the-menstrual-cycle'),
  ('pregnancy-and-postpartum-running', 'Pregnancy and Postpartum Running', 'recovery-and-fueling', 'pregnancy-and-postpartum-running'),
  ('training-through-the-decades', 'Training Through the Decades', 'recovery-and-fueling', 'training-through-the-decades'),
  ('sports-psychology', 'Sports Psychology', 'mind-and-recovery', 'sports-psychology'),
  ('goal-setting', 'Goal Setting & Identity', 'mind-and-recovery', 'goal-setting'),
  ('self-talk', 'Self-Talk & Mental Technique', 'mind-and-recovery', 'self-talk'),
  ('daily-practice', 'Consistency & Daily Practice', 'mind-and-recovery', 'daily-practice'),
  ('performing-under-pressure', 'Performing Under Pressure', 'mind-and-recovery', 'performing-under-pressure'),
  ('for-coaches', 'For Coaches', 'mind-and-recovery', 'for-coaches'),
  ('articles', 'Articles', 'writing-and-resources', 'articles'),
  ('resources', 'Resources', 'writing-and-resources', 'resources'),
  ('choosing-a-pace-calculator', 'Which Pace Calculator Should I Use?', 'tools', 'choosing-a-pace-calculator'),
  ('heat-tracker', 'Heat Tracker', 'tools', 'heat-tracker'),
  ('pace-calculator', 'Pace & Heart Rate Calculator', 'tools', 'pace-calculator'),
  ('environmental-calculator', 'Environmental Performance Calculator', 'tools', 'environmental-calculator'),
  ('gap-calculator', 'GAP Calculator', 'tools', 'gap-calculator'),
  ('pace-percent-calculator', 'Pace Percent Calculator', 'tools', 'pace-percent-calculator'),
  ('cv-threshold-calculator', 'Threshold, CV & VO2 Max Pace Calculator', 'tools', 'cv-threshold-calculator'),
  ('race-pace-calculator', 'Race Pace Calculator', 'tools', 'race-pace-calculator'),
  ('hr-threshold-calculator', 'LT1 & LT2 Heart Rate Reference Ranges', 'tools', 'hr-threshold-calculator'),
  ('tinman-calculator', 'Tinman Running Calculator', 'tools', 'tinman-calculator'),
  ('marathon-pacing-calculator', 'Marathon Pacing Calculator', 'tools', 'marathon-pacing-calculator')
on conflict (slug) do nothing;

insert into public.concepts (topic_id, slug, title, glossary_term_id)
select t.id, 'vo2-max', 'VO₂ Max', 'vo2-max' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'muscle-tone', 'Muscle Tone & Stiffness', 'muscle-tone' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'central-governor', 'Central Governor Model', 'central-governor' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'psychobiological-model', 'Psychobiological Model', 'psychobiological-model' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'perceived-effort', 'Perceived Effort', 'perceived-effort' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'steady-state', 'Steady State', 'steady-state' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'oxygen-debt', 'Oxygen Debt', 'oxygen-debt' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'size-principle', 'The Size Principle', 'size-principle' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'fatigue-resistance', 'Fatigue Resistance', 'voluntary-activation' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'muscle-fiber-types', 'Muscle Fiber Types', 'alactic' from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'neuromuscular-power', 'Neuromuscular Power', null from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'biomechanics-form', 'Biomechanics & Form', null from public.topics t where t.slug = 'exercise-physiology'
union all
select t.id, 'super-compensation', 'Supercompensation', 'super-compensation' from public.topics t where t.slug = 'the-aerobic-base'
union all
select t.id, 'bonking', 'Bonking', 'bonking' from public.topics t where t.slug = 'the-aerobic-base'
union all
select t.id, 'capillary-density', 'Capillary Density', 'capillary-density' from public.topics t where t.slug = 'the-aerobic-base'
union all
select t.id, 'mitochondria', 'Mitochondrial Density', 'mitochondria' from public.topics t where t.slug = 'the-aerobic-base'
union all
select t.id, 'cardiac-drift', 'Cardiac Drift', 'cardiac-drift' from public.topics t where t.slug = 'data-and-analytics'
union all
select t.id, 'talk-test', 'The Talk Test', 'talk-test' from public.topics t where t.slug = 'data-and-analytics'
union all
select t.id, 'cardiac-lag', 'Cardiac Lag', 'cardiac-lag' from public.topics t where t.slug = 'data-and-analytics'
union all
select t.id, 'critical-power', 'Critical Power', 'critical-power' from public.topics t where t.slug = 'data-and-analytics'
union all
select t.id, 'running-economy', 'Running Economy', 'running-economy' from public.topics t where t.slug = 'research-library'
union all
select t.id, 'glycogen-depletion', 'Glycogen Depletion', 'glycogen-depletion' from public.topics t where t.slug = 'research-library'
union all
select t.id, 'polarized-training', 'Polarized Training', 'polarized-training' from public.topics t where t.slug = 'research-library'
union all
select t.id, 'perceived-exertion', 'Rating of Perceived Exertion', 'perceived-exertion' from public.topics t where t.slug = 'research-library'
union all
select t.id, 'il-6', 'IL-6', 'il-6' from public.topics t where t.slug = 'research-library'
union all
select t.id, 'double-threshold', 'Double Threshold Training', 'double-threshold' from public.topics t where t.slug = 'coaching-library'
union all
select t.id, 'periodization', 'Periodization', 'periodization' from public.topics t where t.slug = 'coaching-library'
union all
select t.id, 'vdot', 'VDOT', 'vdot' from public.topics t where t.slug = 'coaching-library'
union all
select t.id, 'red-s', 'RED-S', 'red-s' from public.topics t where t.slug = 'recovery'
union all
select t.id, 'glycogen', 'Glycogen', 'glycogen' from public.topics t where t.slug = 'nutrition-and-fueling'
union all
select t.id, 'carb-loading', 'Carb Loading', 'carb-loading' from public.topics t where t.slug = 'nutrition-and-fueling'
union all
select t.id, 'gut-training', 'Gut Training', 'gut-training' from public.topics t where t.slug = 'nutrition-and-fueling'
union all
select t.id, 'gi-distress', 'GI Distress', 'gi-distress' from public.topics t where t.slug = 'nutrition-and-fueling'
union all
select t.id, 'carbohydrate-oxidation', 'Carbohydrate Oxidation', 'carbohydrate-oxidation' from public.topics t where t.slug = 'nutrition-and-fueling'
union all
select t.id, 'hyponatremia', 'Hyponatremia', 'hyponatremia' from public.topics t where t.slug = 'nutrition-and-fueling'
union all
select t.id, 'plasma-osmolality', 'Plasma Osmolality', 'plasma-osmolality' from public.topics t where t.slug = 'nutrition-and-fueling'
union all
select t.id, 'pain-tolerance', 'Tolerance for Suffering', 'pain-tolerance' from public.topics t where t.slug = 'sports-psychology'
union all
select t.id, 'belief-effects', 'Belief Effects', 'belief-effects' from public.topics t where t.slug = 'sports-psychology'
union all
select t.id, 'flow-state', 'Flow State', 'flow-state' from public.topics t where t.slug = 'performing-under-pressure'
union all
select t.id, 'curse-of-perfection', 'The Curse of Perfection', 'curse-of-perfection' from public.topics t where t.slug = 'performing-under-pressure'
union all
select t.id, 'curse-of-talent', 'The Curse of Talent', 'curse-of-talent' from public.topics t where t.slug = 'goal-setting'
union all
select t.id, 'lactate-threshold', 'Lactate Threshold', 'lactate-threshold' from public.topics t where t.slug = 'workout-library'
on conflict (slug) do nothing;
