-- Definition only. Never call this function from a migration, Auth/join trigger or cron.
-- No backfill, NPC provisioning, reward, new API wrapper or legacy DML.
set local lock_timeout = '5s';

create function private.ensure_player_actor(target_profile uuid) returns uuid
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
   select actor,s,0,0 from unnest(array['plumbing','business','basic_teaching','advanced_teaching']::private.actor_skill_code[]) s;
 end if;
 perform private.a1_assert_actor(actor);
 return actor;
end $$;

revoke all on function private.ensure_player_actor(uuid) from public,anon,authenticated,service_role;
grant execute on function private.ensure_player_actor(uuid) to postgres;
comment on function private.ensure_player_actor(uuid) is 'Closed DB-owner-only resident initialization. Definition is not rollout/backfill approval. Same profile returns same actor and never changes skills or legacy game rows.';
