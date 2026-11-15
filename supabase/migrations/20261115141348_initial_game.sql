-- Only a NEW, empty APARTMAN project. All authoritative writes go through checked RPCs.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
 created_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles(lower(username));
create table public.buildings (
 id uuid primary key default gen_random_uuid(), slug text unique not null,
 name text not null, treasury integer not null default 5000 check(treasury >= 0)
);
create table public.apartments (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 number integer not null check(number between 1 and 12), unique(building_id,number), unique(id,building_id)
);
create table public.memberships (
 user_id uuid primary key references public.profiles,
 building_id uuid not null references public.buildings,
 apartment_id uuid not null unique, joined_at timestamptz not null default now(),
 last_message_at timestamptz,
 foreign key(apartment_id,building_id) references public.apartments(id,building_id)
);
create index memberships_building on public.memberships(building_id);
create table private.invitations (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 code_hash bytea unique not null, expires_at timestamptz not null,
 uses_remaining integer not null check(uses_remaining >= 0)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 author_id uuid not null references public.profiles, body text not null check(char_length(btrim(body)) between 1 and 500),
 created_at timestamptz not null default clock_timestamp()
);
create index messages_history on public.messages(building_id,created_at desc,id);
create index messages_author on public.messages(author_id);
create table public.blocks (
 user_id uuid not null references public.profiles, blocked_id uuid not null references public.profiles,
 primary key(user_id,blocked_id), check(user_id <> blocked_id)
);
create index blocks_target on public.blocks(blocked_id);
create table public.message_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles,
 message_id uuid not null references public.messages, reason text not null check(char_length(btrim(reason)) between 3 and 300),
 created_at timestamptz not null default now(), status text not null default 'pending' check(status in ('pending','reviewed')),
 unique(reporter_id,message_id)
);
create index reports_message on public.message_reports(message_id);
create table public.events (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 kind text not null, title text not null, description text not null, cost integer not null check(cost>=0),
 unique(building_id,kind)
);
create table public.polls (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 event_id uuid not null unique references public.events,
 starts_at timestamptz not null default now(), ends_at timestamptz not null default now()+interval '24 hours',
 status text not null default 'open' check(status in ('open','accepted','rejected')),
 yes_count integer not null default 0, no_count integer not null default 0,
 resolved_at timestamptz, check(ends_at > starts_at)
);
create index polls_building on public.polls(building_id);
create table public.votes (
 poll_id uuid not null references public.polls, user_id uuid not null references public.profiles,
 choice boolean not null, created_at timestamptz not null default clock_timestamp(), primary key(poll_id,user_id)
);
create index votes_user on public.votes(user_id);
create table public.treasury_transactions (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 poll_id uuid not null unique references public.polls, amount integer not null check(amount<0),
 created_at timestamptz not null default now()
);
create index transactions_building on public.treasury_transactions(building_id);
create table public.activity (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 kind text not null, description text not null, created_at timestamptz not null default clock_timestamp()
);
create index activity_history on public.activity(building_id,created_at desc);
create table public.announcements (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings,
 title text not null, body text not null, created_at timestamptz not null default now()
);
create index announcements_building on public.announcements(building_id);

create function private.my_building() returns uuid language sql stable security definer set search_path='' as $$
 select building_id from public.memberships where user_id=(select auth.uid())
$$;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username) values(new.id,new.raw_user_meta_data->>'username');
 return new;
end $$;
create trigger create_profile after insert on auth.users for each row execute function private.create_profile();

-- Single apartment lock serializes allocation AND invitation consumption.
create function private.join_building(invite_code text) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; a uuid; inv private.invitations; u uuid := auth.uid(); p uuid;
begin
 if u is null then raise exception 'Oturum açmalısınız.'; end if;
 select building_id into b from private.invitations where code_hash=sha256(convert_to(btrim(invite_code),'UTF8'));
 if b is null then raise exception 'Davetiye geçersiz veya süresi dolmuş.'; end if;
 perform 1 from public.buildings where id=b for update;
 select * into inv from private.invitations where code_hash=sha256(convert_to(btrim(invite_code),'UTF8')) for update;
 if not found or inv.expires_at <= clock_timestamp() or inv.uses_remaining<1 then raise exception 'Davetiye geçersiz veya süresi dolmuş.'; end if;
 if exists(select 1 from public.memberships where user_id=u) then raise exception 'Zaten bir daireniz var.'; end if;
 select ap.id into a from public.apartments ap where ap.building_id=b and not exists(select 1 from public.memberships m where m.apartment_id=ap.id) order by ap.number limit 1;
 if a is null then raise exception 'Apartman dolu. Boş daire bulunmuyor.'; end if;
 insert into public.memberships(user_id,building_id,apartment_id) values(u,b,a);
 update private.invitations set uses_remaining=uses_remaining-1 where id=inv.id;
 insert into public.activity(building_id,kind,description) select b,'move_in',username||' apartmana taşındı.' from public.profiles where id=u;
 -- The first resident starts the first 24-hour event, not deployment time.
 insert into public.polls(building_id,event_id)
 select b,id from public.events where building_id=b and kind='elevator_repair'
 on conflict(event_id) do nothing returning id into p;
 if p is not null then
 insert into public.activity(building_id,kind,description) values(b,'poll_started','Asansör tamiri oylaması başladı. Süre: 24 saat.');
 end if;
end $$;
create function public.join_building(invite_code text) returns void language sql security invoker set search_path='' as $$ select private.join_building(invite_code) $$;

create function private.send_message(message_body text) returns void language plpgsql security definer set search_path='' as $$
declare m public.memberships; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Oturum açmalısınız.'; end if;
 select * into m from public.memberships where user_id=u for update;
 if not found then raise exception 'Apartman sakini olmalısınız.'; end if;
 if char_length(btrim(message_body)) not between 1 and 500 or message_body is null then raise exception 'Mesaj 1–500 karakter olmalı.'; end if;
 if m.last_message_at > clock_timestamp()-interval '2 seconds' then raise exception 'Yeni mesaj için 2 saniye bekleyin.'; end if;
 insert into public.messages(building_id,author_id,body) values(m.building_id,u,btrim(message_body));
 update public.memberships set last_message_at=clock_timestamp() where user_id=u;
end $$;
create function public.send_message(message_body text) returns void language sql security invoker set search_path='' as $$ select private.send_message(message_body) $$;

create function private.cast_vote(target_poll uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; p public.polls; u uuid:=auth.uid();
begin
 b:=private.my_building();
 if u is null or b is null then raise exception 'Apartman sakini olmalısınız.'; end if;
 perform 1 from public.buildings where id=b for update;
 select * into p from public.polls where id=target_poll and building_id=b for update;
 if not found then raise exception 'Oylama bulunamadı.'; end if;
 if p.status<>'open' or p.ends_at<=clock_timestamp() or p.starts_at>clock_timestamp() then raise exception 'Oylama sona erdi veya henüz başlamadı.'; end if;
 if exists(select 1 from public.votes where poll_id=p.id and user_id=u) then raise exception 'Bu oylamada zaten oy kullandınız.'; end if;
 insert into public.votes(poll_id,user_id,choice) values(p.id,u,approve);
 update public.polls set yes_count=yes_count+case when approve then 1 else 0 end,
 no_count=no_count+case when approve then 0 else 1 end where id=p.id;
end $$;
create function public.cast_vote(target_poll uuid,approve boolean) returns void language sql security invoker set search_path='' as $$ select private.cast_vote(target_poll,approve) $$;

-- Internal worker is callable ONLY by postgres, never anon/authenticated.
create function private.resolve_poll(target_poll uuid) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; p public.polls; yeses integer; noes integer; price integer; event_title text; cash integer; accepted boolean;
begin
 select building_id into b from public.polls where id=target_poll;
 if b is null then return; end if;
 select treasury into cash from public.buildings where id=b for update;
 select * into p from public.polls where id=target_poll for update;
 if p.status<>'open' or p.ends_at>clock_timestamp() then return; end if;
 select count(*) filter(where choice),count(*) filter(where not choice) into yeses,noes from public.votes where poll_id=p.id;
 select cost,title into price,event_title from public.events where id=p.event_id;
 accepted:=yeses+noes>=3 and yeses>noes and cash>=price;
 update public.polls set status=case when accepted then 'accepted' else 'rejected' end,yes_count=yeses,no_count=noes,resolved_at=clock_timestamp() where id=p.id;
 if accepted and price>0 then
 insert into public.treasury_transactions(building_id,poll_id,amount) values(b,p.id,-price);
 update public.buildings set treasury=treasury-price where id=b;
 insert into public.activity(building_id,kind,description) values(b,'expense','Apartman kasasından '||price||' oyun parası harcandı.');
 end if;
 insert into public.activity(building_id,kind,description) values(b,'poll_resolved',event_title||case when accepted then ': karar kabul edildi.' else ': karar reddedildi (çoğunluk, katılım veya bütçe koşulu sağlanmadı).' end);
end $$;
create function private.settle_polls() returns void language plpgsql security definer set search_path='' as $$
declare p record; b uuid:=private.my_building();
begin
 if auth.uid() is null or b is null then raise exception 'Apartman sakini olmalısınız.'; end if;
 for p in select id from public.polls where building_id=b and status='open' and ends_at<=clock_timestamp() loop
 perform private.resolve_poll(p.id);
 end loop;
end $$;
create function public.settle_polls() returns void language sql security invoker set search_path='' as $$ select private.settle_polls() $$;

-- RLS: no direct mutations of game state. Only per-user blocks/reports are writable.
do $$ declare t text; begin
 foreach t in array array['profiles','buildings','apartments','memberships','messages','blocks','message_reports','events','polls','votes','treasury_transactions','activity','announcements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter table private.invitations enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()) or exists(select 1 from public.memberships m where m.user_id=profiles.id and m.building_id=(select private.my_building())));
create policy membership_read on public.memberships for select to authenticated using(user_id=(select auth.uid()) or building_id=(select private.my_building()));
do $$ declare t text; begin
 foreach t in array array['buildings','apartments','events','polls','treasury_transactions','activity','announcements'] loop
 execute format('create policy resident_read on public.%I for select to authenticated using (%s=(select private.my_building()))',t,case when t='buildings' then 'id' else 'building_id' end);
 end loop;
end $$;
create policy message_read on public.messages for select to authenticated using(building_id=(select private.my_building()) and not exists(select 1 from public.blocks where user_id=(select auth.uid()) and blocked_id=author_id));
create policy own_vote on public.votes for select to authenticated using(user_id=(select auth.uid()));
create policy own_blocks on public.blocks for select to authenticated using(user_id=(select auth.uid()));
create policy add_block on public.blocks for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.user_id=blocked_id and m.building_id=(select private.my_building())));
create policy remove_block on public.blocks for delete to authenticated using(user_id=(select auth.uid()));
create policy own_reports on public.message_reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy add_report on public.message_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and m.author_id<>(select auth.uid())));
grant insert,delete on public.blocks to authenticated;
grant insert(reporter_id,message_id,reason) on public.message_reports to authenticated;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.my_building(),private.join_building(text),private.send_message(text),private.cast_vote(uuid,boolean),private.settle_polls() to authenticated;
revoke all on function public.join_building(text),public.send_message(text),public.cast_vote(uuid,boolean),public.settle_polls() from public,anon;
grant execute on function public.join_building(text),public.send_message(text),public.cast_vote(uuid,boolean),public.settle_polls() to authenticated;

insert into public.buildings(slug,name) values('cinar','Çınar Apartmanı');
insert into public.apartments(building_id,number) select b.id,n from public.buildings b cross join generate_series(1,12) n where b.slug='cinar';
insert into public.events(building_id,kind,title,description,cost) select id,'elevator_repair','Asansör arızası','Asansör bozuldu. Tamir için ortak kasadan 1.200 oyun parası harcanmasını onaylıyor musunuz?',1200 from public.buildings where slug='cinar';
insert into public.announcements(building_id,title,body) select id,'Çınar’a hoş geldiniz','Burası birlikte şekillendireceğimiz küçük bir dünya. Komşularınızla tanışın, ilk ortak kararınıza katılın.' from public.buildings where slug='cinar';
alter publication supabase_realtime add table public.messages,public.memberships,public.polls,public.buildings,public.activity;
