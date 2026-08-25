-- Four-domain IA migration backfill for public.topics.category_slug and
-- public.learning_preferences.interest_category_slugs. The app-level
-- taxonomy (src/lib/sections.ts, src/lib/mastery/taxonomy.ts,
-- src/lib/validation/learning.ts) has already moved from 8 legacy
-- categories to 4 domains (physiology, psychology, philosophy, practice)
-- plus 2 supporting areas (archive, tools) -- see CLAUDE.md §6. ("archive"
-- is the Library category's real slug -- /library is already a different,
-- unrelated authenticated route, see sections.ts's comment on that entry.)
-- This migration is the corresponding data backfill.
--
-- NOT applied to the live database as part of this change -- created here,
-- ready to run via `npx supabase db push` on separate explicit instruction.

-- topics.category_slug is plain text with no FK/check constraint, so a
-- direct UPDATE is safe. mostly-easy-genuinely-hard is the one documented
-- exception (see sections.ts's own comment on that section): it moves to
-- 'philosophy', not the 'physiology' every other former the-science topic
-- gets, so it's handled first, ahead of the blanket the-science ->
-- physiology update below (which would otherwise catch it too).
update public.topics
set category_slug = 'philosophy'
where slug = 'mostly-easy-genuinely-hard';

update public.topics set category_slug = 'physiology' where category_slug in ('the-science', 'recovery-and-fueling');
update public.topics set category_slug = 'psychology' where category_slug = 'mind-and-recovery';
update public.topics set category_slug = 'philosophy' where category_slug = 'foundations';
update public.topics set category_slug = 'practice' where category_slug in ('getting-started', 'coaching-and-training');
update public.topics set category_slug = 'archive' where category_slug = 'writing-and-resources';
-- 'tools' is unchanged -- it was already one of the 6 final category slugs.

-- learning_preferences.interest_category_slugs is a text[]: a single row
-- can contain more than one legacy slug that collapses into the same new
-- domain (e.g. a user who'd previously selected both 'the-science' and
-- 'recovery-and-fueling' should end up with one 'physiology' entry, not
-- two). Map each element via a lateral join, then re-aggregate with
-- array_agg(distinct ...) to dedupe. learningInterestCategorySchema's old
-- enum only ever wrote 5 of these 7 legacy slugs (getting-started and
-- writing-and-resources were never offered on the interest picker) -- all
-- 7 are mapped anyway for defensive completeness, matching the topics
-- table above.
update public.learning_preferences
set interest_category_slugs = (
  select coalesce(array_agg(distinct mapped.slug), '{}')
  from unnest(interest_category_slugs) as original(slug)
  cross join lateral (
    select case original.slug
      when 'the-science' then 'physiology'
      when 'recovery-and-fueling' then 'physiology'
      when 'mind-and-recovery' then 'psychology'
      when 'foundations' then 'philosophy'
      when 'getting-started' then 'practice'
      when 'coaching-and-training' then 'practice'
      when 'writing-and-resources' then 'archive'
      else original.slug
    end as slug
  ) as mapped
)
where interest_category_slugs && array['the-science', 'recovery-and-fueling', 'mind-and-recovery', 'foundations', 'getting-started', 'coaching-and-training', 'writing-and-resources'];
