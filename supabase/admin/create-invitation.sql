-- Run ONLY as project owner in the NEW apartman-online project's SQL Editor.
-- Returns a new invitation ONE TIME. Do not commit or log that returned value.
-- 1 use, expires after 7 days. Run again to invite another resident.
with token as materialized (
 select replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','') as code
), created as (
 insert into private.invitations(building_id,code_hash,expires_at,uses_remaining)
 select b.id,sha256(convert_to(t.code,'UTF8')),now()+interval '7 days',1
 from public.buildings b cross join token t where b.slug='cinar'
 returning id
)
select token.code as invitation_code from token cross join created;
