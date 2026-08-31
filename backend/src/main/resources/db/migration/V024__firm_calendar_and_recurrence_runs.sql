alter table firms
    add column timezone varchar(64) not null default 'Europe/Vienna';

create table firm_calendar_closures (
    id uuid primary key,
    firm_id uuid not null references firms(id) on delete cascade,
    closure_date date not null,
    label varchar(160) not null,
    created_by uuid not null references users(id),
    created_at timestamptz not null,
    constraint firm_calendar_closures_date_unique unique (firm_id, closure_date),
    constraint firm_calendar_closures_label_check check (length(btrim(label)) between 1 and 160)
);
create index firm_calendar_closures_firm_date_idx on firm_calendar_closures(firm_id, closure_date);

create table engagement_recurrence_runs (
    id uuid primary key,
    firm_id uuid not null references firms(id) on delete cascade,
    template_id uuid not null,
    period_start date not null,
    definition_version integer not null,
    run_date date not null,
    generated_count integer not null default 0,
    status varchar(16) not null,
    failure_detail varchar(500),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint engagement_recurrence_runs_template_fk foreign key (firm_id, template_id)
        references engagement_templates(firm_id, id) on delete cascade,
    constraint engagement_recurrence_runs_unique unique (firm_id, template_id, period_start),
    constraint engagement_recurrence_runs_status_check check (status in ('SUCCEEDED', 'FAILED', 'RESOLVED')),
    constraint engagement_recurrence_runs_generated_count_check check (generated_count >= 0)
);
create index engagement_recurrence_runs_firm_status_idx
    on engagement_recurrence_runs(firm_id, status, run_date desc);
