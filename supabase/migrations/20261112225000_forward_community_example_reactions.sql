-- Built-in examples have published post IDs but no sign-in account.
-- Members still use the same like and comment permissions as other posts.
alter table public.forward_community_posts alter column author_id drop not null;
alter table public.forward_community_posts add constraint forward_community_author_or_example check (
  author_id is not null or (
    published_at is not null and id in (
      'bf000000-0000-4000-8000-000000000001'::uuid,
      'bf000000-0000-4000-8000-000000000002'::uuid,
      'bf000000-0000-4000-8000-000000000003'::uuid
    )
  )
);

insert into public.forward_community_posts
  (id,author_id,author_name,caption,extensions,descriptions,published_at)
values
  ('bf000000-0000-4000-8000-000000000001',null,'Jordan Reyes','Fictional workshop planning post.',
    array['jpg','jpg','mp4'],array['Planning meeting','Workshop materials','Workshop recap'],now()),
  ('bf000000-0000-4000-8000-000000000002',null,'Amina Brooks','Fictional community conference post.',
    array['jpg'],array['Community infrastructure conference'],now()),
  ('bf000000-0000-4000-8000-000000000003',null,'Mateo Ellis','Fictional company gathering post.',
    array['jpg'],array['Year-end holiday gathering'],now());
