alter table public.forward_files add column kind text not null default 'resume'
  check (kind in ('resume', 'portrait', 'showcase'));
alter table public.forward_files add constraint forward_photo_format
  check (kind = 'resume' or (mime = 'image/jpeg' and size <= 2097152));

create function forward_private.forward_check_images() returns trigger
language plpgsql security definer set search_path='' as $$
declare images jsonb := new.document->'images'; slot text; photo_id uuid;
begin
  if exists (
    select 1 from public.forward_files where id=nullif(new.document->>'resumeId','')::uuid and kind<>'resume'
  ) then raise exception 'Choose a résumé document for your résumé.'; end if;
  if images is null then return new; end if;
  if jsonb_typeof(images) is distinct from 'object' then raise exception 'Invalid profile images.'; end if;
  if images - 'portrait' - 'showcase' <> '{}'::jsonb then raise exception 'Invalid profile image slot.'; end if;
  foreach slot in array array['portrait','showcase'] loop
    photo_id := (images->>slot)::uuid;
    if photo_id is not null then
      perform id from public.forward_files where id=photo_id and owner_id=new.owner_id and kind=slot for key share;
      if not found then raise exception 'This profile image does not belong to this account.'; end if;
    end if;
  end loop;
  return new;
end
$$;
create trigger check_applicant_images before insert or update on public.forward_applicant_drafts
  for each row execute function forward_private.forward_check_images();
create trigger check_hiring_images before insert or update on public.forward_hiring_drafts
  for each row execute function forward_private.forward_check_images();

create function forward_private.forward_snapshot_images() returns trigger
language plpgsql security definer set search_path='' as $$
declare images jsonb; slot text; photo_id uuid;
begin
  if tg_table_name='forward_applicant_publications' then
    select document->'images' into images from public.forward_applicant_drafts where owner_id=new.owner_id;
  else
    select document->'images' into images from public.forward_hiring_drafts where owner_id=new.owner_id;
  end if;
  if images is null then return new; end if;
  foreach slot in array array['portrait','showcase'] loop
    photo_id := (images->>slot)::uuid;
    if photo_id is not null then
      perform id from public.forward_files where id=photo_id and owner_id=new.owner_id and kind=slot for key share;
      if not found then raise exception 'A profile image is unavailable. Update your draft and try again.'; end if;
    end if;
  end loop;
  new.profile := new.profile || jsonb_build_object('images', images);
  return new;
end
$$;
create trigger snapshot_applicant_images before insert or update on public.forward_applicant_publications
  for each row execute function forward_private.forward_snapshot_images();
create trigger snapshot_hiring_images before insert or update on public.forward_hiring_publications
  for each row execute function forward_private.forward_snapshot_images();

create function forward_private.forward_keep_profile_images() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.kind='resume' then return old; end if;
  if exists(select 1 from public.forward_applicant_drafts where owner_id=old.owner_id and document->'images'->>old.kind=old.id::text)
    or exists(select 1 from public.forward_hiring_drafts where owner_id=old.owner_id and document->'images'->>old.kind=old.id::text)
    or exists(select 1 from public.forward_applicant_publications where owner_id=old.owner_id and profile->'images'->>old.kind=old.id::text)
    or exists(select 1 from public.forward_hiring_publications where owner_id=old.owner_id and profile->'images'->>old.kind=old.id::text)
  then raise exception 'Remove this image from your saved draft and shared profile first.' using errcode='PT409'; end if;
  return old;
end
$$;
create trigger keep_profile_images before delete on public.forward_files
  for each row execute function forward_private.forward_keep_profile_images();

create policy published_profile_images on public.forward_files for select to authenticated using (
  kind in ('portrait','showcase') and (
    exists(select 1 from public.forward_applicant_publications p
      where p.owner_id=forward_files.owner_id and p.profile->'images'->>forward_files.kind=forward_files.id::text)
    or exists(select 1 from public.forward_hiring_publications p
      where p.owner_id=forward_files.owner_id and p.profile->'images'->>forward_files.kind=forward_files.id::text)
  )
);
revoke all on function forward_private.forward_check_images(), forward_private.forward_snapshot_images(),
  forward_private.forward_keep_profile_images() from public,anon,authenticated;
