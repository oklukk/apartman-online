-- Approved numbers; CLOSED activation. No actor/content/completion seed or public RPC.
-- The only executable adapter is synthetic and restricted to the disposable test DB.
set local lock_timeout='5s';

create table private.xp_policies (
 policy_id text not null check(policy_id ~ '^[a-z][a-z0-9_]{2,79}$'),
 version integer not null check(version>0),
 thresholds bigint[] not null check(thresholds=array[0,20,60,140,260,440,700,1080,1640,2440,3540]::bigint[]),
 rewards jsonb not null check(rewards='{"orientation":12,"starter":32,"course":24,"book":8,"practice":18}'::jsonb),
 general_daily integer not null check(general_daily=110),
 skill_daily integer not null check(skill_daily=70),
 practice_daily integer not null check(practice_daily=2),
 practice_weekly integer not null check(practice_weekly=7),
 approval_ref text not null check(length(btrim(approval_ref)) between 5 and 500),
 created_at timestamptz not null default clock_timestamp(),
 primary key(policy_id,version)
);
-- Static, explicitly approved policy data ONLY; not a learning content seed.
insert into private.xp_policies values('a22b_approved_20261128',1,
 array[0,20,60,140,260,440,700,1080,1640,2440,3540],
 '{"orientation":12,"starter":32,"course":24,"book":8,"practice":18}',110,70,2,7,
 'User-approved A2-2b numeric policy; activation and unresolved overflow/stage rules NOT approved',clock_timestamp());

create table private.xp_runtime (
 singleton boolean primary key default true check(singleton),
 policy_id text not null,
 policy_version integer not null,
 mode text not null default 'disabled' check(mode in('disabled','disposable_only')),
 foreign key(policy_id,policy_version) references private.xp_policies(policy_id,version) on delete restrict
);
insert into private.xp_runtime values(true,'a22b_approved_20261128',1,'disabled');

-- Content identity, NOT a second XP source journal. Empty outside disposable fixtures.
create table private.xp_completion_definitions (
 code text primary key check(code ~ '^[a-z][a-z0-9_.]{2,119}$'),
 skill_code text not null references private.skill_catalog(code) on delete restrict,
 activity_kind text not null check(activity_kind in('orientation','starter','course','book','practice')),
 starter_module text references private.learning_modules(code) on delete restrict,
 verification_adapter text not null default 'synthetic_disposable' check(verification_adapter='synthetic_disposable'),
 unique(starter_module),
 check((activity_kind='starter')=(starter_module is not null))
);
-- Attestation child of the ONE existing source claim. Never generated from draft answers.
create table private.xp_verified_completions (
 claim_id uuid primary key references private.xp_source_claims(id) on delete restrict,
 actor_id uuid not null,
 actor_kind private.actor_kind not null default 'player' check(actor_kind='player'),
 skill_code text not null,
 definition_code text not null references private.xp_completion_definitions(code) on delete restrict,
 activity_kind text not null check(activity_kind in('orientation','starter','course','book','practice')),
 verification_ref uuid not null unique,
 evidence_hash bytea not null check(octet_length(evidence_hash)=32 and evidence_hash<>decode(repeat('00',32),'hex')),
 verified_at timestamptz not null default clock_timestamp(),
 foreign key(actor_id,actor_kind) references private.actors(id,kind) on delete restrict,
 foreign key(actor_id,skill_code) references private.actor_skills(actor_id,skill) on delete restrict,
 unique(actor_id,definition_code)
);
create unique index xp_orientation_once on private.xp_verified_completions(actor_id) where activity_kind='orientation';
create index xp_completion_definition on private.xp_verified_completions(definition_code);
create table private.xp_completion_revocations (
 claim_id uuid primary key references private.xp_verified_completions(claim_id) on delete restrict,
 reason text not null check(length(btrim(reason)) between 5 and 500),
 revoked_at timestamptz not null default clock_timestamp()
);

-- A receipt is the atomic daily/weekly usage record as well as the immutable award.
-- No parallel mutable XP balance or second claim/idempotency journal is introduced.
create table private.xp_award_receipts (
 claim_id uuid primary key references private.xp_verified_completions(claim_id) on delete restrict,
 sequence bigint generated always as identity unique,
 actor_id uuid not null,
 skill_code text not null,
 verification_ref uuid not null unique references private.xp_verified_completions(verification_ref) on delete restrict,
 evidence_hash bytea not null check(octet_length(evidence_hash)=32),
 policy_id text not null,
 policy_version integer not null,
 activity_kind text not null,
 definition_code text not null,
 awarded_xp integer not null check(awarded_xp>0),
 previous_xp bigint not null check(previous_xp>=0),
 next_xp bigint not null check(next_xp=previous_xp+awarded_xp and next_xp<=140),
 previous_level smallint not null check(previous_level between 0 and 3),
 next_level smallint not null check(next_level between previous_level and 3),
 starter_count smallint not null check(starter_count between 0 and 3),
 earned_at timestamptz not null,
 earned_on date not null,
 week_start date not null,
 foreign key(actor_id,skill_code) references private.actor_skills(actor_id,skill) on delete restrict,
 foreign key(policy_id,policy_version) references private.xp_policies(policy_id,version) on delete restrict,
 unique(actor_id,skill_code,previous_xp),
 check(earned_on=(earned_at at time zone 'Europe/Istanbul')::date),
 check(week_start=date_trunc('week',earned_at at time zone 'Europe/Istanbul')::date)
);
create index xp_receipt_actor_day on private.xp_award_receipts(actor_id,earned_on);
create index xp_receipt_practice_week on private.xp_award_receipts(actor_id,skill_code,week_start) where activity_kind='practice';

create function private.xp_server_now() returns timestamptz
language sql volatile security invoker set search_path='' as $$select clock_timestamp()$$;
create function private.xp_periods(t timestamptz) returns table(day date,week_start date,unlocked integer)
language sql immutable strict security invoker set search_path='' as $$
 select (t at time zone 'Europe/Istanbul')::date,date_trunc('week',t at time zone 'Europe/Istanbul')::date,
 extract(isodow from t at time zone 'Europe/Istanbul')::integer
$$;
create function private.xp_initial_level(total bigint,starters integer) returns smallint
language sql immutable strict security invoker set search_path='' as $$
 select case when total>=140 and starters=3 then 3 when total>=60 then 2 when total>=20 then 1 else 0 end::smallint
$$;

create function private.xp_lock_runtime() returns private.xp_runtime
language plpgsql volatile security invoker set search_path='' as $$
declare r private.xp_runtime;
begin
 perform private.a2_owner_check();
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception using errcode='25001',message='XP işlemi READ COMMITTED transaction gerektirir.';end if;
 select * into strict r from private.xp_runtime where singleton for update;
 return r;
end $$;
create function private.xp_require_disposable() returns private.xp_runtime
language plpgsql volatile security invoker set search_path='' as $$
declare r private.xp_runtime;
begin
 r:=private.xp_lock_runtime();
 if r.mode<>'disposable_only' or current_database()<>'apartman_a22b_xp' then
   raise exception using errcode='42501',message='XP kapalı; yalnız ayrı disposable test adaptörü kullanılabilir.';end if;
 return r;
end $$;
create function private.xp_runtime_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform private.a2_owner_check();
 if TG_OP<>'UPDATE' or new.singleton is distinct from old.singleton then
   raise exception using errcode='23514',message='Tek runtime kaydı silinemez veya çoğaltılamaz.';end if;
 if new.mode='disposable_only' and current_database()<>'apartman_a22b_xp' then
   raise exception using errcode='42501',message='Canlı XP adaptörü bu migration içinde bulunmuyor.';end if;
 return new;
end $$;
create trigger xp_runtime_change before insert or update or delete on private.xp_runtime for each row execute function private.xp_runtime_guard();

create function private.xp_definition_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform private.xp_require_disposable();
 if not exists(select 1 from private.skill_catalog where code=new.skill_code and is_active) then
   raise exception using errcode='23514',message='Etkin katalog alanı gerekli.';end if;
 if new.activity_kind='starter' and not exists(select 1 from private.learning_modules where code=new.starter_module
     and code=new.code and skill_code=new.skill_code and ordinal between 1 and 3) then
   raise exception using errcode='23514',message='Başlangıç içeriği aynı alandaki üç sabit modülden biri olmalı.';end if;
 return new;
end $$;
create function private.xp_completion_source_id(actor uuid,code text,kind text) returns uuid
language sql immutable strict security invoker set search_path='' as $$
 select (substr(h,1,12)||'8'||substr(h,14,3)||'8'||substr(h,18,15))::uuid
 from (select encode(sha256(convert_to('apartman/verified-learning/v1/'||actor::text||'/'||case when kind='orientation' then 'orientation' else code end,'UTF8')),'hex') h) s
$$;
create function private.xp_completion_guard() returns trigger
language plpgsql volatile security invoker set search_path='' as $$
declare c private.xp_source_claims;d private.xp_completion_definitions;m private.learning_modules;
begin
 perform private.xp_require_disposable();
 perform private.a22_lock_player(new.actor_id);
 select * into strict d from private.xp_completion_definitions where code=new.definition_code;
 select * into strict c from private.xp_source_claims where id=new.claim_id for update;
 if c.actor_id<>new.actor_id or c.skill_code<>new.skill_code or d.skill_code<>new.skill_code
   or new.activity_kind<>d.activity_kind or c.source_type<>'verified_learning'
   or c.source_id<>private.xp_completion_source_id(new.actor_id,d.code,d.activity_kind)
   or c.reason<>'verified completion:'||d.code
   or c.reserved_at<(select created_at from private.xp_policies where policy_id='a22b_approved_20261128' and version=1)
   or exists(select 1 from private.learning_evidence_drafts where claim_id=c.id) then
   raise exception using errcode='23514',message='Kaynak, gerçek alan/aktör ve bağımsız tamamlanma kimliğiyle eşleşmeli.';end if;
 if d.activity_kind='starter' then
   select * into strict m from private.learning_modules where code=d.starter_module;
   if m.prerequisite_code is not null and not exists(select 1 from private.xp_verified_completions e
       where e.actor_id=new.actor_id and e.definition_code=m.prerequisite_code
       and not exists(select 1 from private.xp_completion_revocations v where v.claim_id=e.claim_id)) then
     raise exception using errcode='23514',message='Önceki modülün gerçek doğrulanmış tamamlanması gerekli.';end if;
 end if;
 new.verified_at:=private.xp_server_now();return new;
end $$;
create trigger xp_definition_insert before insert on private.xp_completion_definitions for each row execute function private.xp_definition_guard();
create trigger xp_completion_insert before insert on private.xp_verified_completions for each row execute function private.xp_completion_guard();

-- Explicitly synthetic, CLOSED DB-owner adapter. Not a server claim that fixture answers prove learning.
create function private.record_test_xp_completion(actor uuid,definition text,verification uuid,proof bytea) returns uuid
language plpgsql volatile security invoker set search_path='' as $$
declare d private.xp_completion_definitions;e private.xp_verified_completions;c uuid;
begin
 perform private.xp_require_disposable();perform private.a22_lock_player(actor);
 select * into strict d from private.xp_completion_definitions where code=definition;
 select * into e from private.xp_verified_completions where actor_id=actor and definition_code=definition;
 if found then
   if e.verification_ref is distinct from verification or e.evidence_hash is distinct from proof then
     raise exception using errcode='23514',message='Aynı tamamlanma farklı kanıta bağlanamaz.';end if;
   return e.claim_id;
 end if;
 c:=private.reserve_xp_source('verified_learning',private.xp_completion_source_id(actor,d.code,d.activity_kind),actor,d.skill_code,'verified completion:'||d.code);
 insert into private.xp_verified_completions(claim_id,actor_id,skill_code,definition_code,activity_kind,verification_ref,evidence_hash)
 values(c,actor,d.skill_code,d.code,d.activity_kind,verification,proof);
 return c;
end $$;

create function private.xp_revoke_guard() returns trigger
language plpgsql volatile security invoker set search_path='' as $$
begin
 perform private.xp_require_disposable();
 new.revoked_at:=private.xp_server_now();return new;
end $$;
create trigger xp_revoke_insert before insert on private.xp_completion_revocations for each row execute function private.xp_revoke_guard();

-- No second balance: reconcile each candidate against the complete immutable receipt chain.
create function private.xp_assert_skill(actor uuid,code text,candidate_xp bigint,candidate_level smallint) returns void
language plpgsql volatile security invoker set search_path='' as $$
declare total bigint;last_xp bigint;last_level smallint;
begin
 select coalesce(sum(awarded_xp),0) into total from private.xp_award_receipts where actor_id=actor and skill_code=code;
 select next_xp,next_level into last_xp,last_level from private.xp_award_receipts where actor_id=actor and skill_code=code order by sequence desc limit 1;
 if candidate_xp<>total or candidate_xp<>coalesce(last_xp,0) or candidate_level<>coalesce(last_level,0)
   or exists(select 1 from (
     select r.*,lag(next_xp,1,0::bigint)over(order by sequence) expected_xp,
       lag(next_level,1,0::smallint)over(order by sequence) expected_level
     from private.xp_award_receipts r where actor_id=actor and skill_code=code
   ) s where previous_xp<>expected_xp or previous_level<>expected_level
     or next_level<>private.xp_initial_level(next_xp,starter_count)) then
   raise exception using errcode='23514',message='Kanonik yetenek ile değişmez XP makbuz zinciri uyuşmuyor.';end if;
end $$;

create function private.xp_receipt_guard() returns trigger
language plpgsql volatile security invoker set search_path='' as $$
declare r private.xp_runtime;p private.xp_policies;e private.xp_verified_completions;
 s private.actor_skills;t timestamptz;dy date;wk date;rights integer;daily_total bigint;skill_total bigint;daily_practice integer;weekly_practice integer;
begin
 r:=private.xp_require_disposable();
 select * into strict e from private.xp_verified_completions where claim_id=new.claim_id;
 perform private.a22_lock_player(e.actor_id);
 perform 1 from auth.users where id=(select profile_id from private.actors where id=e.actor_id) for key share;
 select * into strict p from private.xp_policies where policy_id=r.policy_id and version=r.policy_version;
 perform 1 from private.skill_catalog where code=e.skill_code and is_active for share;
 if not found or exists(select 1 from private.xp_completion_revocations where claim_id=e.claim_id) then
   raise exception using errcode='23514',message='Etkin alan ve iptal edilmemiş doğrulanmış kaynak gerekli.';end if;
 select * into strict s from private.actor_skills where actor_id=e.actor_id and skill=e.skill_code for update;
 -- Time sampled AFTER every potentially contended lock. Reservation day is never used.
 t:=private.xp_server_now();select day,week_start,unlocked into dy,wk,rights from private.xp_periods(t);
 select coalesce(sum(awarded_xp),0),coalesce(sum(awarded_xp)filter(where skill_code=e.skill_code),0),
   count(*)filter(where skill_code=e.skill_code and activity_kind='practice')
 into daily_total,skill_total,daily_practice from private.xp_award_receipts where actor_id=e.actor_id and earned_on=dy;
 select count(*) into weekly_practice from private.xp_award_receipts where actor_id=e.actor_id and skill_code=e.skill_code and activity_kind='practice' and week_start=wk;
 new.actor_id:=e.actor_id;new.skill_code:=e.skill_code;new.verification_ref:=e.verification_ref;new.evidence_hash:=e.evidence_hash;
 new.policy_id:=p.policy_id;new.policy_version:=p.version;new.activity_kind:=e.activity_kind;new.definition_code:=e.definition_code;
 new.awarded_xp:=(p.rewards->>e.activity_kind)::integer;
 if daily_total+new.awarded_xp>p.general_daily or skill_total+new.awarded_xp>p.skill_daily then
   raise exception using errcode='23514',message='Test güvenlik reddi: günlük XP tavanı; kaynak ödüllendirilmedi.';end if;
 if e.activity_kind='practice' and (daily_practice>=p.practice_daily or weekly_practice>=least(p.practice_weekly,rights)) then
   raise exception using errcode='23514',message='Test güvenlik reddi: günlük/haftalık açılmış uygulama hakkı yok.';end if;
 new.previous_xp:=s.xp;new.previous_level:=s.level;new.next_xp:=s.xp+new.awarded_xp;
 -- Pending boundary policy: fail closed in the disposable adapter, no partial XP or banking choice.
 if new.next_xp>140 then raise exception using errcode='23514',message='Test güvenlik reddi: onaylanmamış üst aşama/birikim davranışı.';end if;
 select count(*) into new.starter_count from private.xp_verified_completions c
   where c.actor_id=e.actor_id and c.skill_code=e.skill_code and c.activity_kind='starter'
     and not exists(select 1 from private.xp_completion_revocations v where v.claim_id=c.claim_id);
 new.next_level:=private.xp_initial_level(new.next_xp,new.starter_count);
 new.earned_at:=t;new.earned_on:=dy;new.week_start:=wk;
 -- Re-check under the same serialization fence immediately before committing the award.
 if private.player_blocked((select profile_id from private.actors where id=e.actor_id),false)
   or not exists(select 1 from public.memberships where user_id=(select profile_id from private.actors where id=e.actor_id))
   or exists(select 1 from private.xp_completion_revocations where claim_id=e.claim_id) then
   raise exception using errcode='42501',message='Kaynak/üyelik/yaptırım doğrulaması geçersiz.';end if;
 return new;
end $$;
create function private.xp_receipt_apply() returns trigger
language plpgsql volatile security invoker set search_path='' as $$
begin
 update private.actor_skills set xp=new.next_xp,level=new.next_level where actor_id=new.actor_id and skill=new.skill_code;
 return null;
end $$;
create trigger xp_receipt_insert before insert on private.xp_award_receipts for each row execute function private.xp_receipt_guard();
create trigger xp_receipt_apply after insert on private.xp_award_receipts for each row execute function private.xp_receipt_apply();

create function private.award_verified_xp(claim uuid) returns private.xp_award_receipts
language plpgsql volatile security invoker set search_path='' as $$
declare a uuid;result private.xp_award_receipts;
begin
 perform private.xp_require_disposable();
 select actor_id into a from private.xp_verified_completions where claim_id=claim;
 if a is null then raise exception using errcode='23514',message='Taslak veya kaynak UUID yeterli değil; ayrı doğrulanmış tamamlanma gerekli.';end if;
 perform private.a22_lock_player(a);
 select * into result from private.xp_award_receipts where claim_id=claim;
 if found then return result;end if; -- immutable prior result, not a new policy/day award
 insert into private.xp_award_receipts(claim_id) values(claim) returning * into result;
 return result;
end $$;

-- Replace only the player consistency branch; the complete fixed NPC branch stays byte-identical.
create or replace function private.a1_assert_actor(target uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare a private.actors; b private.bot_profiles; n integer; required text[]; taught text[]; s private.actor_skills;
begin
 select * into strict a from private.actors where id=target;
 if a.kind='player' then
   required:=array(select code from private.skill_catalog where is_initial
     union all select skill_code from private.player_skill_enrollments where actor_id=target);
   if (select count(*) from private.actor_skills where actor_id=target)<>cardinality(required)
     or exists(select 1 from private.actor_skills where actor_id=target and (not(skill=any(required)))) then
     raise exception using errcode='23514',message='Dört başlangıç ve yalnız açık kayıtlı ek yetenekler gerekli.';
   end if;
   for s in select * from private.actor_skills where actor_id=target loop
     perform private.xp_assert_skill(target,s.skill,s.xp,s.level);
   end loop;
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


create or replace function private.a1_fixed_row_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and TG_TABLE_NAME='actor_skills' then
   perform private.a2_owner_check();
   if new.actor_id=old.actor_id and new.skill=old.skill and new.xp>old.xp
     and exists(select 1 from private.actors where id=new.actor_id and kind='player')
     and exists(select 1 from private.xp_award_receipts where actor_id=new.actor_id and skill_code=new.skill
       and previous_xp=old.xp and previous_level=old.level and next_xp=new.xp and next_level=new.level) then
     perform private.xp_assert_skill(new.actor_id,new.skill,new.xp,new.level);
     return new;
   end if;
   raise exception using errcode='23514',message='XP yalnız atomik, doğrulanmış ve makbuzla uzlaştırılmış ödülle değişebilir.';
 end if;
 if TG_OP='UPDATE' and TG_TABLE_NAME in ('actors','npc_population_plans') then
   if (to_jsonb(new)-'guard_revision')=(to_jsonb(old)-'guard_revision')
      and new.guard_revision=old.guard_revision+1 then return new;end if;
 end if;
 raise exception using errcode='23514',message='A1 kimliği, planı ve sabit değerleri değiştirilemez.';
end $$;
create function private.xp_skill_initial_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from private.actors where id=new.actor_id and kind='player') and (new.level<>0 or new.xp<>0) then
   raise exception using errcode='23514',message='Yeni oyuncu yeteneği 0 seviye/0 XP başlamalı.';end if;
 return new;
end $$;
create trigger xp_skill_initial before insert on private.actor_skills for each row execute function private.xp_skill_initial_guard();
create trigger xp_skill_no_truncate before truncate on private.actor_skills for each statement execute function private.a2_immutable_guard();
create function private.xp_receipt_complete() returns trigger
language plpgsql security invoker set search_path='' as $$
begin perform private.a1_assert_actor(new.actor_id);return null;end $$;
create constraint trigger xp_receipt_complete after insert on private.xp_award_receipts
 deferrable initially deferred for each row execute function private.xp_receipt_complete();

do $$ declare t text;f regprocedure;begin
 foreach t in array array['xp_policies','xp_runtime','xp_completion_definitions','xp_verified_completions','xp_completion_revocations','xp_award_receipts'] loop
   execute format('alter table private.%I enable row level security',t);
   execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
   if t<>'xp_runtime' then
     execute format('create trigger xp_immutable before update or delete on private.%I for each row execute function private.a2_immutable_guard()',t);
   end if;
   execute format('create trigger xp_no_truncate before truncate on private.%I for each statement execute function private.a2_immutable_guard()',t);
 end loop;
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and (p.proname like 'xp_%' or p.proname in('record_test_xp_completion','award_verified_xp')) loop
   execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
end $$;
revoke all on sequence private.xp_award_receipts_sequence_seq from public,anon,authenticated,service_role;
comment on table private.xp_policies is 'Approved numbers only. Immutable versions. No 4–10 achievement rules, bonuses, paid-work XP or active learning paths.';
comment on table private.xp_runtime is 'Disabled on migration. Only synthetic disposable DB adapter exists; owner mode change is not a live launch path.';
comment on table private.xp_verified_completions is 'Empty owner-only synthetic attestation child of the sole xp_source_claims journal; draft keys are never authoritative. A reviewed real adapter is still required.';
comment on table private.xp_award_receipts is 'Immutable reward and usage facts, not a second balance. Canonical XP remains actor_skills; all values reconcile in one transaction. Above-140 and cap refusal are TEST-ONLY safety semantics, pending product approval.';
comment on table private.actor_skills is 'Canonical level/XP. Player initialization 0/0; later values must exactly reconcile immutable approved award receipts. Fixed NPC levels and XP0 unchanged. Production award adapter disabled.';
comment on table private.xp_source_claims is 'Immutable source identity reservation, never an award by itself. xp_award_receipts may record ONE verified applied reward; actor_skills stays canonical. reserved_on is not the earned day. Pre-A2-2b reservations cannot become new verified completions.';
comment on table private.learning_evidence_drafts is 'DRAFT-only answer evidence, never a real completion or XP entitlement. A2-2b provides no draft conversion; canonical player progress requires a separate approved immutable award receipt. Fixture answer keys do not prove learning.';
