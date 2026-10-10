-- This is synthetic acceptance data. It never represents a real review or host test.
begin;
create function pg_temp.agentgrid_assert(condition boolean, explanation text) returns void
language plpgsql as $$ begin
 if condition is distinct from true then raise exception 'Assertion failed: %', explanation; end if;
end $$;
create function pg_temp.agentgrid_expect_error(statement text, expected text) returns void
language plpgsql as $$ begin
 begin execute statement;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Unexpected SQLSTATE %, expected %', sqlstate, expected;
 end;
 raise exception 'Expected SQLSTATE % was not raised', expected;
end $$;
create function pg_temp.agentgrid_spec(slug text, version text default '1.0.0', licensed boolean default true)
returns jsonb language sql as $$
 select jsonb_set(jsonb_set(jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,
 '{identity,slug}',to_jsonb(slug)),'{version}',to_jsonb(version)),
 '{license}',case when licensed then '{"identifier":"MIT","statement":"Synthetic fixture license, never an actual released package.","permissions":{"use":true,"modify":true,"redistribute":true,"public_fork":true}}'::jsonb
 else current_setting('agentgrid.fixture_specification')::jsonb->'license' end);
$$;
create function pg_temp.agentgrid_evidence(version_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('contract_version','0.1','content_digest',content_digest,
 'editorial_passed',true,'host_checks_passed',true,'security_review_passed',true)
 from public.agentgrid_agent_versions where id=version_id;
$$;
create temp table agentgrid_fixture_state (key text primary key,resource_id uuid,version_id uuid);
grant select,insert,update on agentgrid_fixture_state to anon,authenticated,service_role;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,5) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000' || i)::uuid,'fixture_actor_'||i,'Fixture actor '||i,'fixture-v1','fixture-v1' from generate_series(1,5) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000' || i)::uuid,('10000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,5) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000003','moderator'),('10000000-0000-4000-8000-000000000004','administrator');
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000005';

set local role anon;
select pg_temp.agentgrid_assert((select count(*)=10 from public.agentgrid_categories),'broad category vocabulary is available');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_agents),'no unapproved resources are public');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_drafts','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_submissions','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_releases','42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-original',pg_temp.agentgrid_spec('fixture-original'))$s$,'42501');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-spoof',pg_temp.agentgrid_spec('fixture-spoof')||'{"owner_id":"another-user"}'::jsonb)$s$,'23514');
insert into agentgrid_fixture_state(key,resource_id)
values('original',public.agentgrid_create_agent('fixture-original',pg_temp.agentgrid_spec('fixture-original','1.0.0',false)));
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_drafts),'owner sees own private draft');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),7,pg_temp.agentgrid_spec('fixture-original'))$s$,'40001');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),1)$s$,'42501');
reset role;
update public.agentgrid_configuration set submission_enabled=true;
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),1)$s$,'23514');
select pg_temp.agentgrid_assert(public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),1,pg_temp.agentgrid_spec('fixture-original'),'{"overview":"Synthetic frozen guide, not an editorial approval."}')=2,'save advances revision atomically');
update agentgrid_fixture_state set version_id=public.agentgrid_submit_version(resource_id,2) where key='original';
select pg_temp.agentgrid_assert((select editorial->>'overview'='Synthetic frozen guide, not an editorial approval.' from public.agentgrid_agent_versions where id=(select version_id from agentgrid_fixture_state where key='original')),'submission freezes the exact author guide');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),2)$s$,'23505');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_submissions where state='pending'),'submission starts pending');
select pg_temp.agentgrid_expect_error('update public.agentgrid_agent_versions set version=''9.9.9''','42501');
select pg_temp.agentgrid_expect_error('update public.agentgrid_agents set owner_id=public.agentgrid_profile_id()','42501');
reset role;
select pg_temp.agentgrid_expect_error('update public.agentgrid_agent_versions set specification=specification','55000');
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_agent_versions','55000');
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_version_platforms','55000');

set local role anon;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_agents),'submitted is not published');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_agent_versions),'pending payload remains private');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_version_platforms),'private version mappings remain private');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_drafts),'other member cannot read a private draft');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_submissions),'other member cannot read its review state');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),2,pg_temp.agentgrid_spec('fixture-original'))$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-premature',pg_temp.agentgrid_spec('fixture-premature'),(select version_id from agentgrid_fixture_state where key='original'))$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_submission((select version_id from agentgrid_fixture_state where key='original'),'rejected','An unauthorized rejection attempt')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_agent_versions),'moderator sees the immutable submitted payload');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_drafts),'moderator does not read private working drafts');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_submission((select version_id from agentgrid_fixture_state where key='original'),'approved','Bypass the prepared publication gate')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),public.agentgrid_profile_id(),'bad','{}')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),public.agentgrid_profile_id(),'bad','{}')$s$,'42501');
reset role;

set local role service_role;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_releases','42501');
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_publish_version(uuid,uuid,text,jsonb)','execute'),'legacy publisher bypass revoked');
reset role;
-- Exercise the internal implementation as database owner; public publisher uses reviewed requests.
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000002','bad','{}')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000003','bad',pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')))$s$,'23514');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000003',pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original'))->>'content_digest',jsonb_set(pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')),'{host_checks_passed}','false'))$s$,'23514');
select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),
 '10000000-0000-4000-8000-000000000003',
 pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original'))->>'content_digest',
 pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')));
reset role;

-- Synthetic owned source; no model/provider call or real social account.
insert into public.agentgrid_execution_runs(id,owner_id,idempotency_key,version_id,provider_identity,instructions,input,digest,maximum_cost_micros,state)
select '41000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 '51000000-0000-4000-8000-000000000001',version_id,'synthetic','Synthetic','Synthetic',repeat('a',64),1,'succeeded'
from agentgrid_fixture_state where key='original';
create function pg_temp.media(op text,data jsonb default '{}') returns jsonb language sql as $$
 select public.agentgrid_server_media('00000000-0000-4000-8000-000000000001',op,data);
$$;
create temp table reel_fixture(data jsonb);
insert into reel_fixture values(jsonb_build_object('id','42000000-0000-4000-8000-000000000001',
 'ownerId','10000000-0000-4000-8000-000000000001','idempotencyKey','52000000-0000-4000-8000-000000000001',
 'plan',jsonb_build_object('sourceRunId','41000000-0000-4000-8000-000000000001','title','Synthetic fixture',
 'narration','Synthetic narration','scenes',jsonb_build_array(jsonb_build_object('seconds',5,'visual','Synthetic visual','onScreenText','Fixture')),'format','portrait-720p'),
 'providerIdentity','synthetic-only','maximumCostMicros',1000,'digest',repeat('b',64),'state','queued','taskId',null,'asset',null));
select pg_temp.agentgrid_expect_error($s$select pg_temp.media('prepare',(select data from reel_fixture))$s$,'42501');
update public.agentgrid_execution_policy set enabled=true,limit_micros=20000;
-- Global execution alone cannot enable rendering.
select pg_temp.agentgrid_expect_error($s$select pg_temp.media('prepare',(select data from reel_fixture))$s$,'42501');
update public.agentgrid_media_policy set render_enabled=true;
select pg_temp.media('prepare',(select data from reel_fixture));
update public.agentgrid_execution_budgets set limit_micros=10000;
select pg_temp.agentgrid_assert(pg_temp.media('claim',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','digest',repeat('b',64)))='false','unapproved reel cannot spend');
select pg_temp.media('approve',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','digest',repeat('b',64)));
select pg_temp.agentgrid_assert(pg_temp.media('claim',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','digest',repeat('b',64)))='true','approved reel reserves shared spend');
select pg_temp.agentgrid_assert(pg_temp.media('claim',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','digest',repeat('b',64)))='false','duplicate submit claim denied');
select pg_temp.agentgrid_assert((select held_micros=1000 from public.agentgrid_execution_policy),'reel reserves site allowance');
select pg_temp.agentgrid_assert(public.agentgrid_server_media('00000000-0000-4000-8000-000000000002','read','{"id":"42000000-0000-4000-8000-000000000001"}')='null','other owner cannot read reel');
select pg_temp.media('task','{"id":"42000000-0000-4000-8000-000000000001","taskId":"synthetic-task"}');
select pg_temp.agentgrid_expect_error($s$select pg_temp.media('task','{"id":"42000000-0000-4000-8000-000000000001","taskId":"second-task"}')$s$,'23514');
create temp table media_fixture(data jsonb);
insert into media_fixture values(jsonb_build_object('id','43000000-0000-4000-8000-000000000001',
 'ownerId','10000000-0000-4000-8000-000000000001','runId','42000000-0000-4000-8000-000000000001',
 'key','owners/10000000-0000-4000-8000-000000000001/reels/42000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001.mp4',
 'sha256',repeat('c',64),'bytes',12,'contentType','video/mp4','width',720,'height',1280,'seconds',5));
select pg_temp.agentgrid_expect_error($s$select pg_temp.media('finish',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','asset',(select data||'{"ownerId":"10000000-0000-4000-8000-000000000002"}'::jsonb from media_fixture),'billedMicros',300))$s$,'23514');
select pg_temp.agentgrid_expect_error($s$select pg_temp.media('finish',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','asset',(select data||'{"width":1280}'::jsonb from media_fixture),'billedMicros',300))$s$,'23514');
select pg_temp.media('finish',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','asset',(select data from media_fixture),'billedMicros',300));
select pg_temp.media('finish',jsonb_build_object('id','42000000-0000-4000-8000-000000000001','asset',(select data from media_fixture),'billedMicros',300));
select pg_temp.agentgrid_assert((select held_micros=0 and spent_micros=300 from public.agentgrid_execution_policy),'settlement is once with unused allowance released');
-- Two consenting synthetic destinations, distinct from catalogue publication.
insert into public.agentgrid_social_connections(id,owner_id,platform,provider_account_id,publishing_enabled,expires_at,sealed_tokens) values
('44000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','instagram','synthetic-instagram',true,now()+interval '2 days','v1.000000000000000000000000.00'),
('44000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','linkedin','synthetic-linkedin',true,now()+interval '2 days','v1.000000000000000000000000.00');
create temp table social_fixture(data jsonb);
insert into social_fixture values(jsonb_build_object('id','45000000-0000-4000-8000-000000000001','digest',repeat('d',64),
 'preview',jsonb_build_object('runId','42000000-0000-4000-8000-000000000001','revision',1,'mediaId','43000000-0000-4000-8000-000000000001','mediaSha256',repeat('c',64),
 'scheduledAt',now(),'destinations',jsonb_build_array(jsonb_build_object('platform','instagram','connectionId','44000000-0000-4000-8000-000000000001','caption','Synthetic IG'),
 jsonb_build_object('platform','linkedin','connectionId','44000000-0000-4000-8000-000000000002','caption','Synthetic LinkedIn')))));
select pg_temp.agentgrid_expect_error($s$select pg_temp.media('publication',(select data from social_fixture))$s$,'42501');
update public.agentgrid_media_policy set publish_enabled=true;
select pg_temp.media('publication',(select data from social_fixture));
select pg_temp.media('publication',(select data from social_fixture));
select pg_temp.agentgrid_assert((select count(*)=2 from public.agentgrid_social_deliveries),'idempotent preview creates one delivery per destination');
select pg_temp.agentgrid_assert(pg_temp.media('claim-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries limit 1),'digest',repeat('d',64)))='false','unapproved post cannot dispatch');
select pg_temp.media('approve-publication',jsonb_build_object('id','45000000-0000-4000-8000-000000000001','digest',repeat('d',64)));
select pg_temp.agentgrid_assert(pg_temp.media('claim-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'digest',repeat('d',64)))='true','approved due post claims once');
select pg_temp.agentgrid_assert(pg_temp.media('claim-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'digest',repeat('d',64)))='false','duplicate delivery claim denied');
select pg_temp.media('submitted-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'postId','synthetic-confirmed-post'));
select pg_temp.media('finish-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'postId',null));
select pg_temp.agentgrid_assert((select state='uncertain' and provider_post_id='synthetic-confirmed-post' from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'uncertain readback preserves candidate identity');
select pg_temp.agentgrid_assert(pg_temp.media('claim-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'digest',repeat('d',64)))='false','uncertain post cannot repost');
select pg_temp.media('finish-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'postId','synthetic-confirmed-post'));
select pg_temp.media('disconnect','{"id":"44000000-0000-4000-8000-000000000002"}');
select pg_temp.agentgrid_assert((select state='published' from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'successful destination remains successful');
select pg_temp.agentgrid_assert((select state='cancelled' from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000002'),'disconnect cancels pending destination');
select pg_temp.agentgrid_assert(pg_temp.media('claim-delivery',jsonb_build_object('id',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000002'),'digest',repeat('d',64)))='false','revoked destination cannot dispatch');
-- Lost submit outcome remains held and cannot create a replacement task.
select pg_temp.media('prepare',(select data||'{"id":"42000000-0000-4000-8000-000000000002","idempotencyKey":"52000000-0000-4000-8000-000000000002"}'::jsonb from reel_fixture));
select pg_temp.media('approve',jsonb_build_object('id','42000000-0000-4000-8000-000000000002','digest',repeat('b',64)));
select pg_temp.media('claim',jsonb_build_object('id','42000000-0000-4000-8000-000000000002','digest',repeat('b',64)));
update public.agentgrid_reels set started_at=now()-interval '3 minutes' where id='42000000-0000-4000-8000-000000000002';
select pg_temp.media('read','{"id":"42000000-0000-4000-8000-000000000002"}');
select pg_temp.agentgrid_assert((select state='uncertain' and reserved from public.agentgrid_reels where id='42000000-0000-4000-8000-000000000002'),'lost submit is uncertain with held budget');

-- Provider control plane remains private, replay-safe and independently disabled.
create function pg_temp.integration(op text,data jsonb default '{}') returns jsonb language sql as $$
 select public.agentgrid_server_integrations('00000000-0000-4000-8000-000000000001',op,data);
$$;
create temp table oauth_fixture(data jsonb);
insert into oauth_fixture values(jsonb_build_object('digest',repeat('e',64),'ownerId','10000000-0000-4000-8000-000000000001',
 'sessionDigest',repeat('f',64),'platform','instagram','redirectUri','https://agentgrid.me/api/social/instagram/callback/','expiresAt',now()+interval '5 minutes'));
select pg_temp.agentgrid_expect_error($s$select pg_temp.integration('create-flow',(select data from oauth_fixture))$s$,'42501');
update public.agentgrid_media_policy set oauth_enabled=true;
select pg_temp.integration('create-flow',(select data from oauth_fixture));
select pg_temp.agentgrid_assert(pg_temp.integration('consume-flow',(select data||jsonb_build_object('sessionDigest',repeat('a',64)) from oauth_fixture))='null','wrong session cannot consume flow');
select pg_temp.agentgrid_assert(public.agentgrid_server_integrations('00000000-0000-4000-8000-000000000002','consume-flow',(select data from oauth_fixture))='null','wrong owner cannot consume flow');
select pg_temp.agentgrid_assert(pg_temp.integration('consume-flow',(select data from oauth_fixture))->>'platform'='instagram','correct session consumes flow');
select pg_temp.agentgrid_assert(pg_temp.integration('consume-flow',(select data from oauth_fixture))='null','flow cannot replay');
select pg_temp.integration('connect',jsonb_build_object('id','44000000-0000-4000-8000-000000000003','ownerId','10000000-0000-4000-8000-000000000001','platform','instagram','accountId','123',
 'expiresAt',now()+interval '1 day','sealedTokens','v1.000000000000000000000000.00','scopes','["instagram_basic"]'::jsonb));
select pg_temp.agentgrid_assert((select not publishing_enabled from public.agentgrid_social_connections where id='44000000-0000-4000-8000-000000000003'),'new OAuth connection cannot publish');
-- Reset only this synthetic delivery to exercise receipt stages without external requests.
update public.agentgrid_social_deliveries set state='dispatching' where connection_id='44000000-0000-4000-8000-000000000001';
create temp table receipt_fixture(data jsonb);
insert into receipt_fixture values(jsonb_build_object('deliveryId',(select id from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),
 'connectionId','44000000-0000-4000-8000-000000000001','mediaId','43000000-0000-4000-8000-000000000001','sha256',repeat('c',64),'caption','Synthetic IG'));
select pg_temp.agentgrid_expect_error($s$select pg_temp.integration('begin',(select data||'{"caption":"Altered"}'::jsonb from receipt_fixture))$s$,'23514');
select pg_temp.agentgrid_assert(pg_temp.integration('begin',(select data from receipt_fixture))='true','one outbound attempt can begin');
select pg_temp.agentgrid_assert(pg_temp.integration('begin',(select data from receipt_fixture))='false','duplicate outbound attempt refused');
select pg_temp.agentgrid_expect_error($s$select pg_temp.integration('save',(select data||'{"stage":"published","providerId":"999"}'::jsonb from receipt_fixture))$s$,'23514');
select pg_temp.integration('save',(select data||'{"stage":"upload","providerId":"888"}'::jsonb from receipt_fixture));
select pg_temp.agentgrid_expect_error($s$select pg_temp.integration('save',(select data||'{"stage":"publishing","providerId":"777"}'::jsonb from receipt_fixture))$s$,'23514');
update public.agentgrid_social_deliveries set state='uncertain',provider_post_id=null where connection_id='44000000-0000-4000-8000-000000000001';
select pg_temp.agentgrid_assert(pg_temp.integration('pending',(select data||jsonb_build_object('checksum',repeat('c',64)) from receipt_fixture))->>'mediaId'='888','saved uploaded container is resumable');
select pg_temp.integration('save',(select data||'{"stage":"publishing","providerId":"888"}'::jsonb from receipt_fixture));
select pg_temp.agentgrid_assert((select state='dispatching' from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'continuation atomically restores claimed dispatch');
select pg_temp.agentgrid_expect_error($s$select pg_temp.integration('save',(select data||'{"stage":"publishing","providerId":"888"}'::jsonb from receipt_fixture))$s$,'23514');

select pg_temp.integration('save',(select data||'{"stage":"published","providerId":"999"}'::jsonb from receipt_fixture));
select pg_temp.agentgrid_assert(pg_temp.integration('published',(select data||jsonb_build_object('postId','999','checksum',repeat('c',64)) from receipt_fixture))->>'mediaId'='888','readback uses original uploaded media receipt');
update public.agentgrid_social_deliveries set state='uncertain',provider_post_id=null where connection_id='44000000-0000-4000-8000-000000000001';
select pg_temp.agentgrid_assert(pg_temp.integration('recover',(select data from receipt_fixture))='"999"','durable receipt recovers a lost return without posting');
select pg_temp.agentgrid_assert((select provider_post_id='999' and state='uncertain' from public.agentgrid_social_deliveries where connection_id='44000000-0000-4000-8000-000000000001'),'recovered candidate still needs provider readback');
set local role service_role;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_social_oauth_states','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_social_receipts','42501');
reset role;
set local role authenticated;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_social_connections','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_media_assets','42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_server_media('00000000-0000-4000-8000-000000000001','read','{}')$s$,'42501');
reset role;
delete from public.agentgrid_media_policy;
select pg_temp.agentgrid_expect_error($s$select pg_temp.media('read','{"id":"42000000-0000-4000-8000-000000000001"}')$s$,'42501');
rollback;
