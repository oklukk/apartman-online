-- A2-1b schema/data representation conversion ONLY. No new actor/world/skill is granted.
set local lock_timeout='5s';
do $$ begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception using errcode='25001',message='Bu veri dönüşümü READ COMMITTED migration transaction gerektirir.';
 end if;
end $$;
-- Freeze the source cohort BEFORE copying arrays. Otherwise an NPC committed
-- between the copy and DROP COLUMN could lose its teaching relationships.
lock table private.bot_profiles in access exclusive mode;

create table private.bot_teaching_fields (
 actor_id uuid not null references private.bot_profiles(actor_id) on delete restrict,
 skill_code text not null references private.skill_catalog(code) on delete restrict,
 position integer not null check(position>0),
 primary key(actor_id,skill_code), unique(actor_id,position),
 foreign key(actor_id,skill_code) references private.actor_skills(actor_id,skill) on delete restrict deferrable initially deferred
);
alter table private.bot_teaching_fields enable row level security;
revoke all on private.bot_teaching_fields from public,anon,authenticated,service_role;

-- Convert existing ordered relationships, not a population/skill backfill or seed.
-- Install mutation triggers AFTER this copy, preserving all guard revisions and budgets.
insert into private.bot_teaching_fields(actor_id,skill_code,position)
 select b.actor_id,f.code::text,f.ordinality::integer from private.bot_profiles b
 cross join lateral unnest(b.teaching_fields) with ordinality f(code,ordinality);
-- Own array CHECKs disappear with the column. All cross-row rules are rebuilt below.
alter table private.bot_profiles drop column teaching_fields;
alter table private.bot_profiles alter column field type text using field::text;
alter table private.bot_profiles add constraint bot_profiles_catalog_fk
 foreign key(field) references private.skill_catalog(code) on delete restrict;

create function private.npc_teaching_codes(target_actor uuid) returns text[]
language sql stable security invoker set search_path='' as $$
 select coalesce(array_agg(skill_code order by position),'{}'::text[])
 from private.bot_teaching_fields where actor_id=target_actor
$$;

create function private.npc_assert_teaching_coverage_text(target_plan uuid,required text[]) returns void
language plpgsql security invoker set search_path='' as $$
declare f text;
begin
 perform private.npc_owner_check();
 if required is null or array_position(required,null) is not null or not exists(select 1 from private.npc_plan_bindings where plan_id=target_plan) then
   raise exception using errcode='23514',message='Onaylı plan ve açık öğretim alanları gerekli.';end if;
 foreach f in array required loop
   if not exists(select 1 from private.skill_catalog where code=f)
     or not exists(select 1 from private.bot_profiles b
       join private.bot_teaching_fields flds on flds.actor_id=b.actor_id and flds.skill_code=f
       join private.actor_skills a on a.actor_id=b.actor_id and a.skill=f and a.level>=6
       join private.actor_skills t on t.actor_id=b.actor_id and t.skill='basic_teaching' and t.level>=5
       join private.actor_skills i on i.actor_id=b.actor_id and i.skill='advanced_teaching' and i.level>=3
       where b.plan_id=target_plan and b.role='lecturer') then
     raise exception using errcode='23514',message='Alan için nitelikli sabit öğretim görevlisi eksik.';
   end if;
 end loop;
end $$;

-- Deliberate legacy-only skill ENUM dependency. New code calls the TEXT function.
create or replace function private.npc_assert_teaching_coverage(target_plan uuid,required private.actor_skill_code[]) returns void
language plpgsql security invoker set search_path='' as $$
begin perform private.npc_assert_teaching_coverage_text(target_plan,required::text[]);end $$;

create function private.npc_approval_catalog_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b jsonb;f text;
begin
 -- Availability is checked ONLY for a NEW approval. Immutable approved snapshots
 -- remain reproducible if descriptive metadata/flags change afterwards.
 for b in select value from jsonb_array_elements(new.spec->'bots') loop
   if not exists(select 1 from private.skill_catalog where code=b->>'field' and is_active) then
     raise exception using errcode='23514',message='Yeni NPC onayı etkin meslek alanı gerektirir.';end if;
   for f in select jsonb_array_elements_text(b->'teaching_fields') loop
     if not exists(select 1 from private.skill_catalog where code=f and is_active and is_teachable) then
       raise exception using errcode='23514',message='Yeni öğretim alanı etkin ve öğretilebilir olmalı.';end if;
   end loop;
 end loop;
 return new;
end $$;
create trigger npc_approval_z_catalog before insert on private.npc_plan_approvals
for each row execute function private.npc_approval_catalog_guard();

create function private.npc_teaching_fence() returns trigger language plpgsql security invoker set search_path='' as $$
declare p uuid;w uuid;
begin
 select plan_id into strict p from private.bot_profiles where actor_id=new.actor_id;
 select world_id into strict w from private.npc_plan_bindings where plan_id=p;
 perform private.npc_lock_world(w);
 update private.actors set guard_revision=guard_revision+1 where id=new.actor_id;
 update private.npc_population_plans set guard_revision=guard_revision+1 where id=p;
 return new;
end $$;
create function private.npc_teaching_complete() returns trigger language plpgsql security invoker set search_path='' as $$
declare p uuid;
begin
 perform private.a1_assert_actor(new.actor_id);
 select plan_id into strict p from private.bot_profiles where actor_id=new.actor_id;
 perform private.npc_assert_provisioned(p);return null;
end $$;
create trigger a0_teaching_fence before insert on private.bot_teaching_fields
 for each row execute function private.npc_teaching_fence();
create trigger npc_teaching_immutable before update or delete on private.bot_teaching_fields
 for each row execute function private.a2_immutable_guard();
create constraint trigger npc_teaching_complete after insert on private.bot_teaching_fields
 deferrable initially deferred for each row execute function private.npc_teaching_complete();

-- Remaining replacement bodies follow. They retain signatures, ACL and owner boundaries.

create or replace function private.a1_assert_actor(target uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare a private.actors; b private.bot_profiles; n integer; required text[]; taught text[];
begin
 select * into strict a from private.actors where id=target;
 if a.kind='player' then
   required:=array(select code from private.skill_catalog where is_initial
     union all select skill_code from private.player_skill_enrollments where actor_id=target);
   if (select count(*) from private.actor_skills where actor_id=target)<>cardinality(required)
     or exists(select 1 from private.actor_skills where actor_id=target and (not(skill=any(required)) or level<>0 or xp<>0)) then
     raise exception using errcode='23514',message='Dört başlangıç ve yalnız açık kayıtlı ek yetenekler seviye0/XP0 olmalı.';
   end if;
   return;
 end if;
 select * into b from private.bot_profiles where actor_id=target;
 if not found then raise exception using errcode='23514',message='Botun ayrı sabit profili ve NPC konutu gerekli.';end if;
 taught:=private.npc_teaching_codes(target);
 if exists(select 1 from private.bot_teaching_fields where actor_id=target group by actor_id having min(position)<>1 or max(position)<>count(*)) then
   raise exception using errcode='23514',message='Öğretim alan sırası eksiksiz olmalı.';end if;
 if (b.role='lecturer' and (cardinality(taught)=0 or not(b.field=any(taught)))) or (b.role<>'lecturer' and cardinality(taught)<>0) then
   raise exception using errcode='23514',message='Öğretim alanları sabit NPC rolüyle eşleşmeli.';end if;
 if b.role='worker' then required:=array[b.field];
 elsif b.role='operator' then required:=array[b.field,'business'];
 else
   required:=taught || array['basic_teaching','advanced_teaching'];
   select count(distinct f) into n from unnest(taught) f;
   if n<>cardinality(taught) then raise exception using errcode='23514',message='Öğretim alanı tekrarlanamaz.';end if;
 end if;
 select count(distinct f) into n from unnest(required) f;
 if (select count(*) from private.actor_skills where actor_id=target)<>n
   or exists(select 1 from private.actor_skills where actor_id=target and (
     not(skill=any(required)) or xp<>0 or level<>case
       when b.role='worker' then 3 when b.role='operator' then 4
       when skill=any(taught) then 6 when skill='basic_teaching' then 5 else 3 end)) then
   raise exception using errcode='23514',message='Bot yetenekleri yalnız sabit rol ve gerekli alanlara ait olmalı.';
 end if;
end $$;

create or replace function private.a1_assert_plan(target uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare p private.npc_population_plans;
begin
 select * into strict p from private.npc_population_plans where id=target;
 if (select count(*) from private.bot_profiles where plan_id=target)>p.population_limit then
   raise exception using errcode='23514',message='NPC nüfus tavanı aşılamaz.';
 end if;
 if exists(select 1 from private.npc_buildings b where b.plan_id=target and
      ((select count(*) from private.npc_homes h where h.building_id=b.id)<>b.capacity
       or exists(select 1 from private.npc_homes h where h.building_id=b.id and h.number>b.capacity))) then
   raise exception using errcode='23514',message='NPC binasının konutları kapasiteye uygun ve eksiksiz olmalı.';
 end if;
 if p.scope='pilot' and (
   (select count(*) from private.npc_buildings where plan_id=target)>1
   or exists(select 1 from private.npc_buildings where plan_id=target and capacity<>12)
   or exists(select 1 from private.bot_profiles where plan_id=target and
      (role<>'lecturer' or field not in ('plumbing','business') or private.npc_teaching_codes(actor_id)<>array[field]))
   or exists(select 1 from private.bot_profiles where plan_id=target group by field having count(*)>1)) then
   raise exception using errcode='23514',message='Pilot yalnız tek 12 konutlu bina ve ayrı iki alan öğretim görevlisine ayrılmıştır.';
 end if;
end $$;

create or replace function private.npc_check_spec(s jsonb) returns void
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
   if not exists(select 1 from private.skill_catalog where code=b->>'field') then raise exception using errcode='23514',message='Katalogda tanımlı meslek alanı gerekli.';end if;
   select (value->>'capacity')::integer into cap from jsonb_array_elements(s->'buildings') where value->>'key'=b->>'building_key';
   if cap is null or (b->>'home_number')::integer>cap then raise exception using errcode='23514',message='NPC yalnız planın kendi konutuna bağlanabilir.';end if;
   for f in select value from jsonb_array_elements(b->'teaching_fields') loop
     if jsonb_typeof(f)<>'string' then raise exception using errcode='23514',message='Öğretim alan kodu gerekli.';end if;
     if not exists(select 1 from private.skill_catalog where code=f#>>'{}') then raise exception using errcode='23514',message='Katalogda tanımlı öğretim alanı gerekli.';end if;
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
   t:=f#>>'{}';if not exists(select 1 from private.skill_catalog where code=t) then raise exception using errcode='23514',message='Katalogda tanımlı gerekli alan yok.';end if;
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

create or replace function private.npc_assert_provisioned(target_plan uuid) returns void
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
     or bot.field::text<>b->>'field' or to_jsonb(private.npc_teaching_codes(bot.actor_id))<>b->'teaching_fields'
     or not exists(select 1 from private.npc_homes h join private.npc_building_keys k on k.building_id=h.building_id
       where h.id=bot.home_id and k.plan_id=target_plan and k.stable_key=b->>'building_key' and h.number=(b->>'home_number')::integer) then
     raise exception using errcode='23514',message='NPC profil/konut snapshot eşleşmiyor.';end if;
   perform private.a1_assert_actor(actor);
   select jsonb_object_agg(skill::text,level) into values_json from private.actor_skills where actor_id=actor;
   if values_json<>b->'levels' then raise exception using errcode='23514',message='NPC sabit yetenek snapshot eşleşmiyor.';end if;
 end loop;
 perform private.npc_assert_teaching_coverage_text(target_plan,array(select jsonb_array_elements_text(a.spec->'required_teaching_fields'))::text[]);
 if (select count(*) from private.bot_profiles b join private.npc_plan_bindings n on n.plan_id=b.plan_id where n.world_id=bind.world_id)
   >(select population_limit from private.npc_worlds where id=bind.world_id) then
   raise exception using errcode='23514',message='Ortak dünya nüfus bütçesi aşılamaz.';end if;
end $$;

create or replace function private.provision_npc_plan(target_approval uuid) returns jsonb
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
   insert into private.bot_profiles(actor_id,plan_id,home_id,display_name,role,field)
     values(actor,p,home,b->>'name',(b->>'role')::private.bot_role,b->>'field');
   insert into private.bot_teaching_fields(actor_id,skill_code,position)
     select actor,value,ordinality::integer from jsonb_array_elements_text(b->'teaching_fields') with ordinality;
   insert into private.npc_actor_keys values(p,a.world_id,b->>'key',actor);
   for s in select key,value from jsonb_each_text(b->'levels') loop
     insert into private.actor_skills values(actor,s.key,s.value::smallint,0);
   end loop;
 end loop;
 perform private.npc_assert_provisioned(p);return private.npc_plan_result(p);
end $$;

create or replace function private.ensure_player_actor(target_profile uuid) returns uuid
language plpgsql volatile security invoker set search_path='' as $$
declare b uuid; actor uuid;
begin
 -- Explicit DB-owner boundary, independent of JWT metadata and staff assignments.
 -- SECURITY INVOKER cannot lend the owner's table privileges to an API caller.
 if current_user <> 'postgres' then
   raise exception using errcode='42501',message='Bu iç işlem yalnız veritabanı sahibine açıktır.';
 end if;
 if target_profile is null then
   raise exception using errcode='22004',message='Oyuncu profil referansı gerekli.';
 end if;
 select building_id into b from public.memberships where user_id=target_profile;
 if not found then raise exception using errcode='42501',message='Mevcut apartman sakini gerekli.'; end if;
 -- Same building-first order as the legacy game. No old row is updated.
 perform 1 from public.buildings where id=b for update;
 perform 1 from public.memberships where user_id=target_profile and building_id=b for update;
 if not found then
   raise exception using errcode='40001',message='Üyelik değişti; transaction yeniden denenmeli.';
 end if;
 -- Share the legacy sanction serialization key without impersonating target_profile
 -- through auth.uid()/assert_player_allowed (this is NOT a player-callable mutation).
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,741032));
 if private.player_blocked(target_profile,false) then
   raise exception using errcode='42501',message='Aktif yaptırım nedeniyle aktör oluşturulamıyor.';
 end if;
 select id into actor from private.actors where profile_id=target_profile and kind='player';
 if found then
   perform private.a1_assert_actor(actor);
   return actor; -- Never repair, reinitialize, overwrite or reward a repeat request.
 end if;
 insert into private.actors(kind,profile_id) values('player',target_profile)
 on conflict(profile_id) do nothing returning id into actor;
 if actor is null then
   -- A trusted writer outside this function can still race. At RC a fresh snapshot
   -- sees its committed actor; stale RR/serializable transactions must retry whole.
   select id into actor from private.actors where profile_id=target_profile and kind='player';
   if not found then raise exception using errcode='40001',message='Eşzamanlı oluşturma; transaction yeniden denenmeli.'; end if;
 else
   insert into private.actor_skills(actor_id,skill,level,xp)
   select actor,s,0,0 from unnest(array['plumbing','business','basic_teaching','advanced_teaching']::text[]) s;
 end if;
 perform private.a1_assert_actor(actor);
 return actor;
end $$;

revoke all on function private.npc_teaching_codes(uuid),private.npc_assert_teaching_coverage_text(uuid,text[]),
 private.npc_approval_catalog_guard(),private.npc_teaching_fence(),private.npc_teaching_complete()
 from public,anon,authenticated,service_role;
grant execute on function private.npc_assert_teaching_coverage_text(uuid,text[]) to postgres;
comment on table private.bot_teaching_fields is 'Single canonical ordered NPC teaching relationship; catalog FK and canonical level FK. Converted existing relationships retain ordinality; no new NPC or skill grant.';
