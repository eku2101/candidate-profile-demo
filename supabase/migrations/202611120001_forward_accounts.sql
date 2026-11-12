-- Private-by-default Forward accounts. No policies use user-editable auth metadata.
create table public.forward_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('applicant','hiring')),
  created_at timestamptz not null default now()
);
create table public.forward_files (
  id uuid primary key,
  owner_id uuid not null references public.forward_accounts(user_id) on delete cascade,
  path text unique not null,
  name text not null check (length(name) between 1 and 180),
  mime text not null check (mime in ('application/pdf','image/jpeg','image/png','image/webp')),
  size integer not null check (size between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (path=owner_id::text || '/' || id::text)
);
create table public.forward_applicant_drafts (
  owner_id uuid primary key references public.forward_accounts(user_id) on delete cascade,
  document jsonb not null default '{}',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(document)='object' and octet_length(document::text)<=400000)
);
create table public.forward_hiring_drafts (
  owner_id uuid primary key references public.forward_accounts(user_id) on delete cascade,
  document jsonb not null default '{}',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(document)='object' and octet_length(document::text)<=40000)
);
create table public.forward_hiring_publications (
  owner_id uuid primary key references public.forward_accounts(user_id) on delete cascade,
  profile jsonb not null,
  version integer not null,
  updated_at timestamptz not null default now()
);
create table public.forward_applicant_publications (
  owner_id uuid primary key references public.forward_accounts(user_id) on delete cascade,
  profile jsonb not null,
  resume_id uuid references public.forward_files(id) on delete restrict,
  version integer not null,
  updated_at timestamptz not null default now()
);
create table public.forward_shares (
  applicant_id uuid not null references public.forward_accounts(user_id) on delete cascade,
  manager_id uuid not null references public.forward_accounts(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(applicant_id,manager_id),
  check (applicant_id<>manager_id)
);
create table public.forward_applicant_preferences (
  owner_id uuid primary key references public.forward_accounts(user_id) on delete cascade,
  answers jsonb not null
);
create index forward_shares_manager on public.forward_shares(manager_id);
create index forward_files_owner on public.forward_files(owner_id);

alter table public.forward_accounts enable row level security;
alter table public.forward_files enable row level security;
alter table public.forward_applicant_drafts enable row level security;
alter table public.forward_hiring_drafts enable row level security;
alter table public.forward_hiring_publications enable row level security;
alter table public.forward_applicant_publications enable row level security;
alter table public.forward_shares enable row level security;
alter table public.forward_applicant_preferences enable row level security;
revoke all on public.forward_applicant_preferences from public,anon,authenticated;
grant all on public.forward_applicant_preferences to service_role;

create function public.forward_role() returns text language sql stable security definer set search_path='' as $$
  select role from public.forward_accounts where user_id=(select auth.uid())
$$;
create policy own_account on public.forward_accounts for select to authenticated using (user_id=(select auth.uid()));
create policy own_applicant_draft on public.forward_applicant_drafts for select to authenticated using (owner_id=(select auth.uid()));
create policy own_hiring_draft on public.forward_hiring_drafts for select to authenticated using (owner_id=(select auth.uid()));
create policy published_managers on public.forward_hiring_publications for select to authenticated using ((select public.forward_role()) is not null);
create policy own_or_received_share on public.forward_shares for select to authenticated using (applicant_id=(select auth.uid()) or manager_id=(select auth.uid()));
create policy chosen_managers_only on public.forward_applicant_publications for select to authenticated using (
  owner_id=(select auth.uid()) or ((select public.forward_role())='hiring' and exists (
    select 1 from public.forward_shares s where s.applicant_id=owner_id and s.manager_id=(select auth.uid())
  ))
);
create policy own_or_shared_file_metadata on public.forward_files for select to authenticated using (
  owner_id=(select auth.uid()) or exists (
    select 1 from public.forward_applicant_publications p where p.resume_id=id and p.owner_id=forward_files.owner_id
  )
);
-- No browser writes to these tables. Validated functions are the only write boundary.
revoke all on public.forward_accounts,public.forward_files,public.forward_applicant_drafts,public.forward_hiring_drafts,
  public.forward_hiring_publications,public.forward_applicant_publications,public.forward_shares from anon,authenticated;
grant select on public.forward_accounts,public.forward_files,public.forward_applicant_drafts,public.forward_hiring_drafts,
  public.forward_hiring_publications,public.forward_applicant_publications,public.forward_shares to authenticated;
grant all on public.forward_accounts,public.forward_files,public.forward_applicant_drafts,public.forward_hiring_drafts,
  public.forward_hiring_publications,public.forward_applicant_publications,public.forward_shares to service_role;

create function public.forward_register(p_role text) returns public.forward_accounts language plpgsql security definer set search_path='' as $$
declare result public.forward_accounts;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Confirm your email before creating a Forward profile.';
  end if;
  if p_role not in ('applicant','hiring') or p_role is null then raise exception 'Choose applicant or hiring manager.'; end if;
  insert into public.forward_accounts(user_id,role) values(auth.uid(),p_role) on conflict(user_id) do nothing;
  select * into result from public.forward_accounts where user_id=auth.uid();
  if result.role<>p_role then raise exception 'This account already has a different role.'; end if;
  return result;
end $$;

create function public.forward_save_draft(p_document jsonb,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_role text:=public.forward_role(); result jsonb; file_id uuid;
begin
  if account_role is null then raise exception 'Sign in and choose your account role first.'; end if;
  if p_version is null or p_version<0 or jsonb_typeof(p_document)<>'object' or p_document is null then raise exception 'Invalid draft.'; end if;
  if account_role='applicant' then
    file_id:=nullif(p_document->>'resumeId','')::uuid;
    if file_id is not null then
      perform id from public.forward_files where id=file_id and owner_id=auth.uid() for key share;
      if not found then raise exception 'That résumé does not belong to this account.'; end if;
    end if;
    if p_version=0 then
      insert into public.forward_applicant_drafts(owner_id,document) values(auth.uid(),p_document) on conflict do nothing returning to_jsonb(forward_applicant_drafts.*) into result;
    else
      update public.forward_applicant_drafts set document=p_document,version=version+1,updated_at=now() where owner_id=auth.uid() and version=p_version returning to_jsonb(forward_applicant_drafts.*) into result;
    end if;
  else
    if p_version=0 then
      insert into public.forward_hiring_drafts(owner_id,document) values(auth.uid(),p_document) on conflict do nothing returning to_jsonb(forward_hiring_drafts.*) into result;
    else
      update public.forward_hiring_drafts set document=p_document,version=version+1,updated_at=now() where owner_id=auth.uid() and version=p_version returning to_jsonb(forward_hiring_drafts.*) into result;
    end if;
  end if;
  if result is null then raise exception 'Your profile changed on another device. Reload the saved version before saving again.' using errcode='40001'; end if;
  return result;
end $$;

create function public.forward_keep_attached_file() returns trigger language plpgsql security definer set search_path='' as $$
declare attached text;
begin
  select document->>'resumeId' into attached from public.forward_applicant_drafts where owner_id=old.owner_id for update;
  if attached=old.id::text then raise exception 'Remove this document from your saved draft first.'; end if;
  return old;
end $$;
create trigger keep_attached_resume before delete on public.forward_files for each row execute function public.forward_keep_attached_file();
revoke all on function public.forward_keep_attached_file() from public,anon,authenticated;

create function public.forward_words(value text) returns integer language sql immutable set search_path='' as $$
  select case when btrim(coalesce(value,''))='' then 0 else cardinality(regexp_split_to_array(btrim(value),'\s+')) end
$$;
create function public.forward_answers_valid(value jsonb,include_experience boolean default false) returns boolean language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(value)='object'
    and value->>'focus' in ('protected','open','flexible')
    and value->>'brainstorming' in ('frequent','occasional','flexible')
    and value->>'communication' in ('written','live','flexible')
    and value->>'checkIns' in ('frequent','milestones','flexible')
    and value->>'rhythm' in ('steady','fast','flexible')
    and value->>'environment' in ('enterprise','mid','small','startup','remote')
    and (not include_experience or value->>'experience' in ('entry','mid','senior','lead')),false)
$$;

create function public.forward_publish_applicant(p_version integer) returns public.forward_applicant_publications language plpgsql security definer set search_path='' as $$
declare draft public.forward_applicant_drafts; fields jsonb; snapshot jsonb:='{}'; highlights jsonb:='[]'; item jsonb; key text; text_value text; limit_value integer; result public.forward_applicant_publications; file_id uuid;
begin
  if public.forward_role() is distinct from 'applicant' then raise exception 'An applicant account is required.'; end if;
  select * into draft from public.forward_applicant_drafts where owner_id=auth.uid() for update;
  if draft.owner_id is null or draft.version is distinct from p_version then raise exception 'Save and review your latest profile first.'; end if;
  fields:=draft.document->'fields';
  if not public.forward_answers_valid(draft.document->'preferences') then raise exception 'Complete all six work-preference questions.'; end if;
  foreach key in array array['name','role','location','skills','summary','experience','education','credentials','mission','values','wellbeing','support','community'] loop
    if jsonb_typeof(fields->key) is distinct from 'string' then raise exception 'Invalid profile field: %',key; end if;
    text_value:=btrim(fields->>key);
    if key in ('name','role','summary') and text_value='' then raise exception 'Add your name, role title, and introduction.'; end if;
    limit_value:=case key when 'name' then 100 when 'role' then 80 when 'location' then 120 when 'skills' then 600 when 'experience' then 30000 when 'education' then 10000 when 'credentials' then 10000 else 10000 end;
    if length(text_value)>limit_value then raise exception 'Shorten your % field.',key; end if;
    limit_value:=case key when 'summary' then 100 when 'mission' then 50 when 'values' then 50 when 'wellbeing' then 75 when 'support' then 75 when 'community' then 75 else null end;
    if limit_value is not null and public.forward_words(text_value)>limit_value then raise exception 'Your % exceeds its word limit.',key; end if;
    snapshot:=snapshot||jsonb_build_object(key,text_value);
  end loop;
  if (select count(*) from regexp_split_to_table(fields->>'skills',',') x where btrim(x)<>'')>10 then raise exception 'Choose up to 10 core skills.'; end if;
  if jsonb_typeof(draft.document->'featuredRoles') is distinct from 'array' or jsonb_array_length(draft.document->'featuredRoles')>3 then raise exception 'Choose up to three featured roles.'; end if;
  for item in select * from jsonb_array_elements(draft.document->'featuredRoles') loop
    if jsonb_typeof(item->'title') is distinct from 'string' or jsonb_typeof(item->'dates') is distinct from 'string' or jsonb_typeof(item->'summary') is distinct from 'string' then raise exception 'Invalid featured role.'; end if;
    if length(item->>'title')>160 or length(item->>'dates')>80 or public.forward_words(item->>'summary')>100 then raise exception 'Shorten your featured role.'; end if;
    if btrim(item->>'title')='' and (btrim(item->>'dates')<>'' or btrim(item->>'summary')<>'') then raise exception 'Add a title to your featured role.'; end if;
    highlights:=highlights||jsonb_build_array(jsonb_build_object('title',item->>'title','dates',item->>'dates','summary',item->>'summary'));
  end loop;
  file_id:=nullif(draft.document->>'resumeId','')::uuid;
  if file_id is not null and not exists(select 1 from public.forward_files where id=file_id and owner_id=auth.uid()) then raise exception 'That résumé is unavailable.'; end if;
  insert into public.forward_applicant_publications(owner_id,profile,resume_id,version) values(auth.uid(),snapshot||jsonb_build_object('featuredRoles',highlights),file_id,draft.version)
    on conflict(owner_id) do update set profile=excluded.profile,resume_id=excluded.resume_id,version=excluded.version,updated_at=now() returning * into result;
  insert into public.forward_applicant_preferences(owner_id,answers) values(auth.uid(),draft.document->'preferences')
    on conflict(owner_id) do update set answers=excluded.answers;
  return result;
end $$;

create function public.forward_publish_hiring(p_version integer) returns public.forward_hiring_publications language plpgsql security definer set search_path='' as $$
declare draft public.forward_hiring_drafts; fields jsonb; snapshot jsonb:='{}'; answers jsonb:='{}'; key text; text_value text; limit_value integer; result public.forward_hiring_publications;
begin
  if public.forward_role() is distinct from 'hiring' then raise exception 'A hiring account is required.'; end if;
  select * into draft from public.forward_hiring_drafts where owner_id=auth.uid() for update;
  if draft.owner_id is null or draft.version is distinct from p_version then raise exception 'Save and review your latest profile first.'; end if;
  fields:=draft.document->'fields';
  if not public.forward_answers_valid(draft.document->'answers',true) then raise exception 'Complete your team questionnaire.'; end if;
  foreach key in array array['managerName','managerTitle','company','location','managerBio','teamStory','roleTitle','employmentType','roleSummary'] loop
    if jsonb_typeof(fields->key) is distinct from 'string' then raise exception 'Invalid hiring profile field: %',key; end if;
    text_value:=btrim(fields->>key);
    if key in ('managerName','company','managerBio','roleTitle','roleSummary') and text_value='' then raise exception 'Complete the required manager and role details.'; end if;
    limit_value:=case key when 'location' then 100 when 'employmentType' then 60 when 'managerBio' then 10000 when 'teamStory' then 10000 when 'roleSummary' then 10000 else 80 end;
    if length(text_value)>limit_value then raise exception 'Shorten your % field.',key; end if;
    limit_value:=case key when 'managerBio' then 75 when 'teamStory' then 100 when 'roleSummary' then 100 else null end;
    if limit_value is not null and public.forward_words(text_value)>limit_value then raise exception 'Your % exceeds its word limit.',key; end if;
    snapshot:=snapshot||jsonb_build_object(key,text_value);
  end loop;
  foreach key in array array['focus','brainstorming','communication','checkIns','rhythm','environment','experience'] loop
    answers:=answers||jsonb_build_object(key,draft.document->'answers'->>key);
  end loop;
  insert into public.forward_hiring_publications(owner_id,profile,version) values(auth.uid(),snapshot||jsonb_build_object('answers',answers),draft.version)
    on conflict(owner_id) do update set profile=excluded.profile,version=excluded.version,updated_at=now() returning * into result;
  return result;
end $$;

create function public.forward_share(p_manager_id uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
  if public.forward_role() is distinct from 'applicant' then raise exception 'An applicant account is required.'; end if;
  if not exists(select 1 from public.forward_applicant_publications where owner_id=auth.uid() and version=p_version) then raise exception 'Review and publish your profile before sharing.'; end if;
  if not exists(select 1 from public.forward_hiring_publications p join public.forward_accounts a on a.user_id=p.owner_id where p.owner_id=p_manager_id and a.role='hiring') then raise exception 'This manager no longer has a published profile.'; end if;
  insert into public.forward_shares(applicant_id,manager_id) values(auth.uid(),p_manager_id) on conflict do nothing;
end $$;
create function public.forward_withdraw(p_manager_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  delete from public.forward_shares where applicant_id=auth.uid() and manager_id=p_manager_id;
end $$;
create function public.forward_unpublish() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if public.forward_role()='applicant' then
    delete from public.forward_shares where applicant_id=auth.uid();
    delete from public.forward_applicant_publications where owner_id=auth.uid();
    delete from public.forward_applicant_preferences where owner_id=auth.uid();
  else
    delete from public.forward_hiring_publications where owner_id=auth.uid();
  end if;
end $$;

create function public.forward_conversation_prompts(p_applicant_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare applicant jsonb; team jsonb; key text; question text; result jsonb:='[]';
begin
  if public.forward_role() is distinct from 'hiring' or not exists(select 1 from public.forward_shares where applicant_id=p_applicant_id and manager_id=auth.uid())
    or not exists(select 1 from public.forward_applicant_publications where owner_id=p_applicant_id) then raise exception 'This profile is not shared with you.'; end if;
  select answers into applicant from public.forward_applicant_preferences where owner_id=p_applicant_id;
  select profile->'answers' into team from public.forward_hiring_publications where owner_id=auth.uid();
  foreach key in array array['focus','brainstorming','communication','checkIns','rhythm','environment'] loop
    if applicant->>key<>team->>key and applicant->>key<>'flexible' and team->>key<>'flexible' then
      question:=case key
        when 'focus' then 'How could your team protect this person’s focus while keeping support available?'
        when 'brainstorming' then 'Could you offer both group brainstorming and time to contribute ideas independently?'
        when 'communication' then 'Which updates could be written, and when would a live conversation help both sides?'
        when 'checkIns' then 'What check-in agreement would provide support without unnecessary interruptions?'
        when 'rhythm' then 'How would you agree on priorities and support when the pace of work changes?'
        when 'environment' then 'What support or flexibility could help this person work well in your team’s setting?' end;
      result:=result||jsonb_build_array(jsonb_build_object('topic',key,'question',question));
    end if;
  end loop;
  return result;
end $$;
revoke all on function public.forward_conversation_prompts(uuid) from public,anon;
grant execute on function public.forward_conversation_prompts(uuid) to authenticated;

revoke all on function public.forward_role(),public.forward_register(text),public.forward_save_draft(jsonb,integer),
 public.forward_words(text),public.forward_answers_valid(jsonb,boolean),public.forward_publish_applicant(integer),
 public.forward_publish_hiring(integer),public.forward_share(uuid,integer),public.forward_withdraw(uuid),public.forward_unpublish() from public,anon;
grant execute on function public.forward_role(),public.forward_register(text),public.forward_save_draft(jsonb,integer),
 public.forward_publish_applicant(integer),public.forward_publish_hiring(integer),public.forward_share(uuid,integer),public.forward_withdraw(uuid),public.forward_unpublish() to authenticated;

-- The authenticated Edge Function brokers file operations; no browser Storage policies.
-- A manager cannot mint a long-lived signed URL that would outlive withdrawal.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('forward-resumes','forward-resumes',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
