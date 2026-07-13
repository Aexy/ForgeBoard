create table engagement_templates (
    id uuid primary key,
    firm_id uuid not null references firms(id) on delete cascade,
    workflow_id uuid not null,
    name varchar(160) not null,
    recurrence varchar(16) not null,
    default_work_item_title varchar(200) not null,
    due_day smallint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint engagement_templates_workflow_fk foreign key (firm_id, workflow_id)
        references workflows(firm_id, id),
    constraint engagement_templates_name_unique unique (firm_id, name),
    constraint engagement_templates_firm_id_id_unique unique (firm_id, id),
    constraint engagement_templates_recurrence_check check (recurrence in ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
    constraint engagement_templates_due_day_check check (due_day between 1 and 31)
);

create table engagements (
    id uuid primary key,
    firm_id uuid not null,
    template_id uuid not null,
    client_id uuid not null,
    workflow_id uuid not null,
    period_start date not null,
    period_end date not null,
    due_date date not null,
    status varchar(16) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint engagements_template_fk foreign key (firm_id, template_id)
        references engagement_templates(firm_id, id),
    constraint engagements_client_fk foreign key (firm_id, client_id)
        references clients(firm_id, id),
    constraint engagements_workflow_fk foreign key (firm_id, workflow_id)
        references workflows(firm_id, id),
    constraint engagements_period_check check (period_end >= period_start),
    constraint engagements_status_check check (status in ('OPEN', 'COMPLETE', 'CANCELLED')),
    constraint engagements_template_client_period_unique unique (template_id, client_id, period_start)
);

create index engagements_firm_due_date_idx on engagements(firm_id, due_date);
create index engagements_client_period_idx on engagements(firm_id, client_id, period_start desc);
