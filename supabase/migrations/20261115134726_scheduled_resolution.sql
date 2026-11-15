-- Every minute, including while all residents are offline.
create extension if not exists pg_cron with schema pg_catalog;
create function private.resolve_due_polls() returns void language plpgsql security definer set search_path='' as $$
declare p record;
begin
 for p in select id from public.polls where status='open' and ends_at<=clock_timestamp() order by building_id,id loop
 perform private.resolve_poll(p.id);
 end loop;
end $$;
revoke all on function private.resolve_due_polls() from public,anon,authenticated;
select cron.schedule('apartman-resolve-polls','* * * * *','select private.resolve_due_polls()');
