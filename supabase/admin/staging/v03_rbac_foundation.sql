-- APARTMAN v0.3 RBAC foundation: staging SQL; convert with Supabase CLI migration new before deployment.
-- No account is auto-promoted. Live game data is not modified by this file until an explicit migration rollout.
-- All authority is enforced by PostgreSQL, not React or editable user_metadata.

create table private.staff_roles (
  id bigint generated always as identity primary key,
  code text unique not null check (code ~ '^[a-z][a-z0-9_]{2,49}$'),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '',
  system_role boolean not null default false
);
create table private.staff_permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_.]{2,79}$'),
  category text not null, title text not null, description text not null default ''
);
create table private.staff_role_permissions (
  role_id bigint not null references private.staff_roles(id) on delete cascade,
  permission_code text not null references private.staff_permissions(code),
  primary key (role_id,permission_code)
);
create table private.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id bigint not null references private.staff_roles(id),
  scope_kind text not null check(scope_kind in ('global','building')),
  scope_id uuid not null,
  expires_at timestamptz,
  granted_at timestamptz not null default clock_timestamp(),
  granted_by uuid references auth.users(id),
  unique(user_id,role_id,scope_kind,scope_id),
  check ((scope_kind='global' and scope_id='00000000-0000-0000-0000-000000000000'::uuid)
    or (scope_kind='building' and scope_id<>'00000000-0000-0000-0000-000000000000'::uuid))
);
create index staff_assignments_user on private.staff_assignments(user_id);
create table private.staff_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  old_value jsonb,
  new_value jsonb,
  reason text not null check(char_length(btrim(reason)) between 5 and 500),
  created_at timestamptz not null default clock_timestamp()
);
create index staff_audit_created on private.staff_audit(created_at desc);

insert into private.staff_roles(code,title,description,system_role) values
 ('super_admin','Süper Yönetici','Bütün mevcut ve gelecekteki izinleri kapsayan en üst yetki.',true),
 ('admin','Yönetici','Oyuncu, ekonomi, apartman ve seçim operasyonları.',true),
 ('moderator','Moderatör','Sohbet, oyuncu ve şikâyet denetimi.',true),
 ('editor','Editör','Duyuru, içerik ve oyun olayı hazırlığı.',true);

insert into private.staff_permissions(code,category,title) values
 ('staff.roles.read','Yetkiler','Rol ve izinleri görüntüle'),
 ('staff.roles.manage','Yetkiler','Rolleri ve atamaları yönet'),
 ('staff.audit.read','Denetim','Yönetici işlem geçmişini görüntüle'),
 ('players.read','Oyuncular','Oyuncuları görüntüle'),
 ('players.moderate','Oyuncular','Susturma ve uyarı işlemleri'),
 ('players.ban','Oyuncular','Oyuncu yasaklama ve yasağı kaldırma'),
 ('players.profile.edit','Oyuncular','Profil bilgilerini düzenle'),
 ('players.move','Oyuncular','Daire ve yerleşim değişiklikleri'),
 ('economy.read','Ekonomi','Ekonomik bilgileri denetle'),
 ('economy.wallet.adjust','Ekonomi','Oyuncu cüzdanı düzeltmeleri'),
 ('economy.settings.manage','Ekonomi','Maaş, aidat ve gider ayarları'),
 ('economy.dues.manage','Ekonomi','Aidat ve borç düzeltmeleri'),
 ('economy.treasury.adjust','Ekonomi','Ortak kasa düzeltmeleri'),
 ('governance.read','Seçimler','Seçimleri görüntüle'),
 ('governance.elections.manage','Seçimler','Seçim başlatma, durdurma ve yeniden planlama'),
 ('governance.elections.override','Seçimler','Kurallardan bağımsız seçim müdahalesi'),
 ('governance.manager.appoint','Seçimler','Yönetici atama ve görevden alma'),
 ('world.buildings.read','Dünya','Apartmanları görüntüle'),
 ('world.buildings.rename','Dünya','Apartman adlarını düzenle'),
 ('world.structure.manage','Dünya','Apartman, mahalle ve şehir yapısını yönet'),
 ('content.announcements.manage','İçerik','Duyuruları yönet'),
 ('content.events.manage','İçerik','Olayları ve etkinlikleri yönet'),
 ('system.features.manage','Sistem','Oyun özelliklerini açıp kapat'),
 ('system.maintenance.manage','Sistem','Bakım ve acil müdahale'),
 ('system.bulk.manage','Sistem','Toplu yönetim işlemleri');

-- "super_admin" is wildcard authority, evaluated live; no permission list to keep synchronized.
insert into private.staff_role_permissions(role_id,permission_code)
select r.id,p.code from private.staff_roles r cross join private.staff_permissions p
where (r.code='admin' and p.code in (
 'staff.roles.read','staff.audit.read','players.read','players.moderate','players.ban',
 'players.profile.edit','players.move','economy.read','economy.wallet.adjust','economy.settings.manage',
 'economy.dues.manage','economy.treasury.adjust','governance.read','governance.elections.manage',
 'governance.manager.appoint','world.buildings.read','world.buildings.rename',
 'content.announcements.manage','content.events.manage'))
or (r.code='moderator' and p.code in ('players.read','players.moderate','governance.read'))
or (r.code='editor' and p.code in ('content.announcements.manage','content.events.manage','world.buildings.read'));

-- Future roles and permissions can be registered without modifying this schema.
-- Scoped grants are global or building-level in this release. City/neighborhood support extends the resolver later.
create function private.staff_is_super() returns boolean
language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from private.staff_assignments a
  join private.staff_roles r on r.id=a.role_id
  where a.user_id=(select auth.uid()) and r.code='super_admin'
  and a.scope_kind='global'
  and (a.expires_at is null or a.expires_at>clock_timestamp())
 )
$$;
create function private.staff_can(p text,b uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from private.staff_assignments a
  join private.staff_roles r on r.id=a.role_id
  where a.user_id=(select auth.uid()) and (a.expires_at is null or a.expires_at>clock_timestamp())
  and (a.scope_kind='global' or (b is not null and a.scope_kind='building' and a.scope_id=b))
  and (r.code='super_admin' or exists (
    select 1 from private.staff_role_permissions rp where rp.role_id=r.id and rp.permission_code=p
  ))
 )
$$;

-- Safe account capability discovery: never exposes another user's grants.
create function private.staff_me() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'roles',coalesce((
   select jsonb_agg(jsonb_build_object('code',r.code,'title',r.title,'scope_kind',a.scope_kind,'scope_id',a.scope_id))
   from private.staff_assignments a join private.staff_roles r on r.id=a.role_id
   where a.user_id=(select auth.uid()) and (a.expires_at is null or a.expires_at>clock_timestamp())
  ),'[]'::jsonb),
  'permissions',coalesce((
   select jsonb_agg(distinct p.code)
   from private.staff_permissions p
   where private.staff_can(p.code,null)
  ),'[]'::jsonb)
 )
$$;
create function public.staff_me() returns jsonb language sql security invoker set search_path='' as $$
 select private.staff_me()
$$;

-- Global staff administrator directory: never expose passwords, tokens or auth metadata.
create function private.staff_directory() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.staff_can('staff.roles.read',null) then raise exception 'Bu işlem için yetkiniz yok.'; end if;
 return jsonb_build_object(
  'roles',coalesce((select jsonb_agg(to_jsonb(x)) from (
    select r.id,r.code,r.title,r.description,r.system_role,
           coalesce(array_agg(rp.permission_code order by rp.permission_code)
             filter(where rp.permission_code is not null),array[]::text[]) as permissions
    from private.staff_roles r left join private.staff_role_permissions rp on rp.role_id=r.id
    group by r.id order by r.id
  ) x),'[]'::jsonb),
  'permissions',coalesce((select jsonb_agg(to_jsonb(p) order by p.category,p.code)
    from private.staff_permissions p),'[]'::jsonb),
  'buildings',coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from (select id,name,slug,treasury from public.buildings) b),'[]'::jsonb),
  'users',coalesce((select jsonb_agg(to_jsonb(u) order by u.username) from (
    select a.id as user_id,coalesce(p.username,'(oyuncu değil)') as username
    from auth.users a left join public.profiles p on p.id=a.id
  ) u),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by a.granted_at desc)
    from (select sa.id,sa.user_id,r.code as role,sa.scope_kind,sa.scope_id,
      sa.expires_at,sa.granted_at from private.staff_assignments sa join private.staff_roles r on r.id=sa.role_id) a),'[]'::jsonb),
  'audit',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc)
    from (select action,actor_id,target_type,target_id,reason,created_at from private.staff_audit
      order by created_at desc limit 50) l),'[]'::jsonb)
 );
end $$;
create function public.staff_directory() returns jsonb language sql security invoker set search_path='' as $$
 select private.staff_directory()
$$;

-- Delegation is reserved to a global super admin. No client can directly mutate private records.
create function private.staff_grant(target_user uuid,role_code text,target_scope text,scope uuid,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r private.staff_roles; s uuid;
begin
 if not private.staff_is_super() then raise exception 'Süper Yönetici yetkisi gerekli.'; end if;
 if char_length(btrim(coalesce(reason,''))) not between 5 and 500 then raise exception 'Gerekçe 5–500 karakter olmalı.'; end if;
 select * into strict r from private.staff_roles where code=role_code;
 if not exists(select 1 from auth.users where id=target_user) then raise exception 'Kullanıcı bulunamadı.'; end if;
 if target_scope='global' then
  s:='00000000-0000-0000-0000-000000000000'::uuid;
 elsif target_scope='building' and scope is not null and exists(select 1 from public.buildings where id=scope) then
  s:=scope;
 else raise exception 'Geçersiz yetki kapsamı.'; end if;
 if r.code='super_admin' and target_scope<>'global' then raise exception 'Süper Yönetici kapsamı global olmalı.'; end if;
 if r.code='super_admin' and coalesce(auth.jwt()->>'aal','')<>'aal2' then
  raise exception 'Süper Yönetici ataması için çok faktörlü doğrulama gerekli.';
 end if;
 insert into private.staff_assignments(user_id,role_id,scope_kind,scope_id,granted_by)
 values(target_user,r.id,target_scope,s,auth.uid())
 on conflict(user_id,role_id,scope_kind,scope_id) do nothing;
 if found then
  insert into private.staff_audit(actor_id,action,target_type,target_id,new_value,reason)
  values(auth.uid(),'role.grant','user',target_user::text,
   jsonb_build_object('role',r.code,'scope',target_scope,'scope_id',s),btrim(reason));
 end if;
end $$;
create function public.staff_grant(target_user uuid,role_code text,target_scope text,scope uuid,reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_grant(target_user,role_code,target_scope,scope,reason)
$$;

create function private.staff_revoke(assignment_id uuid,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare a private.staff_assignments; r private.staff_roles;
begin
 if not private.staff_is_super() then raise exception 'Süper Yönetici yetkisi gerekli.'; end if;
 if char_length(btrim(coalesce(reason,''))) not between 5 and 500 then raise exception 'Gerekçe 5–500 karakter olmalı.'; end if;
 select * into strict a from private.staff_assignments where id=assignment_id for update;
 select * into strict r from private.staff_roles where id=a.role_id;
 if r.code='super_admin' and a.scope_kind='global' then
  perform 1 from private.staff_roles where code='super_admin' for update;
  if (select count(*) from private.staff_assignments sa join private.staff_roles sr on sr.id=sa.role_id
      where sr.code='super_admin' and sa.scope_kind='global' and (sa.expires_at is null or sa.expires_at>clock_timestamp()))<=1
  then raise exception 'Son Süper Yönetici yetkisi kaldırılamaz.'; end if;
  if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Çok faktörlü doğrulama gerekli.'; end if;
 end if;
 delete from private.staff_assignments where id=assignment_id;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,reason)
 values(auth.uid(),'role.revoke','user',a.user_id::text,
 jsonb_build_object('role',r.code,'scope',a.scope_kind,'scope_id',a.scope_id),btrim(reason));
end $$;
create function public.staff_revoke(assignment_id uuid,reason text) returns void
language sql security invoker set search_path='' as $$ select private.staff_revoke(assignment_id,reason) $$;

-- New custom roles can be created at runtime without adding columns or changing the permission architecture.
create function private.staff_create_role(role_code text,role_title text,role_description text,permission_codes text[],reason text)
returns void language plpgsql security definer set search_path='' as $$
declare rid bigint;
begin
 if not private.staff_is_super() then raise exception 'Süper Yönetici yetkisi gerekli.'; end if;
 if role_code !~ '^[a-z][a-z0-9_]{2,49}$' or char_length(btrim(coalesce(role_title,''))) not between 3 and 80
  then raise exception 'Geçersiz rol bilgileri.'; end if;
 if char_length(btrim(coalesce(reason,''))) not between 5 and 500 then raise exception 'Gerekçe 5–500 karakter olmalı.'; end if;
 if exists(select 1 from unnest(permission_codes) x where not exists(select 1 from private.staff_permissions p where p.code=x))
  then raise exception 'Kayıtlı olmayan izin kodu.'; end if;
 insert into private.staff_roles(code,title,description) values(role_code,btrim(role_title),coalesce(role_description,'')) returning id into rid;
 insert into private.staff_role_permissions(role_id,permission_code) select rid,distinct_permissions.code
 from (select distinct unnest(permission_codes) as code) distinct_permissions;
 insert into private.staff_audit(actor_id,action,target_type,target_id,new_value,reason)
 values(auth.uid(),'role.create','role',role_code,to_jsonb(permission_codes),btrim(reason));
end $$;
create function public.staff_create_role(role_code text,role_title text,role_description text,permission_codes text[],reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_create_role(role_code,role_title,role_description,permission_codes,reason)
$$;
create function private.staff_set_role_permissions(role_code text,permission_codes text[],reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r private.staff_roles; previous text[];
begin
 if not private.staff_is_super() then raise exception 'Süper Yönetici yetkisi gerekli.'; end if;
 if char_length(btrim(coalesce(reason,''))) not between 5 and 500 then raise exception 'Gerekçe 5–500 karakter olmalı.'; end if;
 select * into strict r from private.staff_roles where code=role_code for update;
 if r.system_role then raise exception 'Yerleşik rollerin izinleri bu ekranda düzenlenemez.'; end if;
 if exists(select 1 from unnest(permission_codes) x where not exists(select 1 from private.staff_permissions p where p.code=x))
  then raise exception 'Kayıtlı olmayan izin kodu.'; end if;
 select coalesce(array_agg(permission_code),array[]::text[]) into previous from private.staff_role_permissions where role_id=r.id;
 delete from private.staff_role_permissions where role_id=r.id;
 insert into private.staff_role_permissions(role_id,permission_code)
 select r.id,x.code from (select distinct unnest(permission_codes) as code) x;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'role.permissions','role',role_code,to_jsonb(previous),to_jsonb(permission_codes),btrim(reason));
end $$;
create function public.staff_set_role_permissions(role_code text,permission_codes text[],reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_set_role_permissions(role_code,permission_codes,reason)
$$;

-- First real game operation using the generic permission resolver.
create function private.staff_rename_building(target_building uuid,new_name text,reason text)
returns void language plpgsql security definer set search_path='' as $$
declare old_name text;
begin
 if not private.staff_can('world.buildings.rename',target_building) then raise exception 'Yetkiniz yok.'; end if;
 if char_length(btrim(coalesce(new_name,''))) not between 3 and 80 then raise exception 'Apartman adı 3–80 karakter olmalı.'; end if;
 if char_length(btrim(coalesce(reason,''))) not between 5 and 500 then raise exception 'Gerekçe 5–500 karakter olmalı.'; end if;
 select name into strict old_name from public.buildings where id=target_building for update;
 update public.buildings set name=btrim(new_name) where id=target_building;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason)
 values(auth.uid(),'building.rename','building',target_building::text,to_jsonb(old_name),to_jsonb(btrim(new_name)),btrim(reason));
end $$;
create function public.staff_rename_building(target_building uuid,new_name text,reason text)
returns void language sql security invoker set search_path='' as $$
 select private.staff_rename_building(target_building,new_name,reason)
$$;

-- No privilege on private tables, even for authenticated staff; only the checked functions.
do $$ declare tab text; begin
 foreach tab in array array['staff_roles','staff_permissions','staff_role_permissions','staff_assignments','staff_audit'] loop
  execute format('alter table private.%I enable row level security',tab);
  execute format('revoke all on private.%I from public,anon,authenticated',tab);
 end loop;
end $$;
revoke all on function private.staff_is_super(),private.staff_can(text,uuid),
 private.staff_me(),private.staff_directory(),private.staff_grant(uuid,text,text,uuid,text),
 private.staff_revoke(uuid,text),private.staff_create_role(text,text,text,text[],text),
 private.staff_set_role_permissions(text,text[],text),private.staff_rename_building(uuid,text,text)
 from public,anon,authenticated;
grant execute on function private.staff_me(),private.staff_directory(),private.staff_grant(uuid,text,text,uuid,text),
 private.staff_revoke(uuid,text),private.staff_create_role(text,text,text,text[],text),
 private.staff_set_role_permissions(text,text[],text),private.staff_rename_building(uuid,text,text)
 to authenticated;
revoke all on function public.staff_me(),public.staff_directory(),public.staff_grant(uuid,text,text,uuid,text),
 public.staff_revoke(uuid,text),public.staff_create_role(text,text,text,text[],text),
 public.staff_set_role_permissions(text,text[],text),public.staff_rename_building(uuid,text,text)
 from public,anon;
grant execute on function public.staff_me(),public.staff_directory(),public.staff_grant(uuid,text,text,uuid,text),
 public.staff_revoke(uuid,text),public.staff_create_role(text,text,text,text[],text),
 public.staff_set_role_permissions(text,text[],text),public.staff_rename_building(uuid,text,text)
 to authenticated;

-- BOOTSTRAP IS INTENTIONALLY NOT AUTOMATED:
-- After the owner confirms THEIR Auth UUID, an authorized SQL Editor operator runs:
-- INSERT INTO private.staff_assignments(user_id,role_id,scope_kind,scope_id)
-- SELECT '<VERIFIED_OWNER_AUTH_UUID>'::uuid,r.id,'global','00000000-0000-0000-0000-000000000000'::uuid
-- FROM private.staff_roles r WHERE r.code='super_admin';
-- Never match by username, email substring, "first account", or public client metadata.
