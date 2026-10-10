-- READ ONLY. Run after reviewed migrations have been applied; this activates nothing.
begin transaction read only;
select not enabled as execution_disabled,limit_micros=0 as site_allowance_zero,held_micros=0 as no_held_site_allowance from public.agentgrid_execution_policy where singleton;
select not render_enabled as rendering_disabled,not publish_enabled as publishing_disabled,not oauth_enabled as oauth_disabled from public.agentgrid_media_policy where singleton;
select count(*) filter(where publishing_enabled) as enabled_connections,count(*) filter(where expires_at<=now()) as expired_connections from public.agentgrid_social_connections;
select count(*) filter(where limit_micros<>0) as members_with_allowance,count(*) filter(where held_micros<>0) as members_with_reserved_allowance from public.agentgrid_execution_budgets;
select to_regprocedure('public.agentgrid_server_media_workspace(uuid,text,jsonb)') is not null as workspace_ready,to_regprocedure('public.agentgrid_due_social_jobs()') is not null as scheduler_ready;
select count(*) filter(where state='dispatching') as in_flight_deliveries,count(*) filter(where state='uncertain') as deliveries_requiring_reconciliation from public.agentgrid_social_deliveries;
rollback;
