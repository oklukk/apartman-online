-- Definitions only: no world, approval, NPC, home, actor or skill is seeded here.
set local lock_timeout='5s';

create table private.npc_worlds (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[a-z][a-z0-9_]{2,79}$'),
 mode text not null check(mode in ('pilot','world')),
 population_limit integer not null check(population_limit>0),
 approval_ref text not null check(char_length(btrim(approval_ref)) between 3 and 200),
 reason text not null check(char_length(btrim(reason)) between 5 and 500),
 approved_by text not null default session_user,
 approved_at timestamptz not null default clock_timestamp(),
 guard_revision bigint not null default 0 check(guard_revision>=0),
 unique(id,mode), check(mode<>'pilot' or population_limit=2)
);
create table private.npc_plan_approvals (
 id uuid primary key default gen_random_uuid(), world_id uuid not null,
 code text not null check(code ~ '^[a-z][a-z0-9_]{2,79}$'),
 scope text not null check(scope in ('pilot','world')),
 spec jsonb not null check(jsonb_typeof(spec)='object'),
 approval_ref text not null check(char_length(btrim(approval_ref)) between 3 and 200),
 reason text not null check(char_length(btrim(reason)) between 5 and 500),
 approved_by text not null default session_user,
 approved_at timestamptz not null default clock_timestamp(),
 foreign key(world_id,scope) references private.npc_worlds(id,mode) on delete restrict,
 unique(world_id,code), unique(id,world_id,scope)
);
-- No retiring/replacing a pilot to reset budget. Future lifecycle needs separate review.
create unique index npc_one_pilot_approval on private.npc_plan_approvals(world_id) where scope='pilot';
create table private.npc_plan_bindings (
 plan_id uuid primary key references private.npc_population_plans(id) on delete restrict deferrable initially deferred,
 approval_id uuid not null unique,
 world_id uuid not null, scope text not null,
 foreign key(approval_id,world_id,scope) references private.npc_plan_approvals(id,world_id,scope) on delete restrict,
 unique(plan_id,world_id)
);
create index npc_bindings_world on private.npc_plan_bindings(world_id);
create unique index npc_one_pilot_binding on private.npc_plan_bindings(world_id) where scope='pilot';
create table private.npc_building_keys (
 plan_id uuid not null, world_id uuid not null,
 stable_key text not null check(stable_key ~ '^[a-z][a-z0-9_]{2,79}$'),
 building_id uuid not null unique,
 primary key(world_id,stable_key), unique(plan_id,stable_key),
 foreign key(plan_id,world_id) references private.npc_plan_bindings(plan_id,world_id) on delete restrict,
 foreign key(building_id,plan_id) references private.npc_buildings(id,plan_id) on delete restrict
);
create table private.npc_actor_keys (
 plan_id uuid not null, world_id uuid not null,
 stable_key text not null check(stable_key ~ '^[a-z][a-z0-9_]{2,79}$'),
 actor_id uuid not null unique references private.bot_profiles(actor_id) on delete restrict,
 primary key(world_id,stable_key), unique(plan_id,stable_key),
 foreign key(plan_id,world_id) references private.npc_plan_bindings(plan_id,world_id) on delete restrict
);

create function private.npc_owner_check() returns void language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'postgres' then raise exception using errcode='42501',message='NPC işlemi yalnız veritabanı sahibine açıktır.';end if;
end $$;
create function private.npc_exact_keys(v jsonb,expected text[]) returns boolean
language sql immutable security invoker set search_path='' as $$
 select case when jsonb_typeof(v)='object' then
   (select array_agg(k order by k) from jsonb_object_keys(v) k)=(select array_agg(k order by k) from unnest(expected) k)
 else false end
$$;
create function private.npc_check_spec(s jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare b jsonb; f jsonb; t text; required jsonb; expected jsonb; cap integer;
begin
 if not coalesce(private.npc_exact_keys(s,array['code','scope','population_limit','required_teaching_fields','buildings','bots']),false)
   or jsonb_typeof(s->'code')<>'string' or (s->>'code')!~'^[a-z][a-z0-9_]{2,79}$'
   or jsonb_typeof(s->'scope')<>'string' or s->>'scope' not in ('pilot','world')
   or jsonb_typeof(s->'population_limit')<>'number' or (s->>'population_limit')!~'^(0|[1-9][0-9]*)$'
   or jsonb_typeof(s->'buildings')<>'array' or jsonb_typeof(s->'bots')<>'array'
   or jsonb_typeof(s->'required_teaching_fields')<>'array' then
   raise exception using errcode='23514',message='Eksiksiz ve açık NPC plan alanları gerekli.';
 end if;
 if jsonb_array_length(s->'buildings')=0 or jsonb_array_length(s->'bots')>(s->>'population_limit')::integer then
   raise exception using errcode='23514',message='NPC planı konut ve nüfus sınırını sağlamalı.';
 end if;
 for b in select value from jsonb_array_elements(s->'buildings') loop
   if not coalesce(private.npc_exact_keys(b,array['key','name','capacity']),false)
     or jsonb_typeof(b->'key')<>'string' or (b->>'key')!~'^[a-z][a-z0-9_]{2,79}$'
     or jsonb_typeof(b->'name')<>'string' or char_length(btrim(b->>'name')) not between 1 and 100
     or jsonb_typeof(b->'capacity')<>'number' or (b->>'capacity')!~'^[1-9][0-9]*$' then
     raise exception using errcode='23514',message='Geçerli NPC bina anahtarı, adı ve kapasitesi gerekli.';
   end if;
 end loop;
 if (select count(distinct value->>'key') from jsonb_array_elements(s->'buildings'))<>jsonb_array_length(s->'buildings')
   or (select count(distinct value->>'key') from jsonb_array_elements(s->'bots'))<>jsonb_array_length(s->'bots') then
   raise exception using errcode='23514',message='Plan içi kalıcı anahtar tekrarlanamaz.';
 end if;
 for b in select value from jsonb_array_elements(s->'bots') loop
   if not coalesce(private.npc_exact_keys(b,array['key','name','building_key','home_number','role','field','teaching_fields','levels']),false)
     or jsonb_typeof(b->'key')<>'string' or (b->>'key')!~'^[a-z][a-z0-9_]{2,79}$'
     or jsonb_typeof(b->'name')<>'string' or char_length(btrim(b->>'name')) not between 1 and 100
     or jsonb_typeof(b->'building_key')<>'string' or jsonb_typeof(b->'home_number')<>'number'
     or (b->>'home_number')!~'^[1-9][0-9]*$' or jsonb_typeof(b->'role')<>'string' or b->>'role' not in ('worker','operator','lecturer')
     or jsonb_typeof(b->'field')<>'string' or jsonb_typeof(b->'teaching_fields')<>'array'
     or jsonb_typeof(b->'levels')<>'object' then
     raise exception using errcode='23514',message='Eksiksiz sabit NPC profili gerekli.';
   end if;
   perform (b->>'field')::private.actor_skill_code;
   select (value->>'capacity')::integer into cap from jsonb_array_elements(s->'buildings') where value->>'key'=b->>'building_key';
   if cap is null or (b->>'home_number')::integer>cap then raise exception using errcode='23514',message='NPC yalnız planın kendi konutuna bağlanabilir.';end if;
   for f in select value from jsonb_array_elements(b->'teaching_fields') loop
     if jsonb_typeof(f)<>'string' then raise exception using errcode='23514',message='Öğretim alan kodu gerekli.';end if;
     perform (f#>>'{}')::private.actor_skill_code;
   end loop;
   if (select count(distinct value) from jsonb_array_elements(b->'teaching_fields'))<>jsonb_array_length(b->'teaching_fields') then
     raise exception using errcode='23514',message='Öğretim alanı tekrarlanamaz.';
   end if;
   if b->>'role'='lecturer' then
     if not (b->'teaching_fields' ? (b->>'field')) then raise exception using errcode='23514',message='NPC temel alanını öğretmeli.';end if;
     expected:=jsonb_build_object('basic_teaching',case when b->'teaching_fields' ? 'basic_teaching' then 6 else 5 end,
       'advanced_teaching',case when b->'teaching_fields' ? 'advanced_teaching' then 6 else 3 end)
       ||(select jsonb_object_agg(value,6) from jsonb_array_elements_text(b->'teaching_fields'));
   else
     if jsonb_array_length(b->'teaching_fields')<>0 then raise exception using errcode='23514',message='Çalışan/işletmeci ders alanı taşıyamaz.';end if;
     expected:=jsonb_build_object(b->>'field',case when b->>'role'='worker' then 3 else 4 end);
     if b->>'role'='operator' then expected:=expected||'{"business":4}'::jsonb;end if;
   end if;
   if b->'levels'<>expected or exists(select 1 from jsonb_each(b->'levels') where jsonb_typeof(value)<>'number' or (value#>>'{}')!~'^[0-9]+$') then
     raise exception using errcode='23514',message='Yalnız gerekli sabit rol yetenekleri kabul edilir.';
   end if;
 end loop;
 if (select count(distinct jsonb_build_array(value->'building_key',value->'home_number')) from jsonb_array_elements(s->'bots'))<>jsonb_array_length(s->'bots') then
   raise exception using errcode='23514',message='İki NPC aynı konuta atanamaz.';
 end if;
 required:=s->'required_teaching_fields';
 for f in select value from jsonb_array_elements(required) loop
   if jsonb_typeof(f)<>'string' then raise exception using errcode='23514',message='Alan kodu gerekli.';end if;
   t:=f#>>'{}';perform t::private.actor_skill_code;
   if not exists(select 1 from jsonb_array_elements(s->'bots') x where x->>'role'='lecturer' and x->'teaching_fields' ? t) then
     raise exception using errcode='23514',message='Her planlanan öğretim alanı nitelikli NPC ile kapsanmalı.';
   end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements(required))<>jsonb_array_length(required) then
   raise exception using errcode='23514',message='Gerekli alan tekrarlanamaz.';
 end if;
 if s->>'scope'='pilot' and ((s->>'population_limit')::integer<>2 or jsonb_array_length(s->'buildings')<>1
   or (s->'buildings'->0->>'capacity')::integer<>12 or jsonb_array_length(s->'bots')<>2
   or jsonb_array_length(required)<>2 or not(required @> '["plumbing","business"]'::jsonb)
   or (select count(distinct value->>'field') from jsonb_array_elements(s->'bots'))<>2
   or exists(select 1 from jsonb_array_elements(s->'bots') x where x->>'role'<>'lecturer' or x->>'field' not in ('plumbing','business')
      or x->'teaching_fields'<>jsonb_build_array(x->>'field'))) then
   raise exception using errcode='23514',message='Pilot tek12 konut ve iki ayrı Tesisat/İşletmecilik öğretim görevlisi ister.';
 end if;
end $$;

create function private.npc_no_unbound_plans() returns void language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from private.npc_population_plans p where not exists(select 1 from private.npc_plan_bindings b where b.plan_id=p.id)) then
   raise exception using errcode='23514',message='Dünya/onay bağı olmayan eski NPC planı var; ayrı kontrollü geçiş gerekli.';
 end if;
end $$;
create function private.npc_lock_world(target uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 update private.npc_worlds set guard_revision=guard_revision+1 where id=target;
 if not found then raise exception using errcode='23503',message='Onaylı dünya kaydı bulunamadı.';end if;
end $$;
create function private.npc_approval_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare w private.npc_worlds;
begin
 perform private.npc_check_spec(new.spec);
 select * into strict w from private.npc_worlds where id=new.world_id;
 if new.code is distinct from new.spec->>'code' or new.scope is distinct from new.spec->>'scope'
   or new.scope<>w.mode or (new.spec->>'population_limit')::integer>w.population_limit then
   raise exception using errcode='23514',message='Onay kaydı dünya bütçesi ve kendi snapshot ile eşleşmeli.';end if;
 return new;
end $$;
create trigger npc_approval_valid before insert on private.npc_plan_approvals for each row execute function private.npc_approval_guard();
create function private.npc_fixed_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and TG_TABLE_NAME='npc_worlds' then
   if (to_jsonb(new)-'guard_revision')=(to_jsonb(old)-'guard_revision') and new.guard_revision=old.guard_revision+1 then return new;end if;
 end if;
 raise exception using errcode='23514',message='NPC dünya/onay/kalıcı anahtar kayıtları değişmez; ayrı geçiş gerekir.';
end $$;
create function private.npc_world_fence() returns trigger language plpgsql security invoker set search_path='' as $$
declare w uuid; p uuid;
begin
 if TG_TABLE_NAME in ('npc_plan_bindings','npc_building_keys','npc_actor_keys') then w:=new.world_id;
 else
   if TG_TABLE_NAME='npc_population_plans' then p:=new.id;else p:=new.plan_id;end if;
   select world_id into w from private.npc_plan_bindings where plan_id=p;
   if not found then raise exception using errcode='23514',message='NPC yazması önceden onaylı dünya/plan bağı ister.';end if;
 end if;
 perform private.npc_lock_world(w);return new;
end $$;

create function private.npc_assert_teaching_coverage(target_plan uuid,required private.actor_skill_code[]) returns void
language plpgsql security invoker set search_path='' as $$
declare f private.actor_skill_code;
begin
 perform private.npc_owner_check();
 if required is null or array_position(required,null) is not null or not exists(select 1 from private.npc_plan_bindings where plan_id=target_plan) then
   raise exception using errcode='23514',message='Onaylı plan ve açık öğretim alanları gerekli.';end if;
 foreach f in array required loop
   if not exists(select 1 from private.bot_profiles b
     join private.actor_skills a on a.actor_id=b.actor_id and a.skill=f and a.level>=6
     join private.actor_skills t on t.actor_id=b.actor_id and t.skill='basic_teaching' and t.level>=5
     join private.actor_skills i on i.actor_id=b.actor_id and i.skill='advanced_teaching' and i.level>=3
     where b.plan_id=target_plan and b.role='lecturer' and f=any(b.teaching_fields)) then
     raise exception using errcode='23514',message='Alan için nitelikli sabit öğretim görevlisi eksik.';
   end if;
 end loop;
end $$;

create function private.npc_assert_provisioned(target_plan uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare bind private.npc_plan_bindings; a private.npc_plan_approvals; p private.npc_population_plans;
 b jsonb; bot private.bot_profiles; actor uuid; values_json jsonb;
begin
 perform private.npc_no_unbound_plans();
 select * into strict bind from private.npc_plan_bindings where plan_id=target_plan;
 select * into strict a from private.npc_plan_approvals where id=bind.approval_id;
 perform private.npc_check_spec(a.spec);
 select * into strict p from private.npc_population_plans where id=target_plan;
 if p.code<>'np_'||replace(a.id::text,'-','') or p.scope<>a.scope or p.population_limit<>(a.spec->>'population_limit')::integer then
   raise exception using errcode='23514',message='NPC planı onay snapshot ile aynı olmalı.';end if;
 perform private.a1_assert_plan(target_plan);
 if (select count(*) from private.npc_buildings where plan_id=target_plan)<>jsonb_array_length(a.spec->'buildings')
   or (select count(*) from private.npc_building_keys where plan_id=target_plan)<>jsonb_array_length(a.spec->'buildings')
   or (select count(*) from private.bot_profiles where plan_id=target_plan)<>jsonb_array_length(a.spec->'bots')
   or (select count(*) from private.npc_actor_keys where plan_id=target_plan)<>jsonb_array_length(a.spec->'bots') then
   raise exception using errcode='23514',message='Eksik/fazla NPC ya da bina onayla eşleşmiyor.';end if;
 for b in select value from jsonb_array_elements(a.spec->'buildings') loop
   if not exists(select 1 from private.npc_building_keys k join private.npc_buildings n on n.id=k.building_id
     where k.plan_id=target_plan and k.stable_key=b->>'key' and n.name=b->>'name' and n.capacity=(b->>'capacity')::integer) then
     raise exception using errcode='23514',message='NPC bina snapshot eşleşmiyor.';end if;
 end loop;
 for b in select value from jsonb_array_elements(a.spec->'bots') loop
   select actor_id into actor from private.npc_actor_keys where plan_id=target_plan and stable_key=b->>'key';
   select * into bot from private.bot_profiles where actor_id=actor;
   if not found or bot.plan_id<>target_plan or bot.display_name<>b->>'name' or bot.role::text<>b->>'role'
     or bot.field::text<>b->>'field' or to_jsonb(bot.teaching_fields)<>b->'teaching_fields'
     or not exists(select 1 from private.npc_homes h join private.npc_building_keys k on k.building_id=h.building_id
       where h.id=bot.home_id and k.plan_id=target_plan and k.stable_key=b->>'building_key' and h.number=(b->>'home_number')::integer) then
     raise exception using errcode='23514',message='NPC profil/konut snapshot eşleşmiyor.';end if;
   perform private.a1_assert_actor(actor);
   select jsonb_object_agg(skill::text,level) into values_json from private.actor_skills where actor_id=actor;
   if values_json<>b->'levels' then raise exception using errcode='23514',message='NPC sabit yetenek snapshot eşleşmiyor.';end if;
 end loop;
 perform private.npc_assert_teaching_coverage(target_plan,array(select jsonb_array_elements_text(a.spec->'required_teaching_fields'))::private.actor_skill_code[]);
 if (select count(*) from private.bot_profiles b join private.npc_plan_bindings n on n.plan_id=b.plan_id where n.world_id=bind.world_id)
   >(select population_limit from private.npc_worlds where id=bind.world_id) then
   raise exception using errcode='23514',message='Ortak dünya nüfus bütçesi aşılamaz.';end if;
end $$;
create function private.npc_complete_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_TABLE_NAME='npc_population_plans' then perform private.npc_assert_provisioned(new.id);
 else perform private.npc_assert_provisioned(new.plan_id);end if;
 return null;
end $$;

create function private.register_npc_world(world_code text,world_mode text,world_limit integer,approval_ref text,reason text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare w private.npc_worlds;
begin
 perform private.npc_owner_check();perform private.npc_no_unbound_plans();
 insert into private.npc_worlds(code,mode,population_limit,approval_ref,reason) values(world_code,world_mode,world_limit,approval_ref,reason)
 on conflict(code) do nothing;
 select * into strict w from private.npc_worlds where code=world_code;
 if w.mode is distinct from world_mode or w.population_limit is distinct from world_limit
   or w.approval_ref is distinct from approval_ref or w.reason is distinct from reason then
   raise exception using errcode='23514',message='Dünya anahtarı farklı onayla yeniden kullanılamaz.';end if;
 return w.id;
end $$;
create function private.approve_npc_plan(target_world uuid,spec jsonb,approval_ref text,reason text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare w private.npc_worlds; a private.npc_plan_approvals;
begin
 perform private.npc_owner_check();perform private.npc_no_unbound_plans();perform private.npc_check_spec(spec);
 select * into strict w from private.npc_worlds where id=target_world;
 if spec->>'scope'<>w.mode or (spec->>'population_limit')::integer>w.population_limit then
   raise exception using errcode='23514',message='Onay dünya kapsamı ve bütçesine uymalı.';end if;
 select * into a from private.npc_plan_approvals n where n.world_id=target_world and n.code=approve_npc_plan.spec->>'code';
 if not found then
   perform private.npc_lock_world(target_world);
   insert into private.npc_plan_approvals(world_id,code,scope,spec,approval_ref,reason)
   values(target_world,spec->>'code',spec->>'scope',spec,approval_ref,reason) on conflict(world_id,code) do nothing;
   select * into strict a from private.npc_plan_approvals n where n.world_id=target_world and n.code=approve_npc_plan.spec->>'code';
 end if;
 if a.spec is distinct from spec or a.approval_ref is distinct from approval_ref or a.reason is distinct from reason then
   raise exception using errcode='23514',message='Plan anahtarı farklı içerik/onayla tekrar kullanılamaz.';end if;
 return a.id;
end $$;
create function private.npc_plan_result(target_plan uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('plan_id',n.plan_id,'world_id',n.world_id,'approval_id',n.approval_id,
   'buildings',coalesce((select jsonb_object_agg(k.stable_key,jsonb_build_object('id',k.building_id,'homes',(
      select jsonb_object_agg(h.number::text,h.id) from private.npc_homes h where h.building_id=k.building_id)))
      from private.npc_building_keys k where k.plan_id=n.plan_id),'{}'::jsonb),
   'bots',coalesce((select jsonb_object_agg(k.stable_key,k.actor_id) from private.npc_actor_keys k where k.plan_id=n.plan_id),'{}'::jsonb))
 from private.npc_plan_bindings n where n.plan_id=target_plan
$$;
create function private.provision_npc_plan(target_approval uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a private.npc_plan_approvals; p uuid; b jsonb; bld uuid; home uuid; actor uuid; s record;
begin
 perform private.npc_owner_check();perform private.npc_no_unbound_plans();
 select * into strict a from private.npc_plan_approvals where id=target_approval;
 select plan_id into p from private.npc_plan_bindings where approval_id=target_approval;
 if found then perform private.npc_assert_provisioned(p);return private.npc_plan_result(p);end if;
 perform private.npc_lock_world(a.world_id);
 select plan_id into p from private.npc_plan_bindings where approval_id=target_approval;
 if found then perform private.npc_assert_provisioned(p);return private.npc_plan_result(p);end if;
 perform private.npc_check_spec(a.spec);
 p:=gen_random_uuid();
 -- Deferred plan FK lets the authoritative binding exist before any legacy NPC INSERT.
 insert into private.npc_plan_bindings values(p,a.id,a.world_id,a.scope);
 insert into private.npc_population_plans(id,code,scope,population_limit) values(p,'np_'||replace(a.id::text,'-',''),a.scope,(a.spec->>'population_limit')::integer);
 for b in select value from jsonb_array_elements(a.spec->'buildings') loop
   insert into private.npc_buildings(plan_id,name,capacity) values(p,b->>'name',(b->>'capacity')::integer) returning id into bld;
   insert into private.npc_building_keys values(p,a.world_id,b->>'key',bld);
   insert into private.npc_homes(plan_id,building_id,number) select p,bld,i from generate_series(1,(b->>'capacity')::integer) i;
 end loop;
 for b in select value from jsonb_array_elements(a.spec->'bots') loop
   select h.id into strict home from private.npc_homes h join private.npc_building_keys k on k.building_id=h.building_id
     where k.plan_id=p and k.stable_key=b->>'building_key' and h.number=(b->>'home_number')::integer;
   insert into private.actors(kind) values('bot') returning id into actor;
   insert into private.bot_profiles(actor_id,plan_id,home_id,display_name,role,field,teaching_fields)
     values(actor,p,home,b->>'name',(b->>'role')::private.bot_role,(b->>'field')::private.actor_skill_code,
       array(select jsonb_array_elements_text(b->'teaching_fields'))::private.actor_skill_code[]);
   insert into private.npc_actor_keys values(p,a.world_id,b->>'key',actor);
   for s in select key,value from jsonb_each_text(b->'levels') loop
     insert into private.actor_skills values(actor,s.key::private.actor_skill_code,s.value::smallint,0);
   end loop;
 end loop;
 perform private.npc_assert_provisioned(p);return private.npc_plan_result(p);
end $$;

do $$ declare t text; f regprocedure; begin
 foreach t in array array['npc_worlds','npc_plan_approvals','npc_plan_bindings','npc_building_keys','npc_actor_keys'] loop
   execute format('alter table private.%I enable row level security',t);
   execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
   execute format('create trigger npc_fixed before update or delete on private.%I for each row execute function private.npc_fixed_guard()',t);
 end loop;
 foreach t in array array['npc_plan_bindings','npc_building_keys','npc_actor_keys','npc_population_plans','npc_buildings','npc_homes','bot_profiles'] loop
   -- Alphabetically before a1_child_insert: world -> actor -> plan, including direct DML.
   execute format('create trigger a0_npc_world_fence before insert on private.%I for each row execute function private.npc_world_fence()',t);
   execute format('create constraint trigger npc_complete after insert on private.%I deferrable initially deferred for each row execute function private.npc_complete_guard()',t);
 end loop;
 foreach f in array array[
   'private.npc_owner_check()'::regprocedure,'private.npc_exact_keys(jsonb,text[])'::regprocedure,
   'private.npc_check_spec(jsonb)'::regprocedure,'private.npc_no_unbound_plans()'::regprocedure,
   'private.npc_lock_world(uuid)'::regprocedure,'private.npc_approval_guard()'::regprocedure,'private.npc_fixed_guard()'::regprocedure,
   'private.npc_world_fence()'::regprocedure,'private.npc_assert_teaching_coverage(uuid,private.actor_skill_code[])'::regprocedure,
   'private.npc_assert_provisioned(uuid)'::regprocedure,'private.npc_complete_guard()'::regprocedure,
   'private.register_npc_world(text,text,integer,text,text)'::regprocedure,
   'private.approve_npc_plan(uuid,jsonb,text,text)'::regprocedure,'private.npc_plan_result(uuid)'::regprocedure,
   'private.provision_npc_plan(uuid)'::regprocedure] loop
   execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
end $$;
grant execute on function private.register_npc_world(text,text,integer,text,text),private.approve_npc_plan(uuid,jsonb,text,text),
 private.provision_npc_plan(uuid),private.npc_assert_teaching_coverage(uuid,private.actor_skill_code[]) to postgres;
