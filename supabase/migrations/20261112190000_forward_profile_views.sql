create table forward_private.forward_profile_views (
  profile_id uuid not null references public.forward_accounts(user_id) on delete cascade,
  viewer_id uuid not null references public.forward_accounts(user_id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (profile_id, viewer_id),
  check (profile_id <> viewer_id)
);
create index forward_profile_views_recent on forward_private.forward_profile_views(profile_id, viewed_at desc);
create index forward_profile_views_viewer on forward_private.forward_profile_views(viewer_id);
alter table forward_private.forward_profile_views enable row level security;
revoke all on forward_private.forward_profile_views from public, anon, authenticated;

create function forward_private.forward_record_profile_view(p_profile_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  viewer uuid := auth.uid();
  viewer_role text := forward_private.forward_role();
begin
  if p_profile_id = viewer then return; end if;
  if (viewer_role = 'applicant' and exists (
    select 1 from public.forward_hiring_publications where owner_id = p_profile_id
  )) or (viewer_role = 'hiring' and exists (
    select 1 from public.forward_applicant_publications p
    join public.forward_shares s on s.applicant_id = p.owner_id
    where p.owner_id = p_profile_id and s.manager_id = viewer
  )) then
    insert into forward_private.forward_profile_views as v (profile_id, viewer_id)
      values (p_profile_id, viewer)
      on conflict (profile_id, viewer_id) do update set viewed_at = greatest(v.viewed_at, excluded.viewed_at);
  end if;
end
$$;

create function forward_private.forward_profile_viewers()
returns table (viewer_name text, viewer_role text, viewed_at timestamptz)
language sql stable security definer set search_path='' as $$
  select coalesce(h.profile->>'managerName', a.profile->>'name'), viewer.role, v.viewed_at
  from forward_private.forward_profile_views v
  join public.forward_accounts viewer on viewer.user_id = v.viewer_id
  left join public.forward_hiring_publications h on h.owner_id = v.viewer_id
  left join public.forward_shares s on s.applicant_id = v.viewer_id and s.manager_id = v.profile_id
  left join public.forward_applicant_publications a on a.owner_id = s.applicant_id
  where v.profile_id = (select auth.uid())
  order by v.viewed_at desc, v.viewer_id
  limit 100
$$;

create function public.forward_record_profile_view(p_profile_id uuid)
returns void language sql security invoker set search_path='' as $$
  select forward_private.forward_record_profile_view(p_profile_id)
$$;

create function public.forward_profile_viewers()
returns table (viewer_name text, viewer_role text, viewed_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select * from forward_private.forward_profile_viewers()
$$;

revoke all on function public.forward_record_profile_view(uuid), public.forward_profile_viewers(),
  forward_private.forward_record_profile_view(uuid), forward_private.forward_profile_viewers()
  from public, anon, authenticated;
grant execute on function public.forward_record_profile_view(uuid), public.forward_profile_viewers(),
  forward_private.forward_record_profile_view(uuid), forward_private.forward_profile_viewers()
  to authenticated;
