alter table clients add constraint clients_firm_id_id_unique unique (firm_id, id);

create table workflows (
    id uuid primary key,
    firm_id uuid not null references firms(id) on delete cascade,
    name varchar(160) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint workflows_firm_name_unique unique (firm_id, name),
    constraint workflows_firm_id_id_unique unique (firm_id, id)
);

create table workflow_stages (
    id uuid primary key,
    firm_id uuid not null,
    workflow_id uuid not null,
    name varchar(120) not null,
    position integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint workflow_stages_workflow_fk foreign key (firm_id, workflow_id)
        references workflows(firm_id, id) on delete cascade,
    constraint workflow_stages_position_unique unique (workflow_id, position),
    constraint workflow_stages_firm_id_id_unique unique (firm_id, id),
    constraint workflow_stages_position_positive check (position >= 0)
);

create table work_items (
    id uuid primary key,
    firm_id uuid not null,
    client_id uuid not null,
    workflow_id uuid not null,
    stage_id uuid not null,
    title varchar(200) not null,
    description text not null default '',
    due_date date,
    priority varchar(24) not null default 'NORMAL',
    rank numeric(30, 10) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint work_items_client_fk foreign key (firm_id, client_id)
        references clients(firm_id, id),
    constraint work_items_workflow_fk foreign key (firm_id, workflow_id)
        references workflows(firm_id, id) on delete cascade,
    constraint work_items_stage_fk foreign key (firm_id, stage_id)
        references workflow_stages(firm_id, id),
    constraint work_items_priority check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);

create index workflow_stages_workflow_position_idx on workflow_stages(workflow_id, position);
create index work_items_board_idx on work_items(firm_id, workflow_id, stage_id, rank);
create index work_items_client_idx on work_items(firm_id, client_id);

