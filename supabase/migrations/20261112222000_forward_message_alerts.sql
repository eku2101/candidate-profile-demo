-- Return one incoming message ID per matched conversation. The existing
-- connection and message permissions apply, and no message text is returned.
create function public.forward_message_updates()
returns table (connection_id uuid, message_id bigint)
language sql stable security invoker set search_path='' as $$
  select connection.id, latest.id
  from public.forward_connections() connection
  cross join lateral (
    select message.id from public.forward_messages message
    where message.connection_id = connection.id
      and message.sender_id <> (select auth.uid())
    order by message.id desc limit 1
  ) latest
  where connection.matched
  order by latest.id desc
$$;

revoke all on function public.forward_message_updates() from public, anon, authenticated;
grant execute on function public.forward_message_updates() to authenticated;

create or replace function forward_private.forward_signal_chat_message()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  recipient uuid;
begin
  perform realtime.send('{}'::jsonb, 'message-added', 'forward-chat:' || new.connection_id::text, true);
  select case when applicant_id = new.sender_id then manager_id else applicant_id end
    into recipient from public.forward_connections where id = new.connection_id;
  if recipient is not null then
    perform realtime.send('{}'::jsonb, 'message-received', 'forward-inbox:' || recipient::text, true);
  end if;
  return new;
end
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    create policy forward_recipient_receives_inbox_signal on realtime.messages
      for select to authenticated using (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and topic = 'forward-inbox:' || (select auth.uid())::text
      );
  end if;
end
$$;
