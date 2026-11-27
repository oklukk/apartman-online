-- Empty, additive A1 storage. No actor/skill/NPC backfill, seed, worker or legacy trigger.
-- All provisioning remains closed to API roles, including service_role.
set local lock_timeout = '5s';

create type private.actor_kind as enum ('player','bot');
create type private.actor_skill_code as enum ('plumbing','business','basic_teaching','advanced_teaching');
create type private.bot_role as enum ('worker','operator','lecturer');

create table private.actors (
 id uuid primary key default gen_random_uuid(),
 kind private.actor_kind not null,
 profile_id uuid unique references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 guard_revision bigint not null default 0 check (guard_revision >= 0),
 unique(id,kind),
 check ((kind='player' and profile_id is not null) or (kind='bot' and profile_id is null))
);

create table private.npc_population_plans (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[a-z][a-z0-9_]{2,79}$'),
 scope text not null check (scope in ('pilot','world')),
 population_limit integer not null check (population_limit >= 0),
 guard_revision bigint not null default 0 check (guard_revision >= 0),
 created_at timestamptz not null default clock_timestamp(),
 check (scope <> 'pilot' or population_limit = 2)
);
create table private.npc_buildings (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references private.npc_population_plans(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 1 and 100),
 capacity integer not null check (capacity > 0),
 unique(id,plan_id)
);
create index npc_buildings_plan on private.npc_buildings(plan_id);
create table private.npc_homes (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null,
 building_id uuid not null,
 number integer not null check (number > 0),
 unique(id,plan_id), unique(building_id,number),
 foreign key(building_id,plan_id) references private.npc_buildings(id,plan_id) on delete restrict
);
create index npc_homes_plan on private.npc_homes(plan_id);
create table private.bot_profiles (
 actor_id uuid primary key,
 actor_kind private.actor_kind not null default 'bot' check (actor_kind='bot'),
 plan_id uuid not null references private.npc_population_plans(id) on delete restrict,
 home_id uuid not null unique,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
 role private.bot_role not null,
 field private.actor_skill_code not null,
 teaching_fields private.actor_skill_code[] not null default '{}',
 foreign key(actor_id,actor_kind) references private.actors(id,kind) on delete restrict,
 foreign key(home_id,plan_id) references private.npc_homes(id,plan_id) on delete restrict,
 check (array_position(teaching_fields,null) is null),
 check ((role='lecturer' and cardinality(teaching_fields)>0 and field=any(teaching_fields))
   or (role<>'lecturer' and cardinality(teaching_fields)=0))
);
create index bot_profiles_plan on private.bot_profiles(plan_id);

-- The only skill value store. No parallel JSON snapshot or bot level column.
-- XP is reserved for A2; no XP curve, award path or legacy-job conversion exists here.
create table private.actor_skills (
 actor_id uuid not null references private.actors(id) on delete restrict,
 skill private.actor_skill_code not null,
 level smallint not null check (level between 0 and 10),
 xp bigint not null default 0 check (xp between 0 and 9007199254740991),
 primary key(actor_id,skill)
);

-- Identity and fixed profiles are append-only. Revisions are serialization fences,
-- not population/skill balances; touching them also prevents stale RR snapshots.
create function private.a1_fixed_row_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and TG_TABLE_NAME in ('actors','npc_population_plans') then
   if (to_jsonb(new)-'guard_revision')=(to_jsonb(old)-'guard_revision')
      and new.guard_revision=old.guard_revision+1 then return new; end if;
 end if;
 raise exception using errcode='23514',message='A1 kimliği, planı ve sabit değerleri bu aşamada değiştirilemez.';
end $$;

create function private.a1_actor_insert_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='player' then
   perform 1 from public.memberships where user_id=new.profile_id for key share;
   if not found then raise exception using errcode='23514',message='Oyuncu aktörü mevcut bir sakine bağlanmalı.'; end if;
 end if;
 return new;
end $$;
create trigger a1_actor_insert before insert on private.actors
for each row execute function private.a1_actor_insert_guard();

create function private.a1_child_insert_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 -- All bot writes take actor before NPC plan; no existing game balance is locked/written.
 if TG_TABLE_NAME in ('actor_skills','bot_profiles') then
   update private.actors set guard_revision=guard_revision+1 where id=new.actor_id;
 end if;
 if TG_TABLE_NAME in ('npc_buildings','npc_homes','bot_profiles') then
   update private.npc_population_plans set guard_revision=guard_revision+1 where id=new.plan_id;
 end if;
 return new;
end $$;

create function private.a1_assert_actor(target uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare a private.actors; b private.bot_profiles; n integer; required private.actor_skill_code[];
begin
 select * into strict a from private.actors where id=target;
 if a.kind='player' then
   if (select count(*) from private.actor_skills where actor_id=target)<>4
      or exists(select 1 from private.actor_skills where actor_id=target and (level<>0 or xp<>0)) then
     raise exception using errcode='23514',message='A1 oyuncusu dört alanda seviye0/XP0 ile saklanmalı.';
   end if;
   return;
 end if;
 select * into b from private.bot_profiles where actor_id=target;
 if not found then raise exception using errcode='23514',message='Botun ayrı sabit profili ve NPC konutu gerekli.'; end if;
 if b.role='worker' then required:=array[b.field];
 elsif b.role='operator' then required:=array[b.field,'business'::private.actor_skill_code];
 else
   required:=b.teaching_fields || array['basic_teaching','advanced_teaching']::private.actor_skill_code[];
   select count(distinct f) into n from unnest(b.teaching_fields) f;
   if n<>cardinality(b.teaching_fields) then
     raise exception using errcode='23514',message='Öğretim alanı tekrarlanamaz.';
   end if;
 end if;
 select count(distinct f) into n from unnest(required) f;
 if (select count(*) from private.actor_skills where actor_id=target)<>n
    or exists(select 1 from private.actor_skills where actor_id=target and (
      not(skill=any(required)) or xp<>0 or level<>case
        when b.role='worker' then 3 when b.role='operator' then 4
        when skill=any(b.teaching_fields) then 6
        when skill='basic_teaching' then 5 else 3 end)) then
   raise exception using errcode='23514',message='Bot yetenekleri yalnız sabit rol ve gerekli alanlara ait olmalı.';
 end if;
end $$;

create function private.a1_assert_plan(target uuid) returns void
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
      (role<>'lecturer' or field not in ('plumbing','business') or teaching_fields<>array[field]))
   or exists(select 1 from private.bot_profiles where plan_id=target group by field having count(*)>1)) then
   raise exception using errcode='23514',message='Pilot yalnız tek 12 konutlu bina ve ayrı iki alan öğretim görevlisine ayrılmıştır.';
 end if;
end $$;

-- Cross-row completeness is checked at COMMIT, so a single transaction can assemble
-- actor/profile/skills and complete housing. SET CONSTRAINTS ALL IMMEDIATE is supported.
create function private.a1_actor_constraint() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_TABLE_NAME='actors' then perform private.a1_assert_actor(new.id);
 else perform private.a1_assert_actor(new.actor_id); end if;
 return null;
end $$;
create function private.a1_plan_constraint() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_TABLE_NAME='npc_population_plans' then perform private.a1_assert_plan(new.id);
 else perform private.a1_assert_plan(new.plan_id); end if;
 return null;
end $$;

do $$ declare t text; begin
 foreach t in array array['actors','npc_population_plans','npc_buildings','npc_homes','bot_profiles','actor_skills'] loop
   execute format('alter table private.%I enable row level security',t);
   execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
   execute format('create trigger a1_fixed_row before update or delete on private.%I for each row execute function private.a1_fixed_row_guard()',t);
 end loop;
 foreach t in array array['npc_buildings','npc_homes','bot_profiles','actor_skills'] loop
   execute format('create trigger a1_child_insert before insert on private.%I for each row execute function private.a1_child_insert_guard()',t);
 end loop;
 foreach t in array array['actors','bot_profiles','actor_skills'] loop
   execute format('create constraint trigger a1_actor_complete after insert or update on private.%I deferrable initially deferred for each row execute function private.a1_actor_constraint()',t);
 end loop;
 foreach t in array array['npc_population_plans','npc_buildings','npc_homes','bot_profiles'] loop
   execute format('create constraint trigger a1_plan_complete after insert or update on private.%I deferrable initially deferred for each row execute function private.a1_plan_constraint()',t);
 end loop;
end $$;

-- No target ID parameter, no staff bypass, no NPC directory, no private game fields.
-- The empty schema yields NULL; actor-less residents keep playing the legacy game.
create function private.my_actor() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); payload jsonb;
begin
 if u is null then raise exception using errcode='42501',message='Oturum gerekli.'; end if;
 if private.player_blocked(u,false) then raise exception using errcode='42501',message='Aktif yaptırım nedeniyle erişilemiyor.'; end if;
 select jsonb_build_object('id',a.id,'kind',a.kind,'skills',(
   select jsonb_object_agg(s.skill::text,jsonb_build_object('level',s.level,'xp',s.xp))
   from private.actor_skills s where s.actor_id=a.id)) into payload
 from private.actors a where a.kind='player' and a.profile_id=u;
 return payload;
end $$;
create function public.my_actor() returns jsonb
language sql stable security invoker set search_path='' as $$select private.my_actor()$$;

revoke all on type private.actor_kind,private.actor_skill_code,private.bot_role from public,anon,authenticated,service_role;
revoke all on function private.a1_fixed_row_guard(),private.a1_actor_insert_guard(),private.a1_child_insert_guard(),
 private.a1_assert_actor(uuid),private.a1_assert_plan(uuid),private.a1_actor_constraint(),private.a1_plan_constraint(),
 private.my_actor(),public.my_actor() from public,anon,authenticated,service_role;
grant execute on function private.my_actor(),public.my_actor() to authenticated;

comment on table private.actor_skills is 'Canonical actor skill values. A1 only: players 0/0; fixed bot levels with XP0. A2 must add checked progression and source uniqueness, not a second balance store.';
comment on table private.npc_population_plans is 'Empty planned population boundary. Pilot limit2 is local to each explicit pilot plan, never a global world ceiling. No provisioning approval is implied.';
