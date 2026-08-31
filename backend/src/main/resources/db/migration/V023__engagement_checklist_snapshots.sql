create table engagement_template_version_checklist_items (
    id uuid primary key,
    firm_id uuid not null,
    template_id uuid not null,
    definition_version integer not null,
    label varchar(240) not null,
    is_required boolean not null,
    position integer not null,
    constraint engagement_template_version_checklist_version_fk foreign key (firm_id, template_id, definition_version)
        references engagement_template_versions(firm_id, template_id, definition_version) on delete cascade,
    constraint engagement_template_version_checklist_position_unique unique (firm_id, template_id, definition_version, position),
    constraint engagement_template_version_checklist_position_check check (position >= 0),
    constraint engagement_template_version_checklist_label_check check (length(btrim(label)) between 1 and 240)
);
create index engagement_template_version_checklist_version_idx
    on engagement_template_version_checklist_items(firm_id, template_id, definition_version, position);

create table engagement_checklist_items (
    id uuid primary key,
    firm_id uuid not null,
    engagement_id uuid not null,
    source_item_id uuid not null,
    label varchar(240) not null,
    is_required boolean not null,
    position integer not null,
    completed_by uuid,
    completed_at timestamptz,
    version bigint not null default 0,
    constraint engagement_checklist_engagement_fk foreign key (firm_id, engagement_id)
        references engagements(firm_id, id) on delete cascade,
    constraint engagement_checklist_position_unique unique (firm_id, engagement_id, position),
    constraint engagement_checklist_completion_check check (
        (completed_by is null and completed_at is null) or (completed_by is not null and completed_at is not null)),
    constraint engagement_checklist_position_check check (position >= 0),
    constraint engagement_checklist_label_check check (length(btrim(label)) between 1 and 240)
);
create index engagement_checklist_engagement_idx
    on engagement_checklist_items(firm_id, engagement_id, position);
