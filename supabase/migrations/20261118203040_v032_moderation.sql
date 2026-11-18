set local lock_timeout='5s';
create table private.player_sanctions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,
 building_id uuid references public.buildings,kind text not null check(kind in ('ban','mute','warning')),
 expires_at timestamptz,revoked_at timestamptz,reason text not null,actor_id uuid not null references auth.users,
 created_at timestamptz not null default clock_timestamp(),operation_id uuid not null unique references private.staff_requests(id)
);
create index player_sanctions_user on private.player_sanctions(user_id,kind);
alter table private.player_sanctions enable row level security;
revoke all on private.player_sanctions from public,anon,authenticated;
create function private.player_blocked(u uuid,chat boolean default false) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from private.player_sanctions where user_id=u and revoked_at is null and (expires_at is null or expires_at>clock_timestamp()) and (kind='ban' or (chat and kind='mute')))
$$;
revoke all on function private.player_blocked(uuid,boolean) from public,anon,authenticated;
create function private.assert_player_allowed(chat boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();b uuid;
begin
 if u is null then raise exception 'Oturum gerekli.';end if;
 select building_id into b from public.memberships where user_id=u;
 if b is not null then perform 1 from public.buildings where id=b for update;end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,741032));
 if private.player_blocked(u,chat) then raise exception 'Hesabınızda bu işlemi engelleyen aktif yaptırım var.';end if;
end $$;
revoke all on function private.assert_player_allowed(boolean) from public,anon,authenticated;
create function private.staff_sanction(target_user uuid,action text,until_at timestamptz,operation_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare b uuid;k text;previous jsonb;
begin
 select building_id into b from public.memberships where user_id=target_user;
 k:=case when action in ('ban','unban') then 'ban' when action in ('mute','unmute') then 'mute' when action='warning' then 'warning' else null end;
 if k is null then raise exception 'Geçersiz yaptırım.';end if;
 perform private.staff_game_write_check(case when k='ban' then 'players.ban' else 'players.moderate' end,b,reason);
 if not private.staff_claim_request(operation_id,'sanction',jsonb_build_object('user',target_user,'action',action,'until',until_at,'reason',reason)) then return;end if;
 if b is not null then perform 1 from public.buildings where id=b for update;end if;
 perform pg_advisory_xact_lock(hashtextextended(target_user::text,741032));
 if not exists(select 1 from public.profiles where id=target_user) then raise exception 'Oyuncu bulunamadı.';end if;
 if action in ('ban','mute') and until_at is not null and until_at<=clock_timestamp() then raise exception 'Bitiş gelecekte olmalı.';end if;
 if k='ban' and action='ban' and exists(select 1 from private.staff_assignments a join private.staff_roles r on r.id=a.role_id where a.user_id=target_user and r.code='super_admin') then
 if not private.staff_is_super() or not exists(select 1 from private.staff_assignments a join private.staff_roles r on r.id=a.role_id where r.code='super_admin' and a.user_id<>target_user and not private.player_blocked(a.user_id,false)) then raise exception 'Son etkin Süper Yönetici banlanamaz.';end if;
 end if;
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') into previous from private.player_sanctions s where user_id=target_user and kind=k and revoked_at is null;
 if k<>'warning' then update private.player_sanctions set revoked_at=clock_timestamp() where user_id=target_user and kind=k and revoked_at is null;end if;
 if action not in ('unban','unmute') then insert into private.player_sanctions(user_id,building_id,kind,expires_at,reason,actor_id,operation_id) values(target_user,b,k,until_at,reason,auth.uid(),operation_id);end if;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason) values(auth.uid(),'player.'||action,'user',target_user::text,previous,jsonb_build_object('building_id',b,'until',until_at,'request_id',operation_id),reason);
end $$;
create function public.staff_sanction(target_user uuid,action text,until_at timestamptz,operation_id uuid,reason text) returns void language sql security invoker set search_path='' as $$select private.staff_sanction(target_user,action,until_at,operation_id,reason)$$;
create function private.staff_sanction_history(target_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid;begin
 select building_id into b from public.memberships where user_id=target_user;
 if not private.staff_can('players.moderate',b) and not private.staff_can('players.ban',b) then raise exception 'Yetkiniz yok.';end if;
 return coalesce((select jsonb_agg(to_jsonb(s) order by created_at desc) from private.player_sanctions s where user_id=target_user and (private.staff_can('players.moderate',s.building_id) or private.staff_can('players.ban',s.building_id))),'[]');end $$;
create function public.staff_sanction_history(target_user uuid) returns jsonb language sql security invoker set search_path='' as $$select private.staff_sanction_history(target_user)$$;
revoke all on function private.staff_sanction(uuid,text,timestamptz,uuid,text),private.staff_sanction_history(uuid),public.staff_sanction(uuid,text,timestamptz,uuid,text),public.staff_sanction_history(uuid) from public,anon,authenticated;
grant execute on function private.staff_sanction(uuid,text,timestamptz,uuid,text),private.staff_sanction_history(uuid),public.staff_sanction(uuid,text,timestamptz,uuid,text),public.staff_sanction_history(uuid) to authenticated;

alter function private.join_building(text) rename to join_building_before_moderation;
revoke all on function private.join_building_before_moderation(text) from public,anon,authenticated;
create function private.join_building(invite_code text) returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);perform private.join_building_before_moderation(invite_code);end $$;
revoke all on function private.join_building(text) from public,anon,authenticated;
grant execute on function private.join_building(text) to authenticated;

alter function private.send_message(text) rename to send_message_before_moderation;
revoke all on function private.send_message_before_moderation(text) from public,anon,authenticated;
create function private.send_message(message_body text) returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(true);perform private.send_message_before_moderation(message_body);end $$;
revoke all on function private.send_message(text) from public,anon,authenticated;
grant execute on function private.send_message(text) to authenticated;

alter function private.cast_vote(uuid,boolean) rename to cast_vote_before_moderation;
revoke all on function private.cast_vote_before_moderation(uuid,boolean) from public,anon,authenticated;
create function private.cast_vote(target_poll uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);perform private.cast_vote_before_moderation(target_poll,approve);end $$;
revoke all on function private.cast_vote(uuid,boolean) from public,anon,authenticated;
grant execute on function private.cast_vote(uuid,boolean) to authenticated;

alter function private.settle_polls() rename to settle_polls_before_moderation;
revoke all on function private.settle_polls_before_moderation() from public,anon,authenticated;
create function private.settle_polls() returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);perform private.settle_polls_before_moderation();end $$;
revoke all on function private.settle_polls() from public,anon,authenticated;
grant execute on function private.settle_polls() to authenticated;

alter function private.player_action(text,text) rename to player_action_before_moderation;
revoke all on function private.player_action_before_moderation(text,text) from public,anon,authenticated;
create function private.player_action(action text,value text default null) returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);perform private.player_action_before_moderation(action,value);end $$;
revoke all on function private.player_action(text,text) from public,anon,authenticated;
grant execute on function private.player_action(text,text) to authenticated;

alter function private.pay_dues(uuid) rename to pay_dues_before_moderation;
revoke all on function private.pay_dues_before_moderation(uuid) from public,anon,authenticated;
create function private.pay_dues(target_due uuid) returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);perform private.pay_dues_before_moderation(target_due);end $$;
revoke all on function private.pay_dues(uuid) from public,anon,authenticated;
grant execute on function private.pay_dues(uuid) to authenticated;

alter function private.election_action(uuid,text,text) rename to election_action_before_moderation;
revoke all on function private.election_action_before_moderation(uuid,text,text) from public,anon,authenticated;
create function private.election_action(target_election uuid,action text,value text) returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);perform private.election_action_before_moderation(target_election,action,value);end $$;
revoke all on function private.election_action(uuid,text,text) from public,anon,authenticated;
grant execute on function private.election_action(uuid,text,text) to authenticated;

alter function private.propose_management(text,integer) rename to propose_management_before_moderation;
revoke all on function private.propose_management_before_moderation(text,integer) from public,anon,authenticated;
create function private.propose_management(proposal text,new_dues integer default null) returns void language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);perform private.propose_management_before_moderation(proposal,new_dues);end $$;
revoke all on function private.propose_management(text,integer) from public,anon,authenticated;
grant execute on function private.propose_management(text,integer) to authenticated;

create or replace function private.my_building() returns uuid language sql volatile security definer set search_path='' as $$select building_id from public.memberships where user_id=(select auth.uid()) and not private.player_blocked((select auth.uid()),false)$$;
create function private.sanction_direct_write() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.assert_player_allowed(false);if TG_OP='DELETE' then return old;end if;return new;end$$;
revoke all on function private.sanction_direct_write() from public,anon,authenticated;
create trigger block_sanction_guard before insert or delete on public.blocks for each row execute function private.sanction_direct_write();
create trigger report_sanction_guard before insert on public.message_reports for each row execute function private.sanction_direct_write();

create or replace function private.staff_is_super() returns boolean
language sql volatile security definer set search_path='' as $$
 select not private.player_blocked((select auth.uid()),false) and exists (
  select 1 from private.staff_assignments a
  join private.staff_roles r on r.id=a.role_id
  where a.user_id=(select auth.uid()) and r.code='super_admin'
  and a.scope_kind='global'
  and (a.expires_at is null or a.expires_at>clock_timestamp())
 )
$$;

create or replace function private.staff_can(p text,b uuid default null) returns boolean
language sql volatile security definer set search_path='' as $$
 select not private.player_blocked((select auth.uid()),false) and exists (
  select 1 from private.staff_assignments a
  join private.staff_roles r on r.id=a.role_id
  where a.user_id=(select auth.uid()) and (a.expires_at is null or a.expires_at>clock_timestamp())
  and (a.scope_kind='global' or (b is not null and a.scope_kind='building' and a.scope_id=b))
  and ((r.code='super_admin' and a.scope_kind='global') or exists (
    select 1 from private.staff_role_permissions rp where rp.role_id=r.id and rp.permission_code=p
  ))
 )
$$;

-- Safe account capability discovery: never exposes another user's grants.

create or replace function private.economy_tick(b uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.economy_settings; salary_row record; d date:=(clock_timestamp() at time zone 'Europe/Istanbul')::date;
 wk date:=date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')::date; active_count integer; rate integer; ex record;
begin
 perform 1 from public.buildings where id=b for update;
 select * into strict s from public.economy_settings where building_id=b;
 for salary_row in select wal.* from public.wallets wal join public.memberships m using(user_id) where wal.building_id=b and wal.job is not null and wal.employment_started_on<d
 and not private.player_blocked(wal.user_id,false) and wal.last_active_at>=clock_timestamp()-interval '7 days' order by wal.user_id loop
 perform private.wallet_post(salary_row.user_id,s.daily_salary,'salary',d::text,'Günlük iş maaşı · '||d::text);
 end loop;
 if wk>=s.first_week then
 -- Shared rate resolver prevents future staff changes leaking into current-week invoices.
 select private.staff_dues_rate(b,wk) into rate;
 insert into public.dues(building_id,user_id,week_start,amount)
 select b,w.user_id,wk,rate from public.wallets w join public.memberships m using(user_id)
 where w.building_id=b and not private.player_blocked(w.user_id,false) and w.last_active_at>=clock_timestamp()-interval '7 days'
 and m.joined_at < (wk::timestamp at time zone 'Europe/Istanbul')
 on conflict(user_id,week_start) do nothing;
 select count(*) into active_count from public.wallets wal join public.memberships m using(user_id) where wal.building_id=b and not private.player_blocked(wal.user_id,false) and wal.last_active_at>=clock_timestamp()-interval '7 days';
 insert into public.operating_expenses(building_id,week_start,kind,active_residents,amount) values
 (b,wk,'cleaning',active_count,s.cleaning_base+s.cleaning_per_resident*active_count),
 (b,wk,'maintenance',active_count,s.maintenance_base+s.maintenance_per_resident*active_count)
 on conflict(building_id,week_start,kind) do nothing;
 end if;
 -- Insufficient expenses stay visible and are retried after future incoming dues.
 for ex in select * from public.operating_expenses where building_id=b and paid_at is null order by week_start,kind for update loop
 if (select treasury from public.buildings where id=b)>=ex.amount then
 perform private.treasury_post(b,-ex.amount,ex.kind,'expense:'||ex.id,case when ex.kind='cleaning' then 'Haftalık temizlik' else 'Aydınlatma ve rutin bakım' end||' · '||ex.week_start);
 update public.operating_expenses set paid_at=clock_timestamp() where id=ex.id;
 insert into public.activity(building_id,kind,description) values(b,'operating_expense','Haftalık işletme gideri ödendi: '||ex.amount||' OP.');
 end if;
 end loop;
end $$;
