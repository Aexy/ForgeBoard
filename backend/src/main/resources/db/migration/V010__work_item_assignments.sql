create table work_item_assignments (
    id uuid primary key,
    firm_id uuid not null,
    work_item_id uuid not null,
    user_id uuid not null,
    assignment_role varchar(16) not null,
    assigned_at timestamptz not null,
    assigned_by_user_id uuid not null references users(id),
    version bigint not null default 0,
    constraint work_item_assignments_role_check check (assignment_role in ('OWNER', 'REVIEWER')),
    constraint work_item_assignments_item_fk foreign key (firm_id, work_item_id)
        references work_items(firm_id, id) on delete cascade,
    constraint work_item_assignments_membership_fk foreign key (firm_id, user_id)
        references firm_memberships(firm_id, user_id) on delete restrict,
    constraint work_item_assignments_unique_role unique (work_item_id, assignment_role)
);
create index work_item_assignments_employee_dashboard_idx on work_item_assignments(firm_id, user_id, assignment_role, work_item_id);
