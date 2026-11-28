-- Empty passive DRAFT infrastructure. No curriculum seed, actor, XP, policy, public
-- RPC, enrollment, cron or A1 guard replacement. Existing claims stay UNAPPLIED.
set local lock_timeout='5s';

create table private.learning_modules (
 code text primary key,
 skill_code text not null references private.skill_catalog(code) on delete restrict,
 ordinal smallint not null check(ordinal between 1 and 3),
 prerequisite_code text,
 created_at timestamptz not null default clock_timestamp(),
 unique(skill_code,ordinal), unique(code,skill_code),
 foreign key(prerequisite_code,skill_code) references private.learning_modules(code,skill_code) on delete restrict,
 check(code ~ '^[a-z][a-z0-9_]{2,79}\.starter\.[a-z][a-z0-9_]{0,39}$'),
 check((ordinal=1 and prerequisite_code is null) or (ordinal>1 and prerequisite_code is not null))
);
create table private.learning_module_drafts (
 module_code text not null references private.learning_modules(code) on delete restrict,
 version integer not null check(version>0),
 activation text not null default 'draft_only' check(activation='draft_only'),
 title_tr text not null check(char_length(btrim(title_tr)) between 1 and 100),
 description_tr text not null check(char_length(btrim(description_tr)) between 1 and 2000),
 goal_tr text not null check(char_length(btrim(goal_tr)) between 1 and 2000),
 task_tr text not null check(char_length(btrim(task_tr)) between 1 and 2000),
 success_criterion_tr text not null check(char_length(btrim(success_criterion_tr)) between 1 and 2000),
 prompt jsonb not null check(jsonb_typeof(prompt)='object' and octet_length(prompt::text)<=8192),
 assessment_kind text not null check(assessment_kind in('selection','ordering','matching')),
 expected_answer jsonb not null,
 success_feedback_tr text not null check(char_length(btrim(success_feedback_tr)) between 1 and 2000),
 failure_feedback_tr text not null check(char_length(btrim(failure_feedback_tr)) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp(),
 primary key(module_code,version)
);
-- Evidence child of the sole xp_source_claims journal, never a second source or XP ledger.
create table private.learning_evidence_drafts (
 claim_id uuid primary key references private.xp_source_claims(id) on delete restrict,
 actor_id uuid not null,
 actor_kind private.actor_kind not null default 'player' check(actor_kind='player'),
 module_code text not null,
 skill_code text not null,
 content_version integer not null,
 answers jsonb not null,
 status text not null default 'draft_pass' check(status='draft_pass'),
 feedback_tr text not null,
 evidence_hash bytea not null check(octet_length(evidence_hash)=32),
 evaluated_at timestamptz not null default clock_timestamp(),
 foreign key(actor_id,actor_kind) references private.actors(id,kind) on delete restrict,
 foreign key(module_code,skill_code) references private.learning_modules(code,skill_code) on delete restrict,
 foreign key(module_code,content_version) references private.learning_module_drafts(module_code,version) on delete restrict,
 unique(actor_id,module_code)
);
create index learning_evidence_module_version on private.learning_evidence_drafts(module_code,content_version);

create function private.a22_answer_matches(kind text,expected jsonb,answer jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare v jsonb; k text; n integer;
begin
 if answer is null or expected is null or octet_length(answer::text)>4096 or jsonb_typeof(answer)<>'object'
    or jsonb_typeof(expected)<>'object' then return false;end if;
 select count(*) into n from jsonb_object_keys(answer);
 if n<>1 then return false;end if;
 if kind='selection' then
   if not(answer ? 'choice') or jsonb_typeof(answer->'choice')<>'string' then return false;end if;
   if not ((answer->>'choice') ~ '^[a-z][a-z0-9_]{0,79}$') then return false;end if;
 elsif kind='ordering' then
   if not(answer ? 'steps') or jsonb_typeof(answer->'steps')<>'array' then return false;end if;
   if jsonb_array_length(answer->'steps') not between 2 and 8 then return false;end if;
   for v in select value from jsonb_array_elements(answer->'steps') loop
     if jsonb_typeof(v)<>'string' or not((v#>>'{}') ~ '^[a-z][a-z0-9_]{0,79}$') then return false;end if;
   end loop;
   select count(distinct value) into n from jsonb_array_elements(answer->'steps');
   if n<>jsonb_array_length(answer->'steps') then return false;end if;
 elsif kind='matching' then
   if not(answer ? 'pairs') or jsonb_typeof(answer->'pairs')<>'object' then return false;end if;
   select count(*) into n from jsonb_object_keys(answer->'pairs');
   if n not between 2 and 8 then return false;end if;
   for k,v in select key,value from jsonb_each(answer->'pairs') loop
     if not(k ~ '^[a-z][a-z0-9_]{0,79}$') or jsonb_typeof(v)<>'string'
        or not((v#>>'{}') ~ '^[a-z][a-z0-9_]{0,79}$') then return false;end if;
   end loop;
 else return false;
 end if;
 return answer=expected;
end $$;

create function private.a22_module_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform private.a2_owner_check();
 if not exists(select 1 from private.skill_catalog where code=new.skill_code and is_initial and is_active)
    or split_part(new.code,'.',1)<>new.skill_code then
   raise exception using errcode='23514',message='Başlangıç modülü etkin başlangıç alanına bağlı olmalı.';end if;
 if new.ordinal>1 and not exists(select 1 from private.learning_modules where code=new.prerequisite_code
   and skill_code=new.skill_code and ordinal=new.ordinal-1) then
   raise exception using errcode='23514',message='Aynı alandaki önceki modül gerekli.';end if;
 new.created_at:=clock_timestamp();return new;
end $$;
create function private.a22_draft_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform private.a2_owner_check();
 if not private.a22_answer_matches(new.assessment_kind,new.expected_answer,new.expected_answer) then
   raise exception using errcode='23514',message='Geçerli taslak değerlendirme ölçütü gerekli.';end if;
 new.created_at:=clock_timestamp();return new;
end $$;

-- Deterministic UUIDv8-shaped SHA256 identity, version/date/device independent.
create function private.learning_source_id(target_actor uuid,module_code text) returns uuid
language plpgsql immutable security invoker set search_path='' as $$
declare h text;
begin
 if target_actor is null or module_code is null then raise exception using errcode='22004',message='Aktör ve modül gerekli.';end if;
 h:=encode(sha256(convert_to('apartman/starter-learning/v1/'||target_actor::text||'/'||module_code,'UTF8')),'hex');
 return (substr(h,1,12)||'8'||substr(h,14,3)||'8'||substr(h,18,15))::uuid;
end $$;

create function private.a22_lock_player(target_actor uuid) returns uuid
language plpgsql volatile security invoker set search_path='' as $$
declare u uuid; b uuid;
begin
 perform private.a2_owner_check();
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception using errcode='25001',message='Taslak kanıt READ COMMITTED transaction gerektirir.';end if;
 select profile_id into u from private.actors where id=target_actor and kind='player';
 if u is null then raise exception using errcode='42501',message='Mevcut gerçek oyuncu aktörü gerekli.';end if;
 if not exists(select 1 from public.profiles p join auth.users a on a.id=p.id where p.id=u) then
   raise exception using errcode='42501',message='Mevcut hesap gerekli.';end if;
 select building_id into b from public.memberships where user_id=u;
 if b is null then raise exception using errcode='42501',message='Mevcut apartman sakinliği gerekli.';end if;
 perform 1 from public.buildings where id=b for update;
 perform 1 from public.memberships where user_id=u and building_id=b for key share;
 if not found then raise exception using errcode='40001',message='Üyelik değişti; işlem yeniden denenmeli.';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,741032));
 if private.player_blocked(u,false) then raise exception using errcode='42501',message='Aktif yaptırım nedeniyle işlem yapılamıyor.';end if;
 perform 1 from private.actors where id=target_actor and kind='player' and profile_id=u for update;
 perform private.a1_assert_actor(target_actor); -- Existing0/0 and fixed-row protections remain.
 return u;
end $$;

create function private.a22_check_draft_attempt(target_actor uuid,target_module text,target_version integer,answer jsonb)
returns private.learning_module_drafts language plpgsql volatile security invoker set search_path='' as $$
declare m private.learning_modules; d private.learning_module_drafts;
begin
 perform private.a22_lock_player(target_actor);
 select * into m from private.learning_modules where code=target_module;
 select * into d from private.learning_module_drafts where module_code=target_module and version=target_version;
 if m.code is null or d.module_code is null or d.activation<>'draft_only'
    or not exists(select 1 from private.skill_catalog where code=m.skill_code and is_active and is_initial)
    or not exists(select 1 from private.actor_skills where actor_id=target_actor and skill=m.skill_code) then
   raise exception using errcode='23514',message='Geçerli taslak modül ve kanonik yetenek gerekli.';end if;
 if m.prerequisite_code is not null and not exists(select 1 from private.learning_evidence_drafts
    where actor_id=target_actor and module_code=m.prerequisite_code and status='draft_pass') then
   raise exception using errcode='23514',message='Önceki modülün taslak başarı kanıtı gerekli.';end if;
 if not private.a22_answer_matches(d.assessment_kind,d.expected_answer,answer) then
   raise exception using errcode='23514',message='Yanıt görev ölçütünü karşılamıyor; başarı kaydı oluşturulmadı.';end if;
 return d;
end $$;

create function private.a22_evidence_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare d private.learning_module_drafts; m private.learning_modules; c private.xp_source_claims;
begin
 d:=private.a22_check_draft_attempt(new.actor_id,new.module_code,new.content_version,new.answers);
 select * into strict m from private.learning_modules where code=new.module_code;
 select * into c from private.xp_source_claims where id=new.claim_id for update;
 if c.id is null or c.actor_id<>new.actor_id or c.skill_code<>m.skill_code or new.skill_code<>m.skill_code
    or c.source_type<>'starter_learning' or c.reason<>'starter module:'||m.code
    or c.source_id<>private.learning_source_id(new.actor_id,m.code) then
   raise exception using errcode='23514',message='Tek kanonik kaynak aktör, alan ve modülle eşleşmeli.';end if;
 new.feedback_tr:=d.success_feedback_tr;
 new.evaluated_at:=clock_timestamp();
 new.evidence_hash:=sha256(convert_to(jsonb_build_object('claim',c.id,'source',c.source_id,'actor',c.actor_id,
   'skill',m.skill_code,'module',m.code,'version',d.version,'definition',to_jsonb(d)-'created_at','answer',new.answers)::text,'UTF8'));
 return new;
end $$;

-- OWNER-ONLY draft staging. No XP/level/receipt/policy update and NO public wrapper.
create function private.stage_learning_evidence_draft(target_actor uuid,target_module text,target_version integer,answer jsonb)
returns uuid language plpgsql volatile security invoker set search_path='' as $$
declare d private.learning_module_drafts; m private.learning_modules; e private.learning_evidence_drafts; claim uuid;
begin
 d:=private.a22_check_draft_attempt(target_actor,target_module,target_version,answer);
 select * into strict m from private.learning_modules where code=target_module;
 select * into e from private.learning_evidence_drafts where actor_id=target_actor and module_code=target_module;
 if found then
   if e.content_version<>target_version or e.answers<>answer then
     raise exception using errcode='23514',message='Aynı modülün taslak kanıtı farklı sürüm/yanıtla değiştirilemez.';end if;
   return e.claim_id;
 end if;
 claim:=private.reserve_xp_source('starter_learning',private.learning_source_id(target_actor,m.code),target_actor,m.skill_code,'starter module:'||m.code);
 insert into private.learning_evidence_drafts(claim_id,actor_id,module_code,skill_code,content_version,answers,feedback_tr,evidence_hash)
 values(claim,target_actor,m.code,m.skill_code,target_version,answer,'',decode(repeat('00',32),'hex'));
 return claim;
end $$;

create trigger a22_module_insert before insert on private.learning_modules for each row execute function private.a22_module_guard();
create trigger a22_draft_insert before insert on private.learning_module_drafts for each row execute function private.a22_draft_guard();
create trigger a22_evidence_insert before insert on private.learning_evidence_drafts for each row execute function private.a22_evidence_guard();
do $$ declare t text; f regprocedure; begin
 foreach t in array array['learning_modules','learning_module_drafts','learning_evidence_drafts'] loop
   execute format('alter table private.%I enable row level security',t);
   execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
   execute format('create trigger a22_immutable before update or delete on private.%I for each row execute function private.a2_immutable_guard()',t);
   execute format('create trigger a22_no_truncate before truncate on private.%I for each statement execute function private.a2_immutable_guard()',t);
 end loop;
 foreach f in array array['private.a22_answer_matches(text,jsonb,jsonb)'::regprocedure,'private.a22_module_guard()'::regprocedure,
 'private.a22_draft_guard()'::regprocedure,'private.learning_source_id(uuid,text)'::regprocedure,'private.a22_lock_player(uuid)'::regprocedure,
 'private.a22_check_draft_attempt(uuid,text,integer,jsonb)'::regprocedure,'private.a22_evidence_guard()'::regprocedure,
 'private.stage_learning_evidence_draft(uuid,text,integer,jsonb)'::regprocedure] loop
   execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
end $$;
grant execute on function private.stage_learning_evidence_draft(uuid,text,integer,jsonb) to postgres;
comment on table private.learning_evidence_drafts is 'DRAFT-only correct-answer evidence tied to the existing UNAPPLIED xp_source_claims. Never XP entitlement, active completion or automatic future reward.0/0 guards unchanged; publication, verified session and approved numeric policy require a later reviewed implementation.';
