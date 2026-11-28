-- A2-1 only: real canonical key conversion, catalog metadata and UNAPPLIED source claims.
-- No actor backfill, NPC seed, enrollment call, XP credit, level calculation or worker.
set local lock_timeout='5s';

create table private.skill_catalog (
 code text primary key check(code ~ '^[a-z][a-z0-9_]{2,79}$'),
 title_tr text not null check(char_length(btrim(title_tr)) between 1 and 100),
 description_tr text not null default '' check(char_length(description_tr)<=1000),
 is_active boolean not null default false,
 is_teachable boolean not null default false,
 is_initial boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(is_initial=(code in ('plumbing','business','basic_teaching','advanced_teaching')))
);
-- Static catalog metadata, NOT actor skills or education availability.
insert into private.skill_catalog(code,title_tr,description_tr,is_active,is_teachable,is_initial) values
 ('plumbing','Tesisatçılık','Tesisat alanındaki yetenek kodu.',true,true,true),
 ('business','İşletmecilik','İşletmecilik alanındaki yetenek kodu.',true,true,true),
 ('basic_teaching','Temel Öğreticilik','Temel öğreticilik yetenek kodu.',true,true,true),
 ('advanced_teaching','İleri Öğreticilik','İleri öğreticilik yetenek kodu.',true,true,true);

-- Keeps the same rows, PK, level and XP. Legacy NPC enum fields/signatures stay intact.
alter table private.actor_skills alter column skill type text using skill::text;
alter table private.actor_skills add constraint actor_skills_catalog_fk
 foreign key(skill) references private.skill_catalog(code) on delete restrict;

-- An explicit, separately approved enrollment anchor for NON-initial player skills.
-- No function/trigger inserts a skill for this table; both rows must be supplied atomically.
create table private.player_skill_enrollments (
 actor_id uuid not null,
 actor_kind private.actor_kind not null default 'player' check(actor_kind='player'),
 skill_code text not null references private.skill_catalog(code) on delete restrict,
 approval_ref text not null check(char_length(btrim(approval_ref)) between 3 and 200),
 reason text not null check(char_length(btrim(reason)) between 5 and 500),
 enrolled_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,skill_code),
 foreign key(actor_id,actor_kind) references private.actors(id,kind) on delete restrict,
 foreign key(actor_id,skill_code) references private.actor_skills(actor_id,skill) on delete restrict deferrable initially deferred,
 check(skill_code not in ('plumbing','business','basic_teaching','advanced_teaching'))
);

create or replace function private.a1_assert_actor(target uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare a private.actors; b private.bot_profiles; n integer; required text[];
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
 if b.role='worker' then required:=array[b.field::text];
 elsif b.role='operator' then required:=array[b.field::text,'business'];
 else
   required:=b.teaching_fields::text[] || array['basic_teaching','advanced_teaching'];
   select count(distinct f) into n from unnest(b.teaching_fields) f;
   if n<>cardinality(b.teaching_fields) then raise exception using errcode='23514',message='Öğretim alanı tekrarlanamaz.';end if;
 end if;
 select count(distinct f) into n from unnest(required) f;
 if (select count(*) from private.actor_skills where actor_id=target)<>n
   or exists(select 1 from private.actor_skills where actor_id=target and (
     not(skill=any(required)) or xp<>0 or level<>case
       when b.role='worker' then 3 when b.role='operator' then 4
       when skill=any(b.teaching_fields::text[]) then 6 when skill='basic_teaching' then 5 else 3 end)) then
   raise exception using errcode='23514',message='Bot yetenekleri yalnız sabit rol ve gerekli alanlara ait olmalı.';
 end if;
end $$;

-- Preserve the existing enum signature/ACL for A1 NPC callers; canonical join is now text.
create or replace function private.npc_assert_teaching_coverage(target_plan uuid,required private.actor_skill_code[]) returns void
language plpgsql security invoker set search_path='' as $$
declare f private.actor_skill_code;
begin
 perform private.npc_owner_check();
 if required is null or array_position(required,null) is not null or not exists(select 1 from private.npc_plan_bindings where plan_id=target_plan) then
   raise exception using errcode='23514',message='Onaylı plan ve açık öğretim alanları gerekli.';end if;
 foreach f in array required loop
   if not exists(select 1 from private.bot_profiles b
     join private.actor_skills a on a.actor_id=b.actor_id and a.skill=f::text and a.level>=6
     join private.actor_skills t on t.actor_id=b.actor_id and t.skill='basic_teaching' and t.level>=5
     join private.actor_skills i on i.actor_id=b.actor_id and i.skill='advanced_teaching' and i.level>=3
     where b.plan_id=target_plan and b.role='lecturer' and f=any(b.teaching_fields)) then
     raise exception using errcode='23514',message='Alan için nitelikli sabit öğretim görevlisi eksik.';
   end if;
 end loop;
end $$;

-- Reservation/identity journal ONLY. No amount, credited status, award date or XP formula.
create table private.xp_source_claims (
 id uuid primary key default gen_random_uuid(),
 source_type text not null check(source_type ~ '^[a-z][a-z0-9_]{2,79}$'),
 source_id uuid not null,
 actor_id uuid not null,
 actor_kind private.actor_kind not null default 'player' check(actor_kind='player'),
 skill_code text not null,
 reason text not null check(char_length(btrim(reason)) between 5 and 500),
 reserved_at timestamptz not null default clock_timestamp(),
 reserved_on date generated always as ((reserved_at at time zone 'Europe/Istanbul')::date) stored,
 foreign key(actor_id,actor_kind) references private.actors(id,kind) on delete restrict,
 foreign key(actor_id,skill_code) references private.actor_skills(actor_id,skill) on delete restrict,
 unique(source_id)
);
create index xp_source_actor_day on private.xp_source_claims(actor_id,reserved_on);

create function private.a2_owner_check() returns void language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'postgres' then raise exception using errcode='42501',message='Bu iç işlem yalnız veritabanı sahibine açıktır.';end if;
end $$;
create function private.a2_catalog_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception using errcode='23514',message='Kalıcı yetenek kodu silinemez veya yeniden kullanılamaz.';end if;
 if new.code<>old.code or new.is_initial<>old.is_initial or new.created_at<>old.created_at then
   raise exception using errcode='23514',message='Yetenek kimliği ve başlangıç politikası değişmez.';end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
create trigger a2_catalog_identity before update or delete on private.skill_catalog for each row execute function private.a2_catalog_guard();
create function private.a2_immutable_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception using errcode='23514',message='Kayıt silinemez, hedefi değiştirilemez veya tekrar kullanılamaz.';end $$;
create function private.a2_enrollment_complete() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform private.a1_assert_actor(new.actor_id);return null;end $$;
create constraint trigger a2_enrollment_complete after insert on private.player_skill_enrollments
 deferrable initially deferred for each row execute function private.a2_enrollment_complete();
create function private.a2_source_insert_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from private.skill_catalog where code=new.skill_code and is_active) then
   raise exception using errcode='23514',message='Yeni kaynak kaydı etkin katalog kodu gerektirir.';end if;
 new.reserved_at:=clock_timestamp();return new;
end $$;
create trigger a2_source_insert before insert on private.xp_source_claims for each row execute function private.a2_source_insert_guard();

create function private.define_skill(skill_code text,title text,description text,active boolean default false,teachable boolean default false) returns text
language plpgsql security invoker set search_path='' as $$
declare c private.skill_catalog;
begin
 perform private.a2_owner_check();
 insert into private.skill_catalog(code,title_tr,description_tr,is_active,is_teachable,is_initial)
 values(skill_code,title,description,active,teachable,skill_code in ('plumbing','business','basic_teaching','advanced_teaching'))
 on conflict(code) do nothing;
 select * into strict c from private.skill_catalog where code=skill_code;
 if c.title_tr is distinct from title or c.description_tr is distinct from description or c.is_active is distinct from active or c.is_teachable is distinct from teachable then
   raise exception using errcode='23514',message='Aynı katalog anahtarı farklı içerikle sessizce değiştirilemez.';end if;
 return c.code;
end $$;
create function private.reserve_xp_source(source_type text,source_id uuid,target_actor uuid,target_skill text,reason text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare r private.xp_source_claims;
begin
 perform private.a2_owner_check();
 select * into r from private.xp_source_claims x where x.source_id=reserve_xp_source.source_id;
 if not found then
   insert into private.xp_source_claims(source_type,source_id,actor_id,skill_code,reason)
   values(source_type,source_id,target_actor,target_skill,reason) on conflict on constraint xp_source_claims_source_id_key do nothing;
   select * into strict r from private.xp_source_claims x where x.source_id=reserve_xp_source.source_id;
 end if;
 if r.source_type is distinct from source_type or r.actor_id is distinct from target_actor or r.skill_code is distinct from target_skill or r.reason is distinct from reason then
   raise exception using errcode='23514',message='Kaynak başka oyuncuya/yeteneğe veya farklı içerikle yeniden bağlanamaz.';end if;
 return r.id;
end $$;

do $$ declare t text;f regprocedure;begin
 foreach t in array array['skill_catalog','player_skill_enrollments','xp_source_claims'] loop
   execute format('alter table private.%I enable row level security',t);
   execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 foreach t in array array['player_skill_enrollments','xp_source_claims'] loop
   execute format('create trigger a2_immutable before update or delete on private.%I for each row execute function private.a2_immutable_guard()',t);
 end loop;
 foreach f in array array['private.a2_owner_check()'::regprocedure,'private.a2_catalog_guard()'::regprocedure,
   'private.a2_immutable_guard()'::regprocedure,'private.a2_enrollment_complete()'::regprocedure,'private.a2_source_insert_guard()'::regprocedure,
   'private.define_skill(text,text,text,boolean,boolean)'::regprocedure,'private.reserve_xp_source(text,uuid,uuid,text,text)'::regprocedure] loop
   execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
end $$;
grant execute on function private.define_skill(text,text,text,boolean,boolean),private.reserve_xp_source(text,uuid,uuid,text,text) to postgres;
comment on table private.actor_skills is 'Canonical level/XP values keyed by catalog text FK. A2-1 grants no XP: players remain 0/0; noninitial skills require explicit enrollment; bots retain fixed A1 profiles.';
comment on table private.xp_source_claims is 'Immutable UNAPPLIED source identity reservation, not an XP award. Future verified completion, amount receipt, policy version, award day and atomic daily limits require a separate approved implementation.';
