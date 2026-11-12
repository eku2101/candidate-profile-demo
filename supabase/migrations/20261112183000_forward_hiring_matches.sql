create table public.forward_connections (
  id uuid not null unique default gen_random_uuid(),
  applicant_id uuid not null,
  manager_id uuid not null,
  applicant_ready boolean not null default false,
  manager_choice text check (manager_choice in ('interested', 'pass')),
  primary key (applicant_id, manager_id),
  foreign key (applicant_id, manager_id)
    references public.forward_shares(applicant_id, manager_id) on delete cascade
);
create index forward_connections_manager on public.forward_connections(manager_id);

create table public.forward_messages (
  id bigint generated always as identity primary key,
  connection_id uuid not null references public.forward_connections(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.forward_accounts(user_id) on delete cascade,
  body text not null check (length(body) <= 2000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);
create index forward_messages_connection on public.forward_messages(connection_id, id);
create index forward_messages_sender on public.forward_messages(sender_id);

alter table public.forward_connections enable row level security;
alter table public.forward_messages enable row level security;
revoke all on public.forward_connections, public.forward_messages from public, anon, authenticated;
grant select on public.forward_messages to authenticated;
grant insert (connection_id, body) on public.forward_messages to authenticated;

-- Only the match is visible to both sides. An applicant cannot see a manager's
-- pass or pending interest, and a manager cannot see a pending chat opt-in.
create function forward_private.forward_connections()
returns table (id uuid, applicant_id uuid, manager_id uuid, applicant_ready boolean, manager_choice text, matched boolean)
language sql stable security definer set search_path='' as $$
  select c.id, c.applicant_id, c.manager_id,
    case when c.applicant_id = (select auth.uid()) then c.applicant_ready else false end,
    case when c.manager_id = (select auth.uid()) then c.manager_choice end,
    c.applicant_ready and coalesce(c.manager_choice = 'interested', false)
  from public.forward_connections c
  where c.applicant_id = (select auth.uid()) and c.applicant_ready
     or c.manager_id = (select auth.uid()) and c.manager_choice is not null
$$;

create function forward_private.forward_choose_connection(p_other_id uuid, p_choice text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  actor_role text := forward_private.forward_role();
  applicant uuid;
  manager uuid;
  matched boolean;
begin
  if actor_role = 'applicant' and p_choice = 'open-chat' then
    applicant := actor;
    manager := p_other_id;
  elsif actor_role = 'hiring' and p_choice in ('interested', 'pass') then
    applicant := p_other_id;
    manager := actor;
  else
    raise exception 'This choice is unavailable for your account.';
  end if;

  perform 1 from public.forward_shares
    where applicant_id = applicant and manager_id = manager for key share;
  if not found then
    raise exception 'This profile is no longer shared.';
  end if;

  insert into public.forward_connections as c (applicant_id, manager_id, applicant_ready, manager_choice)
  values (applicant, manager, actor_role = 'applicant', case when actor_role = 'hiring' then p_choice end)
  on conflict (applicant_id, manager_id) do update
    set applicant_ready = c.applicant_ready or excluded.applicant_ready,
        manager_choice = coalesce(excluded.manager_choice, c.manager_choice)
    where p_choice <> 'pass' or not (c.applicant_ready and coalesce(c.manager_choice = 'interested', false))
  returning c.applicant_ready and coalesce(c.manager_choice = 'interested', false) into matched;

  if not found then
    raise exception 'You already matched. Open Messages to continue.';
  end if;
  return matched;
end
$$;

create function forward_private.forward_can_message(p_connection_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.forward_connections c
    where c.id = p_connection_id and c.applicant_ready and c.manager_choice = 'interested'
      and (c.applicant_id = (select auth.uid()) or c.manager_id = (select auth.uid()))
  )
$$;

create policy matched_participants_read on public.forward_messages
  for select to authenticated using (forward_private.forward_can_message(connection_id));
create policy matched_participants_send on public.forward_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and forward_private.forward_can_message(connection_id)
  );

create function public.forward_connections()
returns table (id uuid, applicant_id uuid, manager_id uuid, applicant_ready boolean, manager_choice text, matched boolean)
language sql stable security invoker set search_path='' as $$
  select * from forward_private.forward_connections()
$$;

create function public.forward_choose_connection(p_other_id uuid, p_choice text)
returns boolean language sql security invoker set search_path='' as $$
  select forward_private.forward_choose_connection(p_other_id, p_choice)
$$;

revoke all on function public.forward_connections(), public.forward_choose_connection(uuid, text),
  forward_private.forward_connections(), forward_private.forward_choose_connection(uuid, text),
  forward_private.forward_can_message(uuid) from public, anon, authenticated;
grant execute on function public.forward_connections(), public.forward_choose_connection(uuid, text),
  forward_private.forward_connections(), forward_private.forward_choose_connection(uuid, text),
  forward_private.forward_can_message(uuid) to authenticated;
