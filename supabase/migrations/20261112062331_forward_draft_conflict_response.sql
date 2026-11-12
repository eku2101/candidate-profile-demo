-- A stale save is an application conflict, not a retryable serialization failure.
create or replace function forward_private.forward_save_draft(p_document jsonb,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_role text:=forward_private.forward_role(); result jsonb; file_id uuid;
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
  if result is null then raise exception 'Your profile changed on another device. Reload the saved version before saving again.' using errcode='PT409'; end if;
  return result;
end $$;
