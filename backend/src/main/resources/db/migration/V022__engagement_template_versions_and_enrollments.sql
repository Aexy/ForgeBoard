alter table engagement_templates
    add column current_version integer not null default 1;

alter table engagements
    add column template_version integer not null default 1;

create table engagement_template_versions (
    id uuid primary key,
    firm_id uuid not null,
    template_id uuid not null,
    definition_version integer not null,
    workflow_id uuid not null,
    name varchar(160) not null,
    recurrence varchar(16) not null,
    default_work_item_title varchar(200) not null,
    due_day integer not null,
    created_by uuid not null,
    created_at timestamptz not null,
    constraint engagement_template_versions_template_fk foreign key (firm_id, template_id)
        references engagement_templates(firm_id, id) on delete cascade,
    constraint engagement_template_versions_workflow_fk foreign key (firm_id, workflow_id)
        references workflows(firm_id, id),
    constraint engagement_template_versions_definition_unique unique (firm_id, template_id, definition_version),
    constraint engagement_template_versions_definition_check check (definition_version >= 1),
    constraint engagement_template_versions_recurrence_check check (recurrence in ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
    constraint engagement_template_versions_due_day_check check (due_day between 1 and 31)
);

insert into engagement_template_versions (
    id, firm_id, template_id, definition_version, workflow_id, name, recurrence,
    default_work_item_title, due_day, created_by, created_at
)
select md5(id::text || ':forgeboard-template-version:1')::uuid, firm_id, id, 1, workflow_id, name, recurrence,
       default_work_item_title, due_day,
       coalesce((select user_id from firm_memberships membership
                 where membership.firm_id = engagement_templates.firm_id
                 order by membership.created_at asc, membership.id asc limit 1),
                '00000000-0000-0000-0000-000000000000'::uuid),
       created_at
from engagement_templates;

alter table engagements
    add constraint engagements_template_definition_fk foreign key (firm_id, template_id, template_version)
        references engagement_template_versions(firm_id, template_id, definition_version);

create table engagement_template_enrollments (
    id uuid primary key,
    firm_id uuid not null,
    template_id uuid not null,
    client_id uuid not null,
    created_by uuid not null,
    created_at timestamptz not null,
    constraint engagement_template_enrollments_template_fk foreign key (firm_id, template_id)
        references engagement_templates(firm_id, id) on delete cascade,
    constraint engagement_template_enrollments_client_fk foreign key (firm_id, client_id)
        references clients(firm_id, id) on delete cascade,
    constraint engagement_template_enrollments_unique unique (firm_id, template_id, client_id)
);

create index engagement_template_enrollments_template_idx
    on engagement_template_enrollments(firm_id, template_id);
