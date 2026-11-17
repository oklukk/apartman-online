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
      where private.staff_can('players.read',m.building_id)
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
      where private.staff_can('economy.read',b.id)
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

create function private.staff_update_economy(target_building uuid,setting_key text,new_value integer,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare previous integer;
begin
 perform private.staff_game_write_check('economy.settings.manage',target_building,reason);
 if setting_key not in ('initial_balance','daily_salary','side_job_reward','weekly_dues',
   'cleaning_base','cleaning_per_resident','maintenance_base','maintenance_per_resident')
   or setting_key is null then raise exception 'Bilinmeyen ekonomi parametresi.'; end if;
 if new_value is null or new_value<0 or new_value>1000000
   or (setting_key='weekly_dues' and (new_value<1 or new_value>100000))
   then raise exception 'Geçersiz ekonomi parametresi.'; end if;
 perform 1 from public.buildings where id=target_building for update;
 select (to_jsonb(s)->>setting_key)::integer into strict previous
 from public.economy_settings s where building_id=target_building for update;
 if previous=new_value then return; end if;
 execute format('update public.economy_settings set %I=$1 where building_id=$2',setting_key)
 using new_value,target_building;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'economy.setting','building',target_building::text,
   jsonb_build_object('key',setting_key,'value',previous),
   jsonb_build_object('key',setting_key,'value',new_value),btrim(reason));
end $$;
create function public.staff_update_economy(target_building uuid,setting_key text,new_value integer,reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_update_economy(target_building,setting_key,new_value,reason)
$$;

create function private.staff_rename_player(target_user uuid,new_username text,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare b uuid; old_username text;
begin
 select building_id into b from public.memberships where user_id=target_user;
 perform private.staff_game_write_check('players.profile.edit',b,reason);
 if new_username is null or new_username !~ '^[A-Za-z0-9_]{3,20}$' then
   raise exception 'Kullanıcı adı 3–20 karakter olmalı.';
 end if;
 select username into strict old_username from public.profiles where id=target_user for update;
 if old_username=new_username then return; end if;
 update public.profiles set username=new_username where id=target_user;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'player.rename','user',target_user::text,to_jsonb(old_username),to_jsonb(new_username),btrim(reason));
end $$;
create function public.staff_rename_player(target_user uuid,new_username text,reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_rename_player(target_user,new_username,reason)
$$;

-- Private data stays inaccessible to client sessions; only checked RPCs are executable.
revoke all on function private.staff_game_overview(),
 private.staff_game_write_check(text,uuid,text),
 private.staff_adjust_wallet(uuid,integer,uuid,text),
 private.staff_adjust_treasury(uuid,integer,uuid,text),
 private.staff_update_economy(uuid,text,integer,text),
 private.staff_rename_player(uuid,text,text) from public,anon,authenticated;
grant execute on function private.staff_game_overview(),
 private.staff_adjust_wallet(uuid,integer,uuid,text),
 private.staff_adjust_treasury(uuid,integer,uuid,text),
 private.staff_update_economy(uuid,text,integer,text),
 private.staff_rename_player(uuid,text,text) to authenticated;

revoke all on function public.staff_game_overview(),
 public.staff_adjust_wallet(uuid,integer,uuid,text),
 public.staff_adjust_treasury(uuid,integer,uuid,text),
 public.staff_update_economy(uuid,text,integer,text),
 public.staff_rename_player(uuid,text,text) from public,anon;
grant execute on function public.staff_game_overview(),
 public.staff_adjust_wallet(uuid,integer,uuid,text),
 public.staff_adjust_treasury(uuid,integer,uuid,text),
 public.staff_update_economy(uuid,text,integer,text),
 public.staff_rename_player(uuid,text,text) to authenticated;
