-- Project owner only. No moderation privileges are granted to browser clients.
select r.id,r.created_at,r.status,r.reason,reporter.username as reporter,
 author.username as message_author,m.body,m.created_at as message_time
from public.message_reports r
join public.messages m on m.id=r.message_id
join public.profiles reporter on reporter.id=r.reporter_id
join public.profiles author on author.id=m.author_id
where r.status='pending' order by r.created_at;
-- After reviewing, execute a parameterized update with the chosen report id:
-- update public.message_reports set status='reviewed' where id='<reviewed-report-uuid>';
-- No automatic deletion or punishment. Keep original messages for review.
