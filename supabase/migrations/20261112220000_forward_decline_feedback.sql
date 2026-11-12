create table public.forward_decline_feedback (
  id bigint generated always as identity primary key,
  applicant_id uuid not null references public.forward_accounts(user_id) on delete cascade,
  kind text not null default 'declined' check (kind in ('declined', 'role_closed')),
  connection_id uuid,
  company text not null,
  role_title text not null,
  reason text,
  next_step text,
  created_at timestamptz not null default now(),
  check ((kind = 'declined' and connection_id is not null and reason is not null
      and next_step is not null and char_length(reason) between 20 and 1200
      and char_length(next_step) between 20 and 1200)
    or (kind = 'role_closed' and connection_id is null and reason is null and next_step is null))
);

create index forward_decline_feedback_inbox on public.forward_decline_feedback(applicant_id, id desc);
create index forward_decline_feedback_connection on public.forward_decline_feedback(connection_id, id desc)
  where connection_id is not null;

alter table public.forward_decline_feedback enable row level security;
revoke all on public.forward_decline_feedback from public, anon, authenticated;
grant select on public.forward_decline_feedback to authenticated;
create policy recipient_reads_feedback on public.forward_decline_feedback
  for select to authenticated using (applicant_id = (select auth.uid()));

-- Retain delivered feedback when the applicant withdraws profile access.
-- The original connection can disappear, so connection_id is a historical identifier.
create function forward_private.forward_decline_with_feedback(
  p_applicant_id uuid, p_reason text, p_next_step text
) returns void language plpgsql security definer set search_path='' as $$
declare
  manager uuid := auth.uid();
  reason_text text := regexp_replace(coalesce(p_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  next_step_text text := regexp_replace(coalesce(p_next_step, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  existing public.forward_connections;
  delivered public.forward_decline_feedback;
  team jsonb;
  connection uuid;
begin
  if forward_private.forward_role() is distinct from 'hiring' then
    raise exception 'Only a hiring manager can send hiring feedback.';
  end if;
  if char_length(reason_text) not between 20 and 1200
    or char_length(next_step_text) not between 20 and 1200 then
    raise exception 'Enter a reason and a next step of 20 to 1,200 characters each.';
  end if;

  -- Serialize decisions and withdrawal for this share.
  perform 1 from public.forward_shares
    where applicant_id = p_applicant_id and manager_id = manager for update;
  if not found then
    raise exception 'This profile is no longer shared.';
  end if;

  select * into existing from public.forward_connections
    where applicant_id = p_applicant_id and manager_id = manager;
  if existing.manager_choice = 'pass' then
    select * into delivered from public.forward_decline_feedback
      where connection_id = existing.id order by id desc limit 1;
    if found then
      if delivered.reason = reason_text and delivered.next_step = next_step_text then
        return;
      end if;
      raise exception 'Feedback was already sent for this decision.';
    end if;
  end if;

  perform forward_private.forward_choose_connection(p_applicant_id, 'pass');
  select id into connection from public.forward_connections
    where applicant_id = p_applicant_id and manager_id = manager;
  select profile into team from public.forward_hiring_publications where owner_id = manager;

  insert into public.forward_decline_feedback(applicant_id, connection_id, company, role_title, reason, next_step)
  values (p_applicant_id, connection, coalesce(nullif(team->>'company', ''), 'Hiring team'),
          coalesce(team->>'roleTitle', ''), reason_text, next_step_text);
end
$$;

create table forward_private.forward_employer_verification (
  manager_id uuid primary key references public.forward_accounts(user_id) on delete cascade,
  company text not null check (char_length(company) between 1 and 80),
  website text not null check (char_length(website) <= 250 and website ~ '^https://[A-Za-z0-9.-]+([/:?#][^[:space:]]*)?$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now()
);

create function forward_private.forward_employer_status()
returns table(company text, status text)
language sql stable security definer set search_path='' as $$
  select v.company, v.status from forward_private.forward_employer_verification v
  where v.manager_id = (select auth.uid())
$$;

create function forward_private.forward_request_employer_verification(p_website text)
returns void language plpgsql security definer set search_path='' as $$
declare
  manager uuid := auth.uid();
  company_name text;
begin
  if forward_private.forward_role() is distinct from 'hiring' then
    raise exception 'A hiring account is required.';
  end if;
  select btrim(document->'fields'->>'company') into company_name
  from public.forward_hiring_drafts where owner_id = manager for key share;
  if company_name is null or char_length(company_name) not between 1 and 80 then
    raise exception 'Save your company name before requesting verification.';
  end if;
  if p_website is null or char_length(p_website) > 250
      or p_website !~ '^https://[A-Za-z0-9.-]+([/:?#][^[:space:]]*)?$' then
    raise exception 'Enter your company website, starting with https://.';
  end if;
  insert into forward_private.forward_employer_verification as v (manager_id, company, website)
  values (manager, company_name, p_website)
  on conflict (manager_id) do update
    set company = excluded.company, website = excluded.website, status = 'pending', requested_at = now()
    where lower(v.company) <> lower(excluded.company) or v.status <> 'approved';
end
$$;

create function forward_private.forward_role_is_current(p_manager uuid, p_company text, p_updated_at timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
  select p_updated_at >= now() - interval '30 days' and exists (
    select 1 from forward_private.forward_employer_verification v
    where v.manager_id = p_manager and v.status = 'approved' and lower(v.company) = lower(p_company)
  )
$$;

create function forward_private.forward_check_employer_publication()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not forward_private.forward_role_is_current(new.owner_id, new.profile->>'company', now()) then
    raise exception 'Forward must verify your employer before you can publish an opening.';
  end if;
  if tg_op = 'UPDATE' and lower(old.profile->>'roleTitle') <> lower(new.profile->>'roleTitle') then
    raise exception 'Close the existing role before publishing a different role.';
  end if;
  return new;
end
$$;
create trigger forward_require_verified_employer
  before insert or update on public.forward_hiring_publications
  for each row execute function forward_private.forward_check_employer_publication();

drop policy published_managers on public.forward_hiring_publications;
create policy published_managers on public.forward_hiring_publications for select to authenticated using (
  owner_id = (select auth.uid())
  or exists (select 1 from public.forward_shares s
    where s.manager_id = owner_id and s.applicant_id = (select auth.uid()))
  or ((select forward_private.forward_role()) is not null
    and forward_private.forward_role_is_current(owner_id, profile->>'company', updated_at))
);

create function public.forward_open_roles()
returns setof public.forward_hiring_publications
language sql stable security invoker set search_path='' as $$
  select * from public.forward_hiring_publications p
  where forward_private.forward_role_is_current(p.owner_id, p.profile->>'company', p.updated_at)
  order by p.updated_at desc limit 100
$$;

create or replace function forward_private.forward_share(p_manager_id uuid,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if forward_private.forward_role() is distinct from 'applicant' then raise exception 'An applicant account is required.'; end if;
  if not exists (select 1 from public.forward_applicant_publications where owner_id = auth.uid() and version = p_version)
    then raise exception 'Review and publish your profile before sharing.'; end if;
  perform 1 from public.forward_hiring_publications p
  where p.owner_id = p_manager_id
    and forward_private.forward_role_is_current(p.owner_id, p.profile->>'company', p.updated_at)
  for share;
  if not found then raise exception 'This role is closed or is awaiting confirmation from the employer.'; end if;
  insert into public.forward_shares(applicant_id,manager_id) values(auth.uid(),p_manager_id) on conflict do nothing;
end
$$;

create or replace function forward_private.forward_unpublish()
returns void language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  closed_profile jsonb;
begin
  if actor is null then raise exception 'Sign in first.'; end if;
  if forward_private.forward_role() = 'applicant' then
    delete from public.forward_shares where applicant_id = actor;
    delete from public.forward_applicant_publications where owner_id = actor;
    delete from forward_private.forward_applicant_preferences where owner_id = actor;
  elsif forward_private.forward_role() = 'hiring' then
    delete from public.forward_hiring_publications where owner_id = actor returning profile into closed_profile;
    if found then
      insert into public.forward_decline_feedback(applicant_id, kind, company, role_title)
      select applicant_id, 'role_closed', closed_profile->>'company', closed_profile->>'roleTitle'
      from public.forward_shares where manager_id = actor;
    end if;
  end if;
end
$$;

create function forward_private.forward_chat_starter(p_connection_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare
  match public.forward_connections;
  applicant jsonb;
  team jsonb;
begin
  if not forward_private.forward_can_message(p_connection_id) then
    return null;
  end if;
  select * into match from public.forward_connections where id = p_connection_id;
  select answers into applicant from forward_private.forward_applicant_preferences where owner_id = match.applicant_id;
  select profile->'answers' into team from public.forward_hiring_publications where owner_id = match.manager_id;
  if applicant->>'communication' <> team->>'communication'
    and applicant->>'communication' <> 'flexible' and team->>'communication' <> 'flexible' then
    return 'Which updates would you put in writing, and when would a quick conversation work better?';
  elsif applicant->>'checkIns' <> team->>'checkIns'
    and applicant->>'checkIns' <> 'flexible' and team->>'checkIns' <> 'flexible' then
    return 'How often would you check in so everyone feels supported and has time to focus?';
  elsif applicant->>'focus' <> team->>'focus'
    and applicant->>'focus' <> 'flexible' and team->>'focus' <> 'flexible' then
    return 'How could you protect time for focused work while staying available to each other?';
  elsif applicant->>'brainstorming' <> team->>'brainstorming'
    and applicant->>'brainstorming' <> 'flexible' and team->>'brainstorming' <> 'flexible' then
    return 'How could you make room for group brainstorming and ideas people develop on their own?';
  elsif applicant->>'rhythm' <> team->>'rhythm'
    and applicant->>'rhythm' <> 'flexible' and team->>'rhythm' <> 'flexible' then
    return 'When the pace of work picks up, how would you agree on priorities and ask for support?';
  elsif applicant->>'environment' <> team->>'environment'
    and applicant->>'environment' <> 'flexible' and team->>'environment' <> 'flexible' then
    return 'How would you stay connected and get support on days when you work in different places?';
  end if;
  return 'What helps each of you do your best work, and what would you agree on before starting?';
end
$$;

create function public.forward_chat_starter(p_connection_id uuid)
returns text language sql stable security invoker set search_path='' as $$
  select forward_private.forward_chat_starter(p_connection_id)
$$;
create function public.forward_employer_status()
returns table(company text, status text)
language sql stable security invoker set search_path='' as $$
  select * from forward_private.forward_employer_status()
$$;
create function public.forward_request_employer_verification(p_website text)
returns void language sql security invoker set search_path='' as $$
  select forward_private.forward_request_employer_verification(p_website)
$$;

revoke all on function public.forward_chat_starter(uuid), forward_private.forward_chat_starter(uuid),
  public.forward_employer_status(), forward_private.forward_employer_status(),
  public.forward_request_employer_verification(text), forward_private.forward_request_employer_verification(text),
  public.forward_open_roles(), forward_private.forward_role_is_current(uuid, text, timestamptz),
  forward_private.forward_check_employer_publication() from public, anon, authenticated;
grant execute on function public.forward_chat_starter(uuid), forward_private.forward_chat_starter(uuid),
  public.forward_employer_status(), forward_private.forward_employer_status(),
  public.forward_request_employer_verification(text), forward_private.forward_request_employer_verification(text),
  public.forward_open_roles(), forward_private.forward_role_is_current(uuid, text, timestamptz) to authenticated;

create function public.forward_decline_with_feedback(
  p_applicant_id uuid, p_reason text, p_next_step text
) returns void language sql security invoker set search_path='' as $$
  select forward_private.forward_decline_with_feedback(p_applicant_id, p_reason, p_next_step)
$$;

revoke all on function public.forward_decline_with_feedback(uuid, text, text),
  forward_private.forward_decline_with_feedback(uuid, text, text) from public, anon, authenticated;
grant execute on function public.forward_decline_with_feedback(uuid, text, text),
  forward_private.forward_decline_with_feedback(uuid, text, text) to authenticated;

-- Only an explicit decline with delivered feedback is visible to an applicant.
create or replace function forward_private.forward_connections()
returns table (id uuid, applicant_id uuid, manager_id uuid, applicant_ready boolean, manager_choice text, matched boolean)
language sql stable security definer set search_path='' as $$
  select c.id, c.applicant_id, c.manager_id,
    case when c.applicant_id = (select auth.uid()) then c.applicant_ready else false end,
    case when c.manager_id = (select auth.uid()) or (c.manager_choice = 'pass' and delivered.sent)
      then c.manager_choice end,
    c.applicant_ready and coalesce(c.manager_choice = 'interested', false)
  from public.forward_connections c
  cross join lateral (
    select exists (select 1 from public.forward_decline_feedback f where f.connection_id = c.id) as sent
  ) delivered
  where (c.applicant_id = (select auth.uid()) and (c.applicant_ready or (c.manager_choice = 'pass' and delivered.sent)))
    or (c.manager_id = (select auth.uid()) and c.manager_choice is not null)
$$;

-- Supabase creates this publication on hosted projects.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.forward_decline_feedback;
  end if;
end
$$;
