set local lock_timeout='5s';

create table private.staff_requests(id uuid primary key,actor_id uuid not null,action text not null,payload jsonb not null,created_at timestamptz not null default clock_timestamp());
alter table private.staff_requests enable row level security;
revoke all on private.staff_requests from public,anon,authenticated;
create function private.staff_claim_request(request_id uuid,act text,body jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare r private.staff_requests;
begin
 if request_id is null then raise exception 'İşlem kimliği gerekli.'; end if;
 select * into r from private.staff_requests where id=request_id;
 if found then
 if r.actor_id is distinct from auth.uid() or r.action<>act or r.payload<>body then raise exception 'İşlem kimliği başka bir istek için kullanılmış.'; end if;
 return false;
 end if;
 insert into private.staff_requests(id,actor_id,action,payload) values(request_id,auth.uid(),act,body);return true;
end $$;
revoke all on function private.staff_claim_request(uuid,text,jsonb) from public,anon,authenticated;
-- APARTMAN v0.3.1 draft; staged for isolated PostgreSQL validation.
-- Convert with Supabase CLI "migration new" and run full integration suite BEFORE live deployment.
-- Never modify any existing migration files.

-- Existing ledger supports append-only administrative correction records.
alter table public.wallet_transactions drop constraint wallet_transactions_kind_check;
alter table public.wallet_transactions add constraint wallet_transactions_kind_check
  check (kind in ('starting','salary','side_job','dues','admin_adjustment'));
alter table public.treasury_entries drop constraint treasury_entries_kind_check;
alter table public.treasury_entries add constraint treasury_entries_kind_check
  check (kind in ('dues','cleaning','maintenance','admin_adjustment'));
-- Dues must stay positive; direct staff override can exceed player-voted 100-200 range.
alter table public.economy_settings drop constraint economy_settings_weekly_dues_check;
alter table public.economy_settings add constraint economy_settings_weekly_dues_check
  check (weekly_dues between 1 and 100000);

alter table public.economy_settings add column dues_override_from date,add column dues_override_amount integer,add column dues_override_at timestamptz;
-- Read-only, rights-filtered operational overview.
create function private.staff_game_overview() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Oturum gerekli.'; end if;
 return jsonb_build_object(
   'players',coalesce((select jsonb_agg(to_jsonb(t) order by t.username) from (
      select p.id as user_id,p.username,m.building_id,
        case when private.staff_can('economy.read',m.building_id)
           or private.staff_can('economy.wallet.adjust',m.building_id)
           then w.balance else null end as balance,
        (private.staff_can('economy.read',m.building_id)
         or private.staff_can('economy.wallet.adjust',m.building_id)) as can_read_balance
      from public.profiles p
      left join public.memberships m on m.user_id=p.id
      left join public.wallets w on w.user_id=p.id
      where private.staff_can('players.moderate',m.building_id) or private.staff_can('players.ban',m.building_id) or private.staff_can('players.read',m.building_id)
         or private.staff_can('players.profile.edit',m.building_id)
         or private.staff_can('economy.read',m.building_id)
         or private.staff_can('economy.wallet.adjust',m.building_id)
    ) t),'[]'::jsonb),
   'buildings',coalesce((select jsonb_agg(to_jsonb(t) order by t.name) from (
      select b.id,b.name,
        case when private.staff_can('economy.read',b.id)
           or private.staff_can('economy.treasury.adjust',b.id)
           then b.treasury else null end as treasury,
        case when private.staff_can('economy.read',b.id)
           or private.staff_can('economy.settings.manage',b.id)
           then to_jsonb(e) else null end as settings
      from public.buildings b left join public.economy_settings e on e.building_id=b.id
      where private.staff_can('players.moderate',b.id) or private.staff_can('players.ban',b.id) or private.staff_can('governance.read',b.id) or private.staff_can('governance.elections.manage',b.id) or private.staff_can('governance.elections.override',b.id) or private.staff_can('governance.manager.appoint',b.id) or private.staff_can('economy.read',b.id)
         or private.staff_can('economy.treasury.adjust',b.id)
         or private.staff_can('economy.settings.manage',b.id)
         or private.staff_can('economy.wallet.adjust',b.id)
    ) t),'[]'::jsonb)
 );
end $$;
create function public.staff_game_overview() returns jsonb
language sql security invoker set search_path='' as $$ select private.staff_game_overview() $$;

create function private.staff_game_write_check(permission_code text, building uuid, reason text)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 -- Shared transaction-wide serialization with all RBAC grants/revocations.
 perform pg_advisory_xact_lock(741029030);
 if coalesce(auth.jwt()->>'aal','')<>'aal2' then
   raise exception 'Yönetim işlemleri için çok faktörlü doğrulama gerekli.';
 end if;
 if not private.staff_can(permission_code,building) then
   raise exception 'Bu işlem için yetkiniz yok.';
 end if;
 if char_length(btrim(coalesce(reason,''))) not between 5 and 500 then
   raise exception 'İşlem gerekçesi 5–500 karakter olmalı.';
 end if;
end $$;

create function private.staff_adjust_wallet(target_user uuid,amount integer,operation_id uuid,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare b uuid; old_balance integer; new_balance bigint;
begin
 if target_user is null or operation_id is null or amount is null or amount=0 or abs(amount::bigint)>1000000 then
   raise exception 'Geçersiz cüzdan düzeltmesi.';
 end if;
 select building_id into b from public.wallets where user_id=target_user;
 if b is null then raise exception 'Oyuncunun cüzdanı bulunamadı.'; end if;
 perform private.staff_game_write_check('economy.wallet.adjust',b,reason);
 if not private.staff_claim_request(operation_id,'wallet',jsonb_build_object('user',target_user,'amount',amount,'reason',reason)) then return; end if;
 perform 1 from public.buildings where id=b for update;
 select balance into strict old_balance from public.wallets
  where user_id=target_user and building_id=b for update;
 new_balance:=old_balance::bigint+amount::bigint;
 if new_balance<0 or new_balance>2147483647 then raise exception 'Geçersiz yeni bakiye.'; end if;
 if not private.wallet_post(target_user,amount,'admin_adjustment','admin:'||operation_id::text,
    'Yönetim düzeltmesi') then
   raise exception 'Bu işlem daha önce gerçekleştirildi.';
 end if;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'wallet.adjust','user',target_user::text,
   jsonb_build_object('balance',old_balance),
   jsonb_build_object('balance',new_balance,'delta',amount,'request_id',operation_id,'building_id',b),
   btrim(reason));
end $$;
create function public.staff_adjust_wallet(target_user uuid,amount integer,operation_id uuid,reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_adjust_wallet(target_user,amount,operation_id,reason)
$$;

create function private.staff_adjust_treasury(target_building uuid,amount integer,operation_id uuid,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare old_balance integer; new_balance bigint; source text;
begin
 if target_building is null or operation_id is null or amount is null or amount=0
    or abs(amount::bigint)>1000000 then raise exception 'Geçersiz kasa düzeltmesi.'; end if;
 perform private.staff_game_write_check('economy.treasury.adjust',target_building,reason);
 if not private.staff_claim_request(operation_id,'treasury',jsonb_build_object('building',target_building,'amount',amount,'reason',reason)) then return; end if;
 select treasury into strict old_balance from public.buildings where id=target_building for update;
 new_balance:=old_balance::bigint+amount::bigint;
 if new_balance<0 or new_balance>2147483647 then raise exception 'Geçersiz yeni kasa bakiyesi.'; end if;
 source:='admin:'||operation_id::text;
 if exists(select 1 from public.treasury_entries where source_key=source) then
   raise exception 'Bu işlem daha önce gerçekleştirildi.';
 end if;
 perform private.treasury_post(target_building,amount,'admin_adjustment',source,'Yönetim düzeltmesi');
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'treasury.adjust','building',target_building::text,
   jsonb_build_object('balance',old_balance),
   jsonb_build_object('balance',new_balance,'delta',amount,'request_id',operation_id),
   btrim(reason));
end $$;
create function public.staff_adjust_treasury(target_building uuid,amount integer,operation_id uuid,reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_adjust_treasury(target_building,amount,operation_id,reason)
$$;

create function private.staff_update_economy(target_building uuid,setting_key text,new_value integer,reason text,operation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare previous integer;
begin
 perform private.staff_game_write_check('economy.settings.manage',target_building,reason);
 if not private.staff_claim_request(operation_id,'setting',jsonb_build_object('building',target_building,'key',setting_key,'value',new_value,'reason',reason)) then return; end if;
 if setting_key not in ('initial_balance','daily_salary','side_job_reward','weekly_dues',
   'cleaning_base','cleaning_per_resident','maintenance_base','maintenance_per_resident')
   or setting_key is null then raise exception 'Bilinmeyen ekonomi parametresi.'; end if;
 if new_value is null or new_value<0 or new_value>1000000
   or (setting_key='weekly_dues' and (new_value<1 or new_value>100000))
   then raise exception 'Geçersiz ekonomi parametresi.'; end if;
 perform 1 from public.buildings where id=target_building for update;
 select (to_jsonb(s)->>setting_key)::integer into strict previous
 from public.economy_settings s where building_id=target_building for update;
 if previous=new_value and setting_key<>'weekly_dues' then return; end if;
 if setting_key='weekly_dues' then update public.economy_settings set dues_override_from=(date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')+interval '7 days')::date,dues_override_amount=new_value,dues_override_at=clock_timestamp() where building_id=target_building; end if;
 execute format('update public.economy_settings set %I=$1 where building_id=$2',setting_key)
 using new_value,target_building;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'economy.setting','building',target_building::text,
   jsonb_build_object('key',setting_key,'value',previous),
   jsonb_build_object('key',setting_key,'value',new_value),btrim(reason));
end $$;
create function public.staff_update_economy(target_building uuid,setting_key text,new_value integer,reason text,operation_id uuid)
returns void language sql security invoker set search_path='' as $$
 select private.staff_update_economy(target_building,setting_key,new_value,reason,operation_id)
$$;

create function private.staff_rename_player(target_user uuid,new_username text,reason text,operation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b uuid; old_username text;
begin
 select building_id into b from public.memberships where user_id=target_user;
 perform private.staff_game_write_check('players.profile.edit',b,reason);
 if not private.staff_claim_request(operation_id,'rename',jsonb_build_object('user',target_user,'name',new_username,'reason',reason)) then return; end if;
 if new_username is null or new_username !~ '^[A-Za-z0-9_]{3,20}$' then
   raise exception 'Kullanıcı adı 3–20 karakter olmalı.';
 end if;
 select username into strict old_username from public.profiles where id=target_user for update;
 if old_username=new_username then return; end if;
 update public.profiles set username=new_username where id=target_user;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'player.rename','user',target_user::text,jsonb_build_object('username',old_username,'building_id',b),jsonb_build_object('username',new_username,'building_id',b),btrim(reason));
end $$;
create function public.staff_rename_player(target_user uuid,new_username text,reason text,operation_id uuid)
returns void language sql security invoker set search_path='' as $$
 select private.staff_rename_player(target_user,new_username,reason,operation_id)
$$;

-- Private data stays inaccessible to client sessions; only checked RPCs are executable.
revoke all on function private.staff_game_overview(),
 private.staff_game_write_check(text,uuid,text),
 private.staff_adjust_wallet(uuid,integer,uuid,text),
 private.staff_adjust_treasury(uuid,integer,uuid,text),
 private.staff_update_economy(uuid,text,integer,text,uuid),
 private.staff_rename_player(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function private.staff_game_overview(),
 private.staff_adjust_wallet(uuid,integer,uuid,text),
 private.staff_adjust_treasury(uuid,integer,uuid,text),
 private.staff_update_economy(uuid,text,integer,text,uuid),
 private.staff_rename_player(uuid,text,text,uuid) to authenticated;

revoke all on function public.staff_game_overview(),
 public.staff_adjust_wallet(uuid,integer,uuid,text),
 public.staff_adjust_treasury(uuid,integer,uuid,text),
 public.staff_update_economy(uuid,text,integer,text,uuid),
 public.staff_rename_player(uuid,text,text,uuid) from public,anon;
grant execute on function public.staff_game_overview(),
 public.staff_adjust_wallet(uuid,integer,uuid,text),
 public.staff_adjust_treasury(uuid,integer,uuid,text),
 public.staff_update_economy(uuid,text,integer,text,uuid),
 public.staff_rename_player(uuid,text,text,uuid) to authenticated;

create or replace function private.economy_tick(b uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.economy_settings; salary_row record; d date:=(clock_timestamp() at time zone 'Europe/Istanbul')::date;
 wk date:=date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')::date; active_count integer; rate integer; ex record;
begin
 perform 1 from public.buildings where id=b for update;
 select * into strict s from public.economy_settings where building_id=b;
 for salary_row in select wal.* from public.wallets wal join public.memberships m using(user_id) where wal.building_id=b and wal.job is not null and wal.employment_started_on<d
 and wal.last_active_at>=clock_timestamp()-interval '7 days' order by wal.user_id loop
 perform private.wallet_post(salary_row.user_id,s.daily_salary,'salary',d::text,'Günlük iş maaşı · '||d::text);
 end loop;
 if wk>=s.first_week then
 select coalesce((select amount from (select r.amount,r.effective_week,p.resolved_at as decided_at from public.dues_rates r join public.polls p on p.id=r.poll_id where r.building_id=b and r.effective_week<=wk union all select s.dues_override_amount,s.dues_override_from,s.dues_override_at where s.dues_override_from<=wk) rates order by effective_week desc,decided_at desc limit 1),s.weekly_dues) into rate;
 insert into public.dues(building_id,user_id,week_start,amount)
 select b,w.user_id,wk,rate from public.wallets w join public.memberships m using(user_id)
 where w.building_id=b and w.last_active_at>=clock_timestamp()-interval '7 days'
 and m.joined_at < (wk::timestamp at time zone 'Europe/Istanbul')
 on conflict(user_id,week_start) do nothing;
 select count(*) into active_count from public.wallets wal join public.memberships m using(user_id) where wal.building_id=b and wal.last_active_at>=clock_timestamp()-interval '7 days';
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

create function private.staff_operations_history(target_building uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.staff_can('staff.audit.read',target_building) then raise exception 'Denetim izni gerekli.';end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by created_at desc) from (select id,actor_id,action,target_type,target_id,old_value,new_value,reason,created_at from private.staff_audit where target_id=target_building::text or new_value->>'building_id'=target_building::text order by created_at desc limit 100) t),'[]');end $$;
create function public.staff_operations_history(target_building uuid) returns jsonb language sql security invoker set search_path='' as $$select private.staff_operations_history(target_building)$$;
revoke all on function private.staff_operations_history(uuid),public.staff_operations_history(uuid) from public,anon,authenticated;
grant execute on function private.staff_operations_history(uuid),public.staff_operations_history(uuid) to authenticated;
create table private.staff_compensations(original_audit_id uuid primary key references private.staff_audit,operation_id uuid not null unique references private.staff_requests);
alter table private.staff_compensations enable row level security;
revoke all on private.staff_compensations from public,anon,authenticated;
create function private.staff_compensate(original_audit_id uuid,operation_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare entry private.staff_audit;b uuid;perm text;delta integer;
begin
 select * into strict entry from private.staff_audit where id=original_audit_id;
 if entry.action not in ('wallet.adjust','treasury.adjust') then raise exception 'Bu kayıt parasal telafi için uygun değil.';end if;
 b:=case when entry.action='wallet.adjust' then (entry.new_value->>'building_id')::uuid else entry.target_id::uuid end;
 perm:=case when entry.action='wallet.adjust' then 'economy.wallet.adjust' else 'economy.treasury.adjust' end;
 perform private.staff_game_write_check(perm,b,reason);
 if not private.staff_claim_request(operation_id,'compensate',jsonb_build_object('audit',original_audit_id,'reason',reason)) then return;end if;
 insert into private.staff_compensations values(original_audit_id,operation_id);
 delta:=-(entry.new_value->>'delta')::integer;
 if entry.action='wallet.adjust' then perform private.staff_adjust_wallet(entry.target_id::uuid,delta,gen_random_uuid(),reason);
 else perform private.staff_adjust_treasury(b,delta,gen_random_uuid(),reason);end if;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason) values(auth.uid(),'operation.compensate','building',b::text,jsonb_build_object('original_audit',original_audit_id),jsonb_build_object('request_id',operation_id,'delta',delta),reason);
end$$;
create function public.staff_compensate(original_audit_id uuid,operation_id uuid,reason text) returns void language sql security invoker set search_path='' as $$select private.staff_compensate(original_audit_id,operation_id,reason)$$;
revoke all on function private.staff_compensate(uuid,uuid,text),public.staff_compensate(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.staff_compensate(uuid,uuid,text),public.staff_compensate(uuid,uuid,text) to authenticated;

create or replace function private.staff_directory() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.staff_can('staff.roles.read',null) and not exists(select 1 from public.buildings b where private.staff_can('world.buildings.read',b.id) or private.staff_can('world.buildings.rename',b.id)) then raise exception 'Bu işlem için yetkiniz yok.'; end if;
 return jsonb_build_object(
  'roles',coalesce((select jsonb_agg(to_jsonb(x)) from (
    select r.id,r.code,r.title,r.description,r.system_role,
           coalesce(array_agg(rp.permission_code order by rp.permission_code)
             filter(where rp.permission_code is not null),array[]::text[]) as permissions
    from private.staff_roles r left join private.staff_role_permissions rp on rp.role_id=r.id
    group by r.id having private.staff_can('staff.roles.read',null) order by r.id
  ) x),'[]'::jsonb),
  'permissions',coalesce((select jsonb_agg(to_jsonb(p) order by p.category,p.code)
    from private.staff_permissions p where private.staff_can('staff.roles.read',null)),'[]'::jsonb),
  'buildings',coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from (select id,name,slug from public.buildings b where private.staff_can('staff.roles.read',null) or private.staff_can('world.buildings.read',b.id) or private.staff_can('world.buildings.rename',b.id)) b),'[]'::jsonb),
  'users',coalesce((select jsonb_agg(to_jsonb(u) order by u.username) from (
    select a.id as user_id,coalesce(p.username,'(oyuncu değil)') as username
    from auth.users a left join public.profiles p on p.id=a.id where private.staff_can('staff.roles.read',null)
  ) u),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by a.granted_at desc)
    from (select sa.id,sa.user_id,r.code as role,sa.scope_kind,sa.scope_id,
      sa.expires_at,sa.granted_at from private.staff_assignments sa join private.staff_roles r on r.id=sa.role_id where private.staff_can('staff.roles.read',null)) a),'[]'::jsonb),
  'audit',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc)
    from (select action,actor_id,target_type,target_id,old_value,new_value,reason,created_at from private.staff_audit
      where private.staff_can('staff.audit.read',null) order by created_at desc limit 50) l),'[]'::jsonb)
 );
end $$;

-- A high, authorized admin balance must not make the global salary worker overflow.
create or replace function private.wallet_post(u uuid,amt integer,k text,period text,label text) returns boolean language plpgsql security definer set search_path='' as $$
declare w public.wallets;
begin
 select * into strict w from public.wallets where user_id=u for update;
 if w.balance::bigint+amt::bigint>2147483647 then
 if k='salary' then return false;end if;
 raise exception 'Cüzdan üst sınırı aşılıyor.';end if;
 if w.balance::bigint+amt::bigint<0 then raise exception 'Yetersiz kişisel bakiye.'; end if;
 if amt=0 then return false; end if;
 insert into public.wallet_transactions(user_id,building_id,amount,balance_after,kind,period_key,description)
 values(u,w.building_id,amt,w.balance+amt,k,period,label) on conflict(user_id,kind,period_key) do nothing;
 if not found then return false; end if;
 update public.wallets set balance=balance+amt where user_id=u;
 return true;
end $$;
