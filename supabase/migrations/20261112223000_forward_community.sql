create table public.forward_community_posts (
  id uuid primary key,
  author_id uuid not null default auth.uid() references public.forward_accounts(user_id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  caption text not null check (char_length(btrim(caption)) between 1 and 1200),
  extensions text[] not null check (
    cardinality(extensions) between 1 and 5 and array_ndims(extensions) = 1
    and array_lower(extensions,1) = 1 and array_position(extensions,null) is null
    and extensions <@ array['jpg','png','webp','mp4','webm']
  ),
  descriptions text[] not null check (
    cardinality(descriptions) = cardinality(extensions) and array_ndims(descriptions) = 1
    and array_lower(descriptions,1) = 1 and array_position(descriptions,null) is null
    and char_length(array_to_string(descriptions,'')) <= 1000
  ),
  published_at timestamptz
);

create index forward_community_posts_author on public.forward_community_posts(author_id);
create index forward_community_posts_recent on public.forward_community_posts(published_at desc,id desc)
  where published_at is not null;

alter table public.forward_community_posts enable row level security;
revoke all on public.forward_community_posts from public, anon, authenticated;
grant select, delete on public.forward_community_posts to authenticated;
grant insert (id,author_name,caption,extensions,descriptions) on public.forward_community_posts to authenticated;

create policy forward_community_member_read on public.forward_community_posts
  for select to authenticated using (
    author_id = (select auth.uid()) or (published_at is not null and (select forward_private.forward_role()) is not null)
  );
create policy forward_community_own_draft on public.forward_community_posts
  for insert to authenticated with check (author_id = (select auth.uid()) and published_at is null);
create policy forward_community_own_delete on public.forward_community_posts
  for delete to authenticated using (author_id = (select auth.uid()));

create function forward_private.forward_limit_community_posts()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.forward_accounts where user_id = new.author_id for update;
  if (select count(*) from public.forward_community_posts where author_id = new.author_id) >= 12 then
    raise exception 'You can have up to 12 community posts. Remove an older post before adding another.';
  end if;
  return new;
end
$$;
create trigger forward_limit_community_posts before insert on public.forward_community_posts
  for each row execute function forward_private.forward_limit_community_posts();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('forward-community','forward-community',false,6291456,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);

create function forward_private.forward_community_asset(p_path text, p_draft boolean)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists (
    select 1 from public.forward_community_posts post
    cross join lateral unnest(post.extensions) with ordinality media(extension,position)
    where post.id = case when split_part(p_path,'/',2) ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
      then split_part(p_path,'/',2)::uuid end
      and p_path = post.author_id::text || '/' || post.id::text || '/' || media.position || '.' || media.extension
      and case when p_draft then post.author_id = (select auth.uid()) and post.published_at is null
        else post.published_at is not null end
  )
$$;

create policy forward_community_media_read on storage.objects
  for select to authenticated using (
    bucket_id = 'forward-community' and (
      split_part(name,'/',1) = (select auth.uid())::text or forward_private.forward_community_asset(name,false)
    )
  );
create policy forward_community_media_upload on storage.objects
  for insert to authenticated with check (
    bucket_id = 'forward-community' and forward_private.forward_community_asset(name,true)
  );
create policy forward_community_media_remove on storage.objects
  for delete to authenticated using (
    bucket_id = 'forward-community' and split_part(name,'/',1) = (select auth.uid())::text
    and not forward_private.forward_community_asset(name,false)
  );

create function forward_private.forward_publish_community_post(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  post public.forward_community_posts;
begin
  select * into post from public.forward_community_posts
    where id = p_id and author_id = (select auth.uid()) for update;
  if not found then raise exception 'This community draft is no longer available.'; end if;
  if post.published_at is not null then return; end if;
  if exists (
    select 1 from unnest(post.extensions) with ordinality media(extension,position)
    where not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'forward-community'
        and object.name = post.author_id::text || '/' || post.id::text || '/' || media.position || '.' || media.extension
    )
  ) then
    raise exception 'Wait for every photo and video to finish uploading before publishing.';
  end if;
  update public.forward_community_posts set published_at = now() where id = post.id;
end
$$;

create function public.forward_publish_community_post(p_id uuid)
returns void language sql security invoker set search_path='' as $$
  select forward_private.forward_publish_community_post(p_id)
$$;

revoke all on function forward_private.forward_limit_community_posts(),
  forward_private.forward_community_asset(text,boolean), forward_private.forward_publish_community_post(uuid),
  public.forward_publish_community_post(uuid) from public, anon, authenticated;
grant execute on function forward_private.forward_community_asset(text,boolean),
  forward_private.forward_publish_community_post(uuid), public.forward_publish_community_post(uuid) to authenticated;
