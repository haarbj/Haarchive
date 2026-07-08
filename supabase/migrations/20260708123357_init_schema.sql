-- Extensions
create extension if not exists pgcrypto;

-- Enums
create type public.units as enum ('mi', 'km');
create type public.sex as enum ('male', 'female', 'unspecified');
create type public.athlete_level as enum ('new', 'recreational', 'hs', 'college', 'masters', 'elite', 'ultra');
create type public.budget_tier as enum ('minimal', 'moderate', 'flexible');
create type public.goal_priority as enum ('A', 'B', 'C');
create type public.goal_status as enum ('active', 'achieved', 'abandoned');
create type public.course_type as enum ('track', 'road', 'xc', 'trail');
create type public.injury_severity as enum ('mild', 'moderate', 'severe');
create type public.plan_philosophy as enum ('polarized', 'pyramidal', 'threshold_heavy', 'custom');
create type public.plan_status as enum ('draft', 'active', 'completed', 'abandoned');
create type public.mesocycle_phase as enum ('base', 'build', 'peak', 'taper', 'recovery');
create type public.workout_type as enum ('easy', 'tempo', 'vo2', 'long', 'race', 'recovery', 'strength');
create type public.message_role as enum ('user', 'assistant');
create type public.team_role as enum ('athlete', 'coach');
create type public.connected_provider as enum ('garmin', 'strava', 'coros', 'apple_health');

-- profiles: 1:1 with auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  timezone text not null default 'UTC',
  units public.units not null default 'mi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- athlete_profiles: 1:1 with user, built up progressively by the staged
-- onboarding flow rather than collected all at once
create table public.athlete_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_year int,
  sex public.sex,
  height_cm numeric,
  weight_kg numeric,
  years_running int,
  current_level public.athlete_level,
  lifetime_mileage numeric,
  current_weekly_mileage numeric,
  highest_weekly_mileage numeric,
  longest_run_km numeric,
  primary_event text,
  country text,
  state text,
  city text,
  elevation_m int,
  has_track_access boolean not null default false,
  has_trail_access boolean not null default false,
  has_treadmill_access boolean not null default false,
  weekly_training_hours_available numeric,
  strength_days_per_week int,
  cross_training_days_per_week int,
  budget_tier public.budget_tier,
  equipment jsonb not null default '{}'::jsonb,
  hard_constraints jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  race_name text not null,
  distance_m int not null,
  goal_time_s int,
  goal_date date,
  priority public.goal_priority not null default 'B',
  status public.goal_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

-- race_results: a PR is just the best row per distance for a given user,
-- not a separate table -- two copies of the same fact would invite them to
-- disagree
create table public.race_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  race_name text not null,
  race_date date not null,
  distance_m int not null,
  finish_time_s int not null,
  course_type public.course_type not null,
  placement int,
  conditions jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  injury_type text not null,
  body_part text not null,
  start_date date not null,
  end_date date,
  severity public.injury_severity not null,
  affects_training boolean not null default true,
  notes text
);

-- training_plans: the macrocycle
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  name text not null,
  start_date date not null,
  end_date date not null,
  philosophy public.plan_philosophy not null default 'custom',
  status public.plan_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- mesocycles: phase within a plan. user_id is denormalized from
-- training_plans so RLS policies can check ownership directly instead of
-- joining back through training_plans on every query.
create table public.mesocycles (
  id uuid primary key default gen_random_uuid(),
  training_plan_id uuid not null references public.training_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phase public.mesocycle_phase not null,
  start_date date not null,
  end_date date not null,
  focus_notes text
);

-- workouts: prescribed session, engine-generated. user_id is denormalized
-- from mesocycles for the same reason as above.
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  mesocycle_id uuid not null references public.mesocycles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_date date not null,
  workout_type public.workout_type not null,
  prescription jsonb not null default '{}'::jsonb
);

create table public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  actual_distance_m numeric,
  actual_time_s int,
  avg_hr int,
  rpe int check (rpe between 1 and 10),
  notes text
);

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  fatigue int not null check (fatigue between 1 and 5),
  soreness int not null check (soreness between 1 and 5),
  sleep_quality int not null check (sleep_quality between 1 and 5),
  stress int not null check (stress between 1 and 5),
  notes text,
  ai_summary text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

-- user_id is denormalized from ai_conversations for the same RLS-simplicity
-- reason as mesocycles/workouts above.
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- notifications, saved_calculations, connected_accounts: forward-looking
-- tables, unused until their respective features ship (see architecture
-- doc §23) -- created now so those features don't need a breaking
-- migration later.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  content text not null,
  read_at timestamptz,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create table public.saved_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  calculator_type text not null,
  input_json jsonb not null,
  output_json jsonb not null,
  label text,
  created_at timestamptz not null default now()
);

create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.connected_provider not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- teams / team_memberships: stubbed now so a role column never has to be
-- added to a table that already holds real rows once coach accounts (§23)
-- are built. Nothing reads from these yet.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- Indexes: every foreign key, plus the date-range columns dashboards will
-- query most often.
create index idx_athlete_profiles_user_id on public.athlete_profiles (user_id);
create index idx_goals_user_id on public.goals (user_id);
create index idx_race_results_user_id on public.race_results (user_id);
create index idx_injuries_user_id on public.injuries (user_id);
create index idx_training_plans_user_id on public.training_plans (user_id);
create index idx_training_plans_goal_id on public.training_plans (goal_id);
create index idx_mesocycles_training_plan_id on public.mesocycles (training_plan_id);
create index idx_mesocycles_user_id on public.mesocycles (user_id);
create index idx_workouts_mesocycle_id on public.workouts (mesocycle_id);
create index idx_workouts_user_id on public.workouts (user_id);
create index idx_workouts_scheduled_date on public.workouts (scheduled_date);
create index idx_workout_completions_workout_id on public.workout_completions (workout_id);
create index idx_workout_completions_user_id on public.workout_completions (user_id);
create index idx_weekly_checkins_user_id on public.weekly_checkins (user_id);
create index idx_weekly_checkins_week_start on public.weekly_checkins (week_start);
create index idx_ai_conversations_user_id on public.ai_conversations (user_id);
create index idx_ai_messages_conversation_id on public.ai_messages (conversation_id);
create index idx_ai_messages_user_id on public.ai_messages (user_id);
create index idx_notifications_user_id on public.notifications (user_id);
create index idx_saved_calculations_user_id on public.saved_calculations (user_id);
create index idx_connected_accounts_user_id on public.connected_accounts (user_id);
create index idx_team_memberships_team_id on public.team_memberships (team_id);
create index idx_team_memberships_user_id on public.team_memberships (user_id);

-- Auto-create a profiles row whenever someone signs up. Athlete-profile
-- fields are deliberately NOT created here -- they're collected
-- progressively, only once the staged onboarding flow actually needs them.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, timezone, units)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Runner'),
    'UTC',
    'mi'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
