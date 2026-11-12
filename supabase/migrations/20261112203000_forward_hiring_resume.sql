create function forward_private.forward_check_hiring_resume() returns trigger
language plpgsql security definer set search_path='' as $$
declare resume uuid := nullif(new.document->>'resumeId','')::uuid;
begin
  if resume is null then return new; end if;
  perform id from public.forward_files
    where id=resume and owner_id=new.owner_id and kind='resume' for key share;
  if not found then raise exception 'That résumé does not belong to this account.'; end if;
  return new;
end
$$;
create trigger check_hiring_resume before insert or update on public.forward_hiring_drafts
  for each row execute function forward_private.forward_check_hiring_resume();

create or replace function forward_private.forward_keep_attached_file() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.forward_applicant_drafts where owner_id=old.owner_id and document->>'resumeId'=old.id::text)
    or exists(select 1 from public.forward_hiring_drafts where owner_id=old.owner_id and document->>'resumeId'=old.id::text)
  then raise exception 'Remove this document from your saved draft first.' using errcode='PT409'; end if;
  return old;
end
$$;

create function forward_private.forward_snapshot_hiring_background() returns trigger
language plpgsql security definer set search_path='' as $$
declare fields jsonb; field_name text; maximum integer; field_value text;
begin
  select document->'fields' into fields from public.forward_hiring_drafts where owner_id=new.owner_id;
  for field_name, maximum in
    values ('managerExperience',16000),('managerEducation',6000),('managerSkills',600),('managerCredentials',6000)
  loop
    if fields->field_name is null then continue; end if;
    if jsonb_typeof(fields->field_name) is distinct from 'string' then raise exception 'Invalid professional background field.'; end if;
    field_value := btrim(fields->>field_name);
    if length(field_value)>maximum then raise exception 'Shorten this professional background field: %.',field_name; end if;
    if field_value<>'' then new.profile := new.profile || jsonb_build_object(field_name,field_value); end if;
  end loop;
  return new;
end
$$;
create trigger snapshot_hiring_background before insert or update on public.forward_hiring_publications
  for each row execute function forward_private.forward_snapshot_hiring_background();

revoke all on function forward_private.forward_check_hiring_resume(),
  forward_private.forward_snapshot_hiring_background() from public,anon,authenticated;
