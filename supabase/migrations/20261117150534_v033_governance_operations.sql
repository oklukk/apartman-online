set local lock_timeout='5s';
create extension if not exists btree_gist with schema extensions;
alter table public.manager_terms drop constraint manager_terms_check;
alter table public.manager_terms add constraint manager_terms_positive check(ends_at>starts_at);
alter table public.manager_terms alter column election_id drop not null;
alter table public.manager_terms add column voided boolean not null default false;
alter table public.manager_terms add constraint manager_terms_no_overlap exclude using gist (building_id extensions.gist_uuid_ops with =,tstzrange(starts_at,ends_at,'[)') with &&) where (not voided);
create or replace function private.current_manager(b uuid) returns uuid language sql volatile security definer set search_path='' as $$select user_id from public.manager_terms where building_id=b and not voided and starts_at<=clock_timestamp() and ends_at>clock_timestamp() order by starts_at desc limit 1$$;
create function private.staff_governance_snapshot(b uuid) returns jsonb language sql volatile security definer set search_path='' as $$
select jsonb_build_object('elections',coalesce((select jsonb_agg(to_jsonb(e) order by starts_at,id) from public.elections e where building_id=b),'[]'),
'candidates',coalesce((select jsonb_agg(to_jsonb(c) order by election_id,user_id) from public.election_candidates c where building_id=b),'[]'),
'votes',coalesce((select jsonb_agg(to_jsonb(v) order by election_id,user_id) from public.election_votes v where building_id=b),'[]'),
'manager_terms',coalesce((select jsonb_agg(to_jsonb(t) order by starts_at,id) from public.manager_terms t where building_id=b),'[]'),
'polls',coalesce((select jsonb_agg(to_jsonb(p) order by starts_at,id) from public.polls p where building_id=b),'[]'),
'poll_votes',coalesce((select jsonb_agg(to_jsonb(v) order by poll_id,user_id) from public.votes v join public.polls p on p.id=v.poll_id where p.building_id=b),'[]'),
 'treasury',(select treasury from public.buildings where id=b))
$$;
revoke all on function private.staff_governance_snapshot(uuid) from public,anon,authenticated;
create function private.staff_governance_state(target_building uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;begin
 if not private.staff_can('governance.read',target_building) and not private.staff_can('governance.elections.manage',target_building) and not private.staff_can('governance.elections.override',target_building) and not private.staff_can('governance.manager.appoint',target_building) then raise exception 'Yetkiniz yok.';end if;
 s:=private.staff_governance_snapshot(target_building);return jsonb_build_object('state',s,'revision',md5(s::text));end$$;
create function public.staff_governance_state(target_building uuid) returns jsonb language sql security invoker set search_path='' as $$select private.staff_governance_state(target_building)$$;
create function private.staff_force_poll(p uuid,accept boolean) returns void language plpgsql security definer set search_path='' as $$
declare poll public.polls;ev public.events;yeses integer;noes integer;wk date;
begin
 select * into strict poll from public.polls where id=p for update;
 if poll.status<>'open' then raise exception 'Karar zaten sonuçlandı.';end if;
 select * into strict ev from public.events where id=poll.event_id;
 if accept and (select treasury from public.buildings where id=poll.building_id)<ev.cost then raise exception 'Kasa yetersiz.';end if;
 select count(*) filter(where choice),count(*) filter(where not choice) into yeses,noes from public.votes where poll_id=p;
 if accept and ev.proposal_type='dues' then
 wk:=(date_trunc('week',clock_timestamp() at time zone 'Europe/Istanbul')+interval '7 days')::date;
 insert into public.dues_rates(building_id,effective_week,amount,poll_id) values(poll.building_id,wk,ev.dues_amount,p);
 elsif accept and ev.cost>0 then
 insert into public.treasury_transactions(building_id,poll_id,amount) values(poll.building_id,p,-ev.cost);
 update public.buildings set treasury=treasury-ev.cost where id=poll.building_id;
 end if;
 update public.polls set status=case when accept then 'accepted' else 'rejected' end,yes_count=yeses,no_count=noes,resolved_at=clock_timestamp() where id=p;
end $$;
revoke all on function private.staff_force_poll(uuid,boolean) from public,anon,authenticated;
create function private.staff_governance_action(target_building uuid,action text,args jsonb,expected_revision text,operation_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare perm text;s jsonb;e public.elections;eid uuid;winner uuid;tid uuid;ends timestamptz;n integer;start_term timestamptz;nom timestamptz;finish timestamptz;pid uuid;
begin
 perm:=case when action in ('election.start','election.restart','election.cancel','election.schedule','election.resolve','poll.cancel','poll.resolve') then 'governance.elections.manage' when action in ('election.force','poll.force_accept','poll.force_reject') then 'governance.elections.override' when action in ('manager.appoint','manager.dismiss','manager.term') then 'governance.manager.appoint' else null end;
 if perm is null then raise exception 'Geçersiz yönetim işlemi.';end if;
 perform private.staff_game_write_check(perm,target_building,reason);
 if not private.staff_claim_request(operation_id,'governance',jsonb_build_object('building',target_building,'action',action,'args',args,'revision',expected_revision,'reason',reason)) then return;end if;
 perform 1 from public.buildings where id=target_building for update;
 s:=private.staff_governance_snapshot(target_building);
 if expected_revision is null or md5(s::text)<>expected_revision then raise exception 'Önizleme güncel değil; yeniden yükleyip onaylayın.';end if;
 if action like 'election.%' then
 if action not in ('election.start','election.restart') then
 eid:=(args->>'election_id')::uuid;select * into e from public.elections where id=eid and building_id=target_building for update;
 if not found or e.status not in ('nominations','voting') then raise exception 'Açık seçim bulunamadı.';end if;
 end if;
 if action in ('election.start','election.restart') then
 if action='election.start' and exists(select 1 from public.elections where building_id=target_building and status in ('nominations','voting')) then raise exception 'Açık seçim zaten var.';end if;
 select count(*) into n from public.memberships where building_id=target_building;
 if n<2 then raise exception 'En az iki sakin gerekli.';end if;
 if action='election.restart' then update public.elections set status='failed',result_reason='Yönetim yeniden başlattı: '||reason,resolved_at=clock_timestamp(),retry_after=clock_timestamp()+interval '24 hours' where building_id=target_building and status in ('nominations','voting');end if;
 insert into public.elections(building_id,electorate_size,quorum) values(target_building,n,greatest(2,ceil(n/2.0)::integer)) returning id into eid;
 insert into public.election_electorate(election_id,user_id,building_id) select eid,user_id,target_building from public.memberships where building_id=target_building;
 elsif action='election.cancel' then update public.elections set status='failed',result_reason='Yönetim iptali: '||reason,resolved_at=clock_timestamp(),retry_after=clock_timestamp()+interval '24 hours' where id=eid;
 elsif action='election.schedule' then
 nom:=(args->>'nominations_end')::timestamptz;finish:=(args->>'voting_end')::timestamptz;
 if nom is null or finish is null or nom<=e.starts_at or finish<=nom or finish<=clock_timestamp() or finish>clock_timestamp()+interval '14 days' then raise exception 'Geçersiz takvim.';end if;
 if nom>clock_timestamp() and exists(select 1 from public.election_votes where election_id=eid) then raise exception 'Oy kullanıldıktan sonra adaylık yeniden açılamaz.';end if;
 update public.elections set nominations_end=nom,voting_end=finish,status=case when nom>clock_timestamp() then 'nominations' else 'voting' end where id=eid;
 elsif action='election.resolve' then
 if clock_timestamp()<=e.nominations_end then raise exception 'Önce adaylık tamamlanmalı.';end if;
 update public.elections set voting_end=clock_timestamp() where id=eid;perform private.election_tick(target_building);
 elsif action='election.force' then
 winner:=(args->>'user_id')::uuid;
 if not exists(select 1 from public.election_candidates c join public.memberships m on m.user_id=c.user_id where c.election_id=eid and c.user_id=winner and m.building_id=target_building and not private.player_blocked(winner,false)) then raise exception 'Geçerli aday seçin; aday olmayan sakin için doğrudan atama kullanın.';end if;
 select greatest(clock_timestamp(),coalesce(max(ends_at),clock_timestamp())) into start_term from public.manager_terms where building_id=target_building and not voided;
 insert into public.manager_terms(building_id,election_id,user_id,starts_at,ends_at) values(target_building,eid,winner,start_term,start_term+interval '14 days');
 update public.elections set status='elected',winner_id=winner,resolved_at=clock_timestamp(),result_reason='Zorunlu yönetim sonucu: '||reason where id=eid;
 end if;
 elsif action like 'manager.%' then
 if action='manager.term' then
 tid:=(args->>'term_id')::uuid;ends:=(args->>'ends_at')::timestamptz;
 if ends is null or ends<=clock_timestamp() or ends>clock_timestamp()+interval '90 days' then raise exception 'Geçersiz görev bitişi.';end if;
 update public.manager_terms set ends_at=ends where id=tid and building_id=target_building and not voided and ends_at>clock_timestamp();if not found then raise exception 'Etkin görev bulunamadı.';end if;
 else
 if action='manager.appoint' then winner:=(args->>'user_id')::uuid;if not exists(select 1 from public.memberships where building_id=target_building and user_id=winner and not private.player_blocked(winner,false)) then raise exception 'Geçerli sakin seçin.';end if;end if;
 update public.manager_terms set voided=true where building_id=target_building and starts_at>=clock_timestamp() and not voided;
 update public.manager_terms set ends_at=clock_timestamp() where building_id=target_building and not voided and starts_at<clock_timestamp() and ends_at>clock_timestamp();
 if action='manager.appoint' then start_term:=clock_timestamp();insert into public.manager_terms(building_id,election_id,user_id,starts_at,ends_at) values(target_building,null,winner,start_term,start_term+interval '14 days');end if;
 end if;
 elsif action like 'poll.%' then
 pid:=(args->>'poll_id')::uuid;if not exists(select 1 from public.polls where id=pid and building_id=target_building and status='open') then raise exception 'Açık karar bulunamadı.';end if;
 if action='poll.resolve' then
 if (select starts_at from public.polls where id=pid)>=clock_timestamp() then raise exception 'Karar henüz başlamadı.';end if;
 update public.polls set ends_at=clock_timestamp() where id=pid;perform private.resolve_poll(pid);
 else perform private.staff_force_poll(pid,action='poll.force_accept');end if;
 end if;
 insert into private.staff_audit(actor_id,action,target_type,target_id,old_value,new_value,reason) values(auth.uid(),action,'building',target_building::text,s,private.staff_governance_snapshot(target_building)||jsonb_build_object('request_id',operation_id),reason);
 insert into public.activity(building_id,kind,description) values(target_building,'staff.governance','Yönetim müdahalesi kaydedildi: '||action||'. Ayrıntılı gerekçe yetkili denetim kaydındadır.');
end $$;
create function public.staff_governance_action(target_building uuid,action text,args jsonb,expected_revision text,operation_id uuid,reason text) returns void language sql security invoker set search_path='' as $$select private.staff_governance_action(target_building,action,args,expected_revision,operation_id,reason)$$;
revoke all on function private.staff_governance_state(uuid),public.staff_governance_state(uuid),private.staff_governance_action(uuid,text,jsonb,text,uuid,text),public.staff_governance_action(uuid,text,jsonb,text,uuid,text) from public,anon,authenticated;
grant execute on function private.staff_governance_state(uuid),public.staff_governance_state(uuid),private.staff_governance_action(uuid,text,jsonb,text,uuid,text),public.staff_governance_action(uuid,text,jsonb,text,uuid,text) to authenticated;

create or replace function private.election_tick(b uuid) returns void language plpgsql security definer set search_path='' as $$
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
 select max(ends_at) into term_end from public.manager_terms where building_id=b and not voided;
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
 select max(ends_at) into term_end from public.manager_terms where building_id=b and not voided;
 select retry_after into retry from public.elections where building_id=b order by starts_at desc,id desc limit 1;
 if n>=2 and (term_end is null or term_end<=clock_timestamp()+interval '72 hours') and (retry is null or retry<=clock_timestamp()) then
 insert into public.elections(building_id,electorate_size,quorum) values(b,n,greatest(2,ceil(n/2.0)::integer)) returning id into eid;
 insert into public.election_electorate(election_id,user_id,building_id) select eid,user_id,b from public.memberships where building_id=b;
 insert into public.activity(building_id,kind,description) values(b,'election_started','Yönetici seçimi: 24 saat adaylık, ardından 48 saat oy verme.');
 end if;
 end if;
end $$;
