-- Google (and any future OAuth provider) puts the user's name/photo under
-- full_name/name/avatar_url in raw_user_meta_data, not display_name -- prefer
-- those before falling back to the email-derived default used for
-- email/password signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, timezone, units)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Runner'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    'UTC',
    'mi'
  );
  return new;
end;
$$;
