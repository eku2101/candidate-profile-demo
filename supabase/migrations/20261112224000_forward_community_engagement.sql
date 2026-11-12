create table public.forward_community_likes (
  post_id uuid not null references public.forward_community_posts(id) on delete cascade,
  member_id uuid not null default auth.uid() references public.forward_accounts(user_id) on delete cascade,
  primary key (post_id,member_id)
);
create index forward_community_likes_member on public.forward_community_likes(member_id);

create table public.forward_community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forward_community_posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.forward_accounts(user_id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80 and author_name ~ '[^[:space:]]'),
  body text not null check (char_length(btrim(body)) between 1 and 1000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);
create index forward_community_comments_post on public.forward_community_comments(post_id,created_at desc,id desc);
create index forward_community_comments_author on public.forward_community_comments(author_id);

alter table public.forward_community_likes enable row level security;
alter table public.forward_community_comments enable row level security;
revoke all on public.forward_community_likes,public.forward_community_comments from public,anon,authenticated;
grant select,delete on public.forward_community_likes,public.forward_community_comments to authenticated;
grant insert (post_id) on public.forward_community_likes to authenticated;
grant insert (post_id,author_name,body) on public.forward_community_comments to authenticated;

create function forward_private.forward_community_can_engage(p_post_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select (select forward_private.forward_role()) is not null and exists (
    select 1 from public.forward_community_posts post
    where post.id=p_post_id and post.published_at is not null
  )
$$;

create policy forward_community_own_like_read on public.forward_community_likes
  for select to authenticated using (member_id=(select auth.uid()) and forward_private.forward_community_can_engage(post_id));
create policy forward_community_own_like_write on public.forward_community_likes
  for insert to authenticated with check (member_id=(select auth.uid()) and forward_private.forward_community_can_engage(post_id));
create policy forward_community_own_like_remove on public.forward_community_likes
  for delete to authenticated using (member_id=(select auth.uid()));

create policy forward_community_members_read_comments on public.forward_community_comments
  for select to authenticated using (forward_private.forward_community_can_engage(post_id));
create policy forward_community_members_add_comments on public.forward_community_comments
  for insert to authenticated with check (author_id=(select auth.uid()) and forward_private.forward_community_can_engage(post_id));
create policy forward_community_author_removes_comment on public.forward_community_comments
  for delete to authenticated using (author_id=(select auth.uid()));

-- Only aggregate counts and the requesting member's own like are returned.
create function forward_private.forward_community_engagement(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, comment_count bigint, liked boolean)
language sql stable security definer set search_path='' as $$
  select post.id,
    (select count(*) from public.forward_community_likes likes where likes.post_id=post.id),
    (select count(*) from public.forward_community_comments comments where comments.post_id=post.id),
    exists(select 1 from public.forward_community_likes likes
      where likes.post_id=post.id and likes.member_id=(select auth.uid()))
  from public.forward_community_posts post
  where (select forward_private.forward_role()) is not null
    and cardinality(p_post_ids) between 1 and 50 and post.id=any(p_post_ids)
    and post.published_at is not null
$$;

create function public.forward_community_engagement(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, comment_count bigint, liked boolean)
language sql stable security invoker set search_path='' as $$
  select * from forward_private.forward_community_engagement(p_post_ids)
$$;

create function forward_private.forward_signal_community_engagement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform realtime.send('{}'::jsonb,'engagement-changed','forward-community-engagement',true);
  return null;
end
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null
      and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    create policy forward_community_members_receive_engagement on realtime.messages
      for select to authenticated using (
        extension='broadcast' and topic=(select realtime.topic())
        and topic='forward-community-engagement'
        and (select forward_private.forward_role()) is not null
      );
    create trigger forward_signal_community_like after insert or delete on public.forward_community_likes
      for each row execute function forward_private.forward_signal_community_engagement();
    create trigger forward_signal_community_comment after insert or delete on public.forward_community_comments
      for each row execute function forward_private.forward_signal_community_engagement();
  end if;
end
$$;

revoke all on function forward_private.forward_community_can_engage(uuid),
  forward_private.forward_community_engagement(uuid[]), public.forward_community_engagement(uuid[]),
  forward_private.forward_signal_community_engagement() from public,anon,authenticated;
grant execute on function forward_private.forward_community_can_engage(uuid),
  forward_private.forward_community_engagement(uuid[]),public.forward_community_engagement(uuid[]) to authenticated;
