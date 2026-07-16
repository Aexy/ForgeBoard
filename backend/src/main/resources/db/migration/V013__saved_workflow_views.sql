create table saved_workflow_views (
    id uuid primary key,
    firm_id uuid not null,
    name varchar(80) not null,
    client_id uuid,
    owner_user_id uuid,
    due_state varchar(24),
    priority varchar(24),
    unassigned boolean,
    created_by_user_id uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint saved_workflow_views_firm_name_unique unique (firm_id, name),
    constraint saved_workflow_views_client_fk foreign key (firm_id, client_id)
        references clients(firm_id, id) on delete restrict,
    constraint saved_workflow_views_owner_fk foreign key (firm_id, owner_user_id)
        references firm_memberships(firm_id, user_id) on delete restrict,
    constraint saved_workflow_views_creator_fk foreign key (firm_id, created_by_user_id)
        references firm_memberships(firm_id, user_id) on delete restrict,
    constraint saved_workflow_views_due_state_check check (due_state is null or due_state in
        ('OVERDUE', 'DUE_TODAY', 'DUE_SOON', 'NO_DUE_DATE')),
    constraint saved_workflow_views_priority_check check (priority is null or priority in
        ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);

create index saved_workflow_views_firm_created_at_idx
    on saved_workflow_views(firm_id, created_at, id);
