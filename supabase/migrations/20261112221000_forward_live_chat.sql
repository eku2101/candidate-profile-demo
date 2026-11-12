-- Realtime carries only a signal. Message content is fetched through the
-- existing participant-only policy on public.forward_messages.
create function forward_private.forward_signal_chat_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform realtime.send('{}'::jsonb, 'message-added', 'forward-chat:' || new.connection_id::text, true);
  return new;
end
$$;

revoke all on function forward_private.forward_signal_chat_message() from public, anon, authenticated;

-- Hosted Supabase supplies Realtime. Local database tests can run without it.
do $$
begin
  if to_regclass('realtime.messages') is not null
      and to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    create policy forward_matched_participants_receive on realtime.messages
      for select to authenticated using (
        extension = 'broadcast' and case
          when topic = (select realtime.topic())
            and topic ~ '^forward-chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then forward_private.forward_can_message(substring(topic from 14)::uuid)
          else false
        end
      );
    create trigger forward_signal_chat_message after insert on public.forward_messages
      for each row execute function forward_private.forward_signal_chat_message();
  end if;
end
$$;
