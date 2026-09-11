begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

select has_column('public', 'pm_projects', 'visibility', 'projects have a visibility classification');
select has_column('public', 'clients', 'parent_client_id', 'clients support parent/brand relationships');
select has_table('public', 'pm_client_aliases', 'client aliases are explicit records');
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pm_projects'
      and policyname = 'Visible projects select'
  ),
  'project reads use visibility-aware RLS'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pm_tasks'
      and policyname = 'Visible project tasks select'
  ),
  'task reads inherit project visibility'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_quick_request'
  ),
  'atomic Quick Request RPC exists'
);
select throws_ok(
  $$insert into public.pm_projects(title, type, work_type)
    values ('invalid request', 'quick_request', 'project')$$,
  '23514',
  null,
  'quick_request type cannot be stored as standard project work'
);
select throws_ok(
  $$insert into public.pm_projects(title, type, work_type)
    values ('invalid project', 'campaign', 'request')$$,
  '23514',
  null,
  'request work must use quick_request type'
);

insert into public.pm_users(id, auth_user_id, name, email, role, roles, is_active)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Private owner', 'visibility-owner@example.test', 'designer', array['designer'], true),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Collaborator', 'visibility-collab@example.test', 'developer', array['developer'], true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Other staff', 'visibility-other@example.test', 'designer', array['designer'], true);

insert into public.pm_projects(id, title, type, work_type, visibility, created_by)
values
  ('30000000-0000-0000-0000-000000000001', 'Private fixture', 'campaign', 'project', 'personal_private', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', 'Shared fixture', 'campaign', 'project', 'internal_shared', '10000000-0000-0000-0000-000000000001');
insert into public.pm_project_members(project_id, user_id, role)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'collaborator');

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::integer from public.pm_projects where id = '30000000-0000-0000-0000-000000000001'),
  1,
  'private owner can read their project'
);
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::integer from public.pm_projects where id = '30000000-0000-0000-0000-000000000001'),
  1,
  'invited collaborator can read private project'
);
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::integer from public.pm_projects where id = '30000000-0000-0000-0000-000000000001'),
  0,
  'uninvited staff cannot read private project'
);
select is(
  (select count(*)::integer from public.pm_projects where id = '30000000-0000-0000-0000-000000000002'),
  1,
  'approved staff can read shared work'
);

select * from finish();
rollback;
