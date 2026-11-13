create table forward_private.forward_job_usage (
  day date not null,
  scope text not null,
  requests integer not null,
  primary key(day,scope)
);
alter table forward_private.forward_job_usage enable row level security;
revoke all on forward_private.forward_job_usage from public,anon,authenticated;
grant select,insert,update,delete on forward_private.forward_job_usage to service_role;

create function public.forward_take_job_request(p_user_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare today date := (now() at time zone 'UTC')::date;
begin
  if p_user_id is null then raise exception 'A user is required.'; end if;
  insert into forward_private.forward_job_usage as usage (day,scope,requests)
  values(today,'all',1)
  on conflict(day,scope) do update set requests=usage.requests+1 where usage.requests<200;
  if not found then raise exception 'Daily job search limit reached.' using errcode='PT429'; end if;
  insert into forward_private.forward_job_usage as usage (day,scope,requests)
  values(today,p_user_id::text,1)
  on conflict(day,scope) do update set requests=usage.requests+1 where usage.requests<20;
  if not found then raise exception 'Daily account job search limit reached.' using errcode='PT429'; end if;
  delete from forward_private.forward_job_usage where day<today-7;
end
$$;
revoke all on function public.forward_take_job_request(uuid) from public,anon,authenticated;
grant execute on function public.forward_take_job_request(uuid) to service_role;
