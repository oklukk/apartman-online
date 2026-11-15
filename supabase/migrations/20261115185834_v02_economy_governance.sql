set local lock_timeout='5s';
-- Additive v0.2: no old rows, balances, invitations, votes or migration history are rewritten.
create table public.economy_settings (
 building_id uuid primary key references public.buildings,
 first_week date not null default ((date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')+interval '7 days')::date),
 initial_balance integer not null default 300 check(initial_balance>=0),
 daily_salary integer not null default 100 check(daily_salary>=0),
 side_job_reward integer not null default 25 check(side_job_reward>=0),
 weekly_dues integer not null default 150 check(weekly_dues between 100 and 200),
 cleaning_base integer not null default 80 check(cleaning_base>=0), cleaning_per_resident integer not null default 20 check(cleaning_per_resident>=0),
 maintenance_base integer not null default 50 check(maintenance_base>=0), maintenance_per_resident integer not null default 10 check(maintenance_per_resident>=0)
);
insert into public.economy_settings(building_id) select id from public.buildings;
create table public.wallets (
 user_id uuid primary key references public.profiles, building_id uuid not null references public.buildings,
 balance integer not null default 0 check(balance>=0),
 job text check(job in ('office','shop','technical')), job_changed_at timestamptz, employment_started_on date,
 last_active_at timestamptz not null default clock_timestamp(), side_job_started_at timestamptz
);
create index wallets_building on public.wallets(building_id);
create table public.wallet_transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.wallets,
 building_id uuid not null references public.buildings, amount integer not null check(amount<>0), balance_after integer not null check(balance_after>=0),
 kind text not null check(kind in ('starting','salary','side_job','dues')), period_key text not null,
 description text not null, created_at timestamptz not null default clock_timestamp(), unique(user_id,kind,period_key)
);
create index wallet_history on public.wallet_transactions(user_id,created_at desc);
create index wallet_transactions_building on public.wallet_transactions(building_id);
create table public.dues_rates (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 effective_week date not null check(extract(isodow from effective_week)=1), amount integer not null check(amount between 100 and 200),
 poll_id uuid not null unique references public.polls, unique(building_id,effective_week)
);
create table public.dues (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 user_id uuid not null references public.wallets, week_start date not null, amount integer not null check(amount>0), paid_at timestamptz,
 unique(user_id,week_start)
);
create index dues_building on public.dues(building_id);
create table public.operating_expenses (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 week_start date not null, kind text not null check(kind in ('cleaning','maintenance')),
 active_residents integer not null check(active_residents>=0), amount integer not null check(amount>=0), paid_at timestamptz,
 unique(building_id,week_start,kind)
);
create table public.treasury_entries (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 amount integer not null check(amount<>0), kind text not null check(kind in ('dues','cleaning','maintenance')),
 source_key text not null unique, description text not null, created_at timestamptz not null default clock_timestamp()
);
create index treasury_entries_building on public.treasury_entries(building_id,created_at desc);
create view public.treasury_history with (security_invoker=true) as
 select t.id,t.building_id,t.amount,'poll'::text as kind,coalesce(e.title,'Ortak karar') as description,t.created_at
 from public.treasury_transactions t join public.polls p on p.id=t.poll_id join public.events e on e.id=p.event_id
 union all select id,building_id,amount,kind,description,created_at from public.treasury_entries;
create table public.expense_catalog (
 kind text primary key, title text not null, cost integer not null check(cost>0)
);
insert into public.expense_catalog values('door','Apartman kapısının onarılması',300),('common_area','Ortak alan bakımı',250),('improvement','Küçük temizlik ve iyileştirme',200);
create table public.elections (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 starts_at timestamptz not null default clock_timestamp(), nominations_end timestamptz not null default clock_timestamp()+interval '24 hours',
 voting_end timestamptz not null default clock_timestamp()+interval '72 hours',
 status text not null default 'nominations' check(status in ('nominations','voting','elected','failed')),
 electorate_size integer not null check(electorate_size>=2), quorum integer not null check(quorum>=2),
 winner_id uuid references public.profiles, result_reason text, resolved_at timestamptz, retry_after timestamptz,
 check(nominations_end>starts_at and voting_end>nominations_end)
);
create unique index one_open_election on public.elections(building_id) where status in ('nominations','voting');
create index elections_winner on public.elections(winner_id);
create index elections_building_history on public.elections(building_id,starts_at desc);
create table public.election_electorate (
 election_id uuid not null references public.elections, user_id uuid not null references public.profiles,
 building_id uuid not null references public.buildings, primary key(election_id,user_id)
);
create index electorate_user on public.election_electorate(user_id);
create index electorate_building on public.election_electorate(building_id);
create table public.election_candidates (
 election_id uuid not null, user_id uuid not null, building_id uuid not null references public.buildings,
 statement text not null check(char_length(btrim(statement)) between 3 and 300),
 created_at timestamptz not null default clock_timestamp(), primary key(election_id,user_id),
 foreign key(election_id,user_id) references public.election_electorate(election_id,user_id)
);
create index candidates_user on public.election_candidates(user_id);
create index candidates_building on public.election_candidates(building_id);
create table public.election_votes (
 election_id uuid not null, user_id uuid not null, candidate_id uuid not null,
 building_id uuid not null references public.buildings, created_at timestamptz not null default clock_timestamp(),
 primary key(election_id,user_id), foreign key(election_id,user_id) references public.election_electorate(election_id,user_id),
 foreign key(election_id,candidate_id) references public.election_candidates(election_id,user_id)
);
create index election_votes_candidate on public.election_votes(election_id,candidate_id);
create index election_votes_user on public.election_votes(user_id);
create index election_votes_building on public.election_votes(building_id);
create table public.manager_terms (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 election_id uuid not null unique references public.elections, user_id uuid not null references public.profiles,
 starts_at timestamptz not null, ends_at timestamptz not null, check(ends_at=starts_at+interval '14 days')
);
create index manager_terms_building on public.manager_terms(building_id,ends_at desc);
create index manager_terms_user on public.manager_terms(user_id);
alter table public.events add column proposal_type text not null default 'expense' check(proposal_type in ('expense','dues')),
 add column dues_amount integer check(dues_amount between 100 and 200);
alter table public.polls add column minimum_votes integer not null default 3 check(minimum_votes>=2);

-- All money writers lock building, then wallet/decision in that order.
create function private.wallet_post(u uuid,amt integer,k text,period text,label text) returns boolean language plpgsql security definer set search_path='' as $$
declare w public.wallets;
begin
 select * into strict w from public.wallets where user_id=u for update;
 if w.balance+amt<0 then raise exception 'Yetersiz kişisel bakiye.'; end if;
 if amt=0 then return false; end if;
 insert into public.wallet_transactions(user_id,building_id,amount,balance_after,kind,period_key,description)
 values(u,w.building_id,amt,w.balance+amt,k,period,label) on conflict(user_id,kind,period_key) do nothing;
 if not found then return false; end if;
 update public.wallets set balance=balance+amt where user_id=u;
 return true;
end $$;
create function private.create_wallet() returns trigger language plpgsql security definer set search_path='' as $$
declare initial integer;
begin
 insert into public.wallets(user_id,building_id) values(new.user_id,new.building_id) on conflict(user_id) do nothing;
 select initial_balance into initial from public.economy_settings where building_id=new.building_id;
 perform private.wallet_post(new.user_id,initial,'starting','once','Bir defalık başlangıç bakiyesi');
 return new;
end $$;
create trigger membership_wallet after insert on public.memberships for each row execute function private.create_wallet();
-- Existing residents get exactly one ledger-backed 300 OP grant. No treasury mutation.
insert into public.wallets(user_id,building_id) select user_id,building_id from public.memberships on conflict(user_id) do nothing;
do $$ declare grant_row record; begin for grant_row in select wal.user_id,s.initial_balance from public.wallets wal join public.economy_settings s using(building_id) order by wal.user_id loop
 perform private.wallet_post(grant_row.user_id,grant_row.initial_balance,'starting','once','Bir defalık başlangıç bakiyesi'); end loop; end $$;

create function private.treasury_post(b uuid,amt integer,k text,source text,label text) returns void language plpgsql security definer set search_path='' as $$
declare cash integer;
begin
 select treasury into strict cash from public.buildings where id=b for update;
 if cash+amt<0 then raise exception 'Apartman kasası yetersiz.'; end if;
 if amt=0 then return; end if;
 insert into public.treasury_entries(building_id,amount,kind,source_key,description) values(b,amt,k,source,label) on conflict(source_key) do nothing;
 if found then update public.buildings set treasury=treasury+amt where id=b; end if;
end $$;
create function private.current_manager(b uuid) returns uuid language sql volatile security definer set search_path='' as $$
 select user_id from public.manager_terms where building_id=b and starts_at<=clock_timestamp() and ends_at>clock_timestamp() order by starts_at desc limit 1
$$;

create function private.economy_tick(b uuid) returns void language plpgsql security definer set search_path='' as $$
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
 select coalesce((select amount from public.dues_rates where building_id=b and effective_week<=wk order by effective_week desc limit 1),s.weekly_dues) into rate;
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
create function private.election_tick(b uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.elections; n integer; eid uuid; winner uuid; total integer; top_count integer; ties integer; term_end timestamptz; start_term timestamptz; retry timestamptz;
begin
 perform 1 from public.buildings where id=b for update;
 select * into e from public.elections where building_id=b and status in ('nominations','voting') for update;
 if found then
 if e.nominations_end<=clock_timestamp() and e.status='nominations' then
 update public.elections set status='voting' where id=e.id;
 end if;
 if e.voting_end<=clock_timestamp() then
 select count(*) into total from public.election_votes where election_id=e.id;
 select max(votes) into top_count from (select c.user_id,count(v.user_id) votes from public.election_candidates c left join public.election_votes v on v.election_id=c.election_id and v.candidate_id=c.user_id where c.election_id=e.id group by c.user_id) x;
 select count(*) into ties from (select c.user_id,count(v.user_id) votes from public.election_candidates c left join public.election_votes v on v.election_id=c.election_id and v.candidate_id=c.user_id where c.election_id=e.id group by c.user_id) x where votes=top_count;
 if total>=e.quorum and ties=1 then
 select candidate_id into winner from public.election_votes where election_id=e.id group by candidate_id order by count(*) desc limit 1;
 end if;
 if winner is not null then
 select max(ends_at) into term_end from public.manager_terms where building_id=b;
 start_term:=greatest(clock_timestamp(),coalesce(term_end,clock_timestamp()));
 insert into public.manager_terms(building_id,election_id,user_id,starts_at,ends_at) values(b,e.id,winner,start_term,start_term+interval '14 days');
 update public.elections set status='elected',winner_id=winner,resolved_at=clock_timestamp(),result_reason='Yeterli katılım ve tek kazanan' where id=e.id;
 insert into public.activity(building_id,kind,description) select b,'manager_elected',username||' 14 günlük görev için yönetici seçildi.' from public.profiles where id=winner;
 else
 update public.elections set status='failed',resolved_at=clock_timestamp(),retry_after=clock_timestamp()+interval '24 hours',
 result_reason=case when top_count is null then 'Aday çıkmadı' when total<e.quorum then 'Yeterli katılım olmadı' else 'Oylar eşit' end where id=e.id;
 insert into public.activity(building_id,kind,description) values(b,'election_failed','Seçim sonuçsuz kaldı. 24 saat sonra yeniden adaylık açılacak; mevcut görev süresi uzamaz.');
 end if;
 end if;
 end if;
 if not exists(select 1 from public.elections where building_id=b and status in ('nominations','voting')) then
 select count(*) into n from public.memberships where building_id=b;
 select max(ends_at) into term_end from public.manager_terms where building_id=b;
 select retry_after into retry from public.elections where building_id=b order by starts_at desc,id desc limit 1;
 if n>=2 and (term_end is null or term_end<=clock_timestamp()+interval '72 hours') and (retry is null or retry<=clock_timestamp()) then
 insert into public.elections(building_id,electorate_size,quorum) values(b,n,greatest(2,ceil(n/2.0)::integer)) returning id into eid;
 insert into public.election_electorate(election_id,user_id,building_id) select eid,user_id,b from public.memberships where building_id=b;
 insert into public.activity(building_id,kind,description) values(b,'election_started','Yönetici seçimi: 24 saat adaylık, ardından 48 saat oy verme.');
 end if;
 end if;
end $$;
create function private.run_v02() returns void language plpgsql security definer set search_path='' as $$
declare b record;
begin
 if not pg_try_advisory_xact_lock(741029021) then return; end if;
 for b in select building_id from public.economy_settings order by building_id loop
 perform private.economy_tick(b.building_id); perform private.election_tick(b.building_id);
 end loop;
end $$;

create function private.player_action(action text,value text default null) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); b uuid:=private.my_building(); w public.wallets; d date:=(clock_timestamp() at time zone 'Europe/Istanbul')::date; amt integer;
begin
 if u is null or b is null then raise exception 'Apartman sakini olmalısınız.'; end if;
 perform 1 from public.buildings where id=b for update;
 select * into strict w from public.wallets where user_id=u for update;
 update public.wallets set last_active_at=clock_timestamp() where user_id=u;
 if action='heartbeat' then null;
 elsif action='job' then
 if value is null or value not in ('office','shop','technical') then raise exception 'Geçerli bir meslek seçin.'; end if;
 if w.job_changed_at>clock_timestamp()-interval '7 days' then raise exception 'Meslek değişikliği için 7 gün beklemelisiniz.'; end if;
 update public.wallets set job=value,job_changed_at=clock_timestamp(),employment_started_on=coalesce(employment_started_on,d),side_job_started_at=null where user_id=u;
 elsif action='side_start' then
 if w.job is null then raise exception 'Önce bir meslek seçmelisiniz.'; end if;
 if exists(select 1 from public.wallet_transactions where user_id=u and kind='side_job' and period_key=d::text) then raise exception 'Bugünkü ek iş tamamlandı.'; end if;
 update public.wallets set side_job_started_at=clock_timestamp() where user_id=u;
 elsif action='side_finish' then
 if w.job is null or w.side_job_started_at is null or (w.side_job_started_at at time zone 'Europe/Istanbul')::date<>d or w.side_job_started_at>clock_timestamp()-interval '3 seconds' then raise exception 'Ek işe başlayın ve en az 3 saniye bekleyin.'; end if;
 if exists(select 1 from public.wallet_transactions where user_id=u and kind='side_job' and period_key=d::text) then raise exception 'Bugünkü ek iş tamamlandı.'; end if;
 select side_job_reward into amt from public.economy_settings where building_id=b;
 perform private.wallet_post(u,amt,'side_job',d::text,'Günlük ek iş geliri');
 update public.wallets set side_job_started_at=null where user_id=u;
 else raise exception 'Geçersiz işlem.';
 end if;
 -- Only CURRENT-day salary, never retroactive catch-up.
 select * into strict w from public.wallets where user_id=u;
 if w.job is not null and w.employment_started_on<d then
 select daily_salary into amt from public.economy_settings where building_id=b;
 perform private.wallet_post(u,amt,'salary',d::text,'Günlük iş maaşı · '||d::text);
 end if;
end $$;
create function public.player_action(action text,value text default null) returns void language sql security invoker set search_path='' as $$select private.player_action(action,value)$$;
create function private.pay_dues(target_due uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); b uuid:=private.my_building(); d public.dues;
begin
 if u is null or b is null then raise exception 'Apartman sakini olmalısınız.'; end if;
 perform 1 from public.buildings where id=b for update;
 perform 1 from public.wallets where user_id=u for update;
 select * into d from public.dues where id=target_due and user_id=u and building_id=b for update;
 if not found then raise exception 'Aidat borcu bulunamadı.'; end if;
 if d.paid_at is not null then raise exception 'Bu aidat zaten ödendi.'; end if;
 perform private.wallet_post(u,-d.amount,'dues',d.id::text,'Haftalık aidat · '||d.week_start);
 perform private.treasury_post(b,d.amount,'dues','dues:'||d.id,'Aidat ödemesi · '||d.week_start);
 update public.dues set paid_at=clock_timestamp() where id=d.id;
 update public.wallets set last_active_at=clock_timestamp() where user_id=u;
end $$;
create function public.pay_dues(target_due uuid) returns void language sql security invoker set search_path='' as $$select private.pay_dues(target_due)$$;
create function private.election_action(target_election uuid,action text,value text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); b uuid:=private.my_building(); e public.elections; candidate uuid;
begin
 if u is null or b is null then raise exception 'Apartman sakini olmalısınız.'; end if;
 perform 1 from public.buildings where id=b for update;
 select * into e from public.elections where id=target_election and building_id=b for update;
 if not found or not exists(select 1 from public.election_electorate where election_id=e.id and user_id=u) then raise exception 'Bu seçimin seçmen listesinde değilsiniz.'; end if;
 if action='candidate' then
 if e.status<>'nominations' or clock_timestamp()<e.starts_at or clock_timestamp()>=e.nominations_end then raise exception 'Adaylık süresi kapandı.'; end if;
 if value is null or char_length(btrim(value)) not between 3 and 300 then raise exception 'Seçim vaadi 3–300 karakter olmalı.'; end if;
 if exists(select 1 from public.election_candidates where election_id=e.id and user_id=u) then raise exception 'Zaten adaysınız.'; end if;
 insert into public.election_candidates(election_id,user_id,building_id,statement) values(e.id,u,b,btrim(value));
 elsif action='vote' then
 if e.status not in ('nominations','voting') or clock_timestamp()<e.nominations_end or clock_timestamp()>=e.voting_end then raise exception 'Oy verme süresi açık değil.'; end if;
 begin candidate:=value::uuid; exception when invalid_text_representation then raise exception 'Geçersiz aday.'; end;
 if not exists(select 1 from public.election_candidates where election_id=e.id and user_id=candidate) then raise exception 'Geçersiz aday.'; end if;
 if exists(select 1 from public.election_votes where election_id=e.id and user_id=u) then raise exception 'Bu seçimde zaten oy kullandınız.'; end if;
 insert into public.election_votes(election_id,user_id,candidate_id,building_id) values(e.id,u,candidate,b);
 else raise exception 'Geçersiz seçim işlemi.'; end if;
 update public.wallets set last_active_at=clock_timestamp() where user_id=u;
end $$;
create function public.election_action(target_election uuid,action text,value text) returns void language sql security invoker set search_path='' as $$select private.election_action(target_election,action,value)$$;
create function private.propose_management(proposal text,new_dues integer default null) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); b uuid:=private.my_building(); title text; price integer; eid uuid; n integer; next_week date:=(date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')+interval '7 days')::date;
begin
 if u is null or b is null then raise exception 'Apartman sakini olmalısınız.'; end if;
 perform 1 from public.buildings where id=b for update;
 if private.current_manager(b) is distinct from u then raise exception 'Bu işlem yalnızca görevdeki yöneticiye açık.'; end if;
 if exists(select 1 from public.polls p join public.events e on e.id=p.event_id where p.building_id=b and p.status='open' and e.kind like 'proposal_%') then raise exception 'Önce açık yönetim teklifinin sonuçlanmasını bekleyin.'; end if;
 if proposal='dues' then
 if new_dues is null or new_dues not between 100 and 200 then raise exception 'Haftalık aidat 100–200 OP olmalı.'; end if;
 if exists(select 1 from public.dues_rates where building_id=b and effective_week>=next_week) then raise exception 'Gelecek dönem için onaylı aidat zaten var.'; end if;
 title:='Aidat değişikliği: '||new_dues||' OP / hafta'; price:=0;
 else
 select c.title,c.cost into title,price from public.expense_catalog c where c.kind=proposal;
 if not found then raise exception 'Hazır bakım türlerinden birini seçin.'; end if;
 end if;
 insert into public.events(building_id,kind,title,description,cost,proposal_type,dues_amount)
 values(b,'proposal_'||gen_random_uuid(),title,case when proposal='dues' then 'Kabul edilirse sonuçtan sonraki pazartesi geçerli olur; eski borçlar değişmez.' else 'Ortak kasadan sabit bedelli isteğe bağlı bakım. Kabulde kasa yeniden kontrol edilir.' end,price,case when proposal='dues' then 'dues' else 'expense' end,case when proposal='dues' then new_dues else null end) returning id into eid;
 select count(*) into n from public.memberships where building_id=b;
 insert into public.polls(building_id,event_id,minimum_votes) values(b,eid,greatest(2,ceil(n/2.0)::integer));
 insert into public.activity(building_id,kind,description) values(b,'proposal_started',title||' için 24 saatlik oylama başladı.');
 insert into public.announcements(building_id,title,body) values(b,title,'Yönetici önerisi ortak oylamaya sunuldu. Yönetim ekranından oy kullanabilirsiniz.');
end $$;
create function public.propose_management(proposal text,new_dues integer default null) returns void language sql security invoker set search_path='' as $$select private.propose_management(proposal,new_dues)$$;

-- Residents see building-wide COLLECTION TOTALS, never another person's private debt rows.
create function private.dues_overview() returns table(week_start date,assessed_count integer,paid_count integer,assessed_amount integer,paid_amount integer,unpaid_amount integer) language plpgsql stable security definer set search_path='' as $$
declare b uuid:=private.my_building();
begin
 if auth.uid() is null or b is null then return; end if;
 return query select d.week_start,count(*)::integer,count(*) filter(where d.paid_at is not null)::integer,
 sum(d.amount)::integer,coalesce(sum(d.amount) filter(where d.paid_at is not null),0)::integer,
 coalesce(sum(d.amount) filter(where d.paid_at is null),0)::integer
 from public.dues d where d.building_id=b group by d.week_start order by d.week_start desc;
end $$;
create function public.dues_overview() returns table(week_start date,assessed_count integer,paid_count integer,assessed_amount integer,paid_amount integer,unpaid_amount integer) language sql security invoker set search_path='' as $$select * from private.dues_overview()$$;

-- Old elevator polls retain minimum 3 votes, original votes and original ledger.
create or replace function private.resolve_poll(target_poll uuid) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; p public.polls; yeses integer; noes integer; ev public.events; cash integer; accepted boolean; wk date;
begin
 select building_id into b from public.polls where id=target_poll;
 if b is null then return; end if;
 select treasury into cash from public.buildings where id=b for update;
 select * into p from public.polls where id=target_poll for update;
 if p.status<>'open' or p.ends_at>clock_timestamp() then return; end if;
 select count(*) filter(where choice),count(*) filter(where not choice) into yeses,noes from public.votes where poll_id=p.id;
 select * into ev from public.events where id=p.event_id;
 accepted:=yeses+noes>=p.minimum_votes and yeses>noes and cash>=ev.cost;
 wk:=(date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')+interval '7 days')::date;
 if ev.proposal_type='dues' and exists(select 1 from public.dues_rates where building_id=b and effective_week=wk) then accepted:=false; end if;
 update public.polls set status=case when accepted then 'accepted' else 'rejected' end,yes_count=yeses,no_count=noes,resolved_at=clock_timestamp() where id=p.id;
 if accepted and ev.proposal_type='dues' then
 insert into public.dues_rates(building_id,effective_week,amount,poll_id) values(b,wk,ev.dues_amount,p.id);
 elsif accepted and ev.cost>0 then
 insert into public.treasury_transactions(building_id,poll_id,amount) values(b,p.id,-ev.cost);
 update public.buildings set treasury=treasury-ev.cost where id=b;
 insert into public.activity(building_id,kind,description) values(b,'expense','Apartman kasasından '||ev.cost||' oyun parası harcandı.');
 end if;
 insert into public.activity(building_id,kind,description) values(b,'poll_resolved',ev.title||case when accepted then ': karar kabul edildi.' else ': karar reddedildi (katılım, çoğunluk, bütçe veya dönem koşulu sağlanmadı).' end);
end $$;

-- Least privilege: no player may directly write any v0.2 state.
do $$ declare t text; begin
 foreach t in array array['economy_settings','wallets','wallet_transactions','dues_rates','dues','operating_expenses','treasury_entries','expense_catalog','elections','election_electorate','election_candidates','election_votes','manager_terms'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t in ('wallets','wallet_transactions','dues') then
 execute format('create policy own_economy on public.%I for select to authenticated using (user_id=(select auth.uid()) and building_id=(select private.my_building()))',t);
 elsif t='expense_catalog' then
 execute format('create policy resident_catalog on public.%I for select to authenticated using ((select private.my_building()) is not null)',t);
 else
 execute format('create policy resident_v02 on public.%I for select to authenticated using (building_id=(select private.my_building()))',t);
 end if;
 end loop;
end $$;
revoke all on public.treasury_history from public,anon,authenticated;
grant select on public.treasury_history to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
-- Restore only the old checked APIs and add the new checked APIs; internal workers remain private.
grant execute on function private.my_building(),private.join_building(text),private.send_message(text),private.cast_vote(uuid,boolean),private.settle_polls(),private.player_action(text,text),private.pay_dues(uuid),private.election_action(uuid,text,text),private.propose_management(text,integer),private.dues_overview() to authenticated;
revoke all on function public.player_action(text,text),public.pay_dues(uuid),public.election_action(uuid,text,text),public.propose_management(text,integer),public.dues_overview() from public,anon;
grant execute on function public.player_action(text,text),public.pay_dues(uuid),public.election_action(uuid,text,text),public.propose_management(text,integer),public.dues_overview() to authenticated;
alter publication supabase_realtime add table public.wallets,public.dues,public.operating_expenses,public.treasury_entries,public.elections,public.election_candidates,public.election_votes,public.manager_terms,public.dues_rates;
-- UTC cron wakes every minute; ALL day/week calculations use Europe/Istanbul in SQL.
select cron.schedule('apartman-v02-tick','* * * * *','select private.run_v02()');
-- Wallet backfill is immediate; first election starts on the next cron tick. First dues/expenses NEXT Monday only.
