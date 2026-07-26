alter table engagements drop constraint engagements_status_check;
update engagements set status = 'ACTIVE' where status = 'OPEN';
alter table engagements
    add column status_changed_at timestamptz,
    add column archived_from_status varchar(16),
    add constraint engagements_firm_id_id_unique unique (firm_id, id);
update engagements set status_changed_at = updated_at where status_changed_at is null;
alter table engagements
    alter column status_changed_at set not null,
    add constraint engagements_firm_id_engagement_work_item_unique unique (firm_id, id, work_item_id),
    add constraint engagements_status_check check (status in ('ACTIVE', 'BLOCKED', 'AWAITING_REVIEW', 'COMPLETE', 'CANCELLED', 'ARCHIVED')),
    add constraint engagements_archived_from_status_check check (
        (status = 'ARCHIVED' and archived_from_status is not null and archived_from_status in ('COMPLETE', 'CANCELLED'))
        or (status <> 'ARCHIVED' and archived_from_status is null));

create table engagement_review_decisions (
    id uuid primary key,
    firm_id uuid not null,
    engagement_id uuid not null,
    work_item_id uuid not null,
    actor_id uuid not null,
    decision varchar(16) not null,
    note text,
    occurred_at timestamptz not null,
    constraint engagement_review_decisions_engagement_fk foreign key (firm_id, engagement_id)
        references engagements(firm_id, id) on delete cascade,
    constraint engagement_review_decisions_work_item_fk foreign key (firm_id, work_item_id)
        references work_items(firm_id, id) on delete cascade,
    constraint engagement_review_decisions_linked_work_item_fk foreign key (firm_id, engagement_id, work_item_id)
        references engagements(firm_id, id, work_item_id) on delete cascade,
    constraint engagement_review_decisions_type_check check (decision in ('RETURNED', 'APPROVED')),
    constraint engagement_review_decisions_note_check check (
        (decision = 'RETURNED' and note is not null and length(btrim(note)) between 1 and 4000)
        or (decision = 'APPROVED' and note is null))
);
create index engagement_review_decisions_engagement_idx
    on engagement_review_decisions(firm_id, engagement_id, occurred_at desc, id desc);

alter table workflow_stages add column is_final boolean not null default false;
-- A legacy workflow may end at its review handoff stage. Preserve that handoff
-- and append the explicit completion stage required by the lifecycle model.
insert into workflow_stages (id, firm_id, workflow_id, name, position, attention_status, is_final, created_at, updated_at)
select md5(last_stage.workflow_id::text || ':forgeboard-complete')::uuid,
       last_stage.firm_id,
       last_stage.workflow_id,
       'Complete',
       last_stage.position + 1,
       'NONE',
       true,
       now(),
       now()
from (
    select distinct on (workflow_id) firm_id, workflow_id, position, attention_status
    from workflow_stages
    order by workflow_id, position desc
) last_stage
where last_stage.attention_status = 'AWAITING_REVIEW';

update workflow_stages stage set is_final = true
where stage.id in (
    select id from (
        select distinct on (workflow_id) id
        from workflow_stages
        where is_final = false
        order by workflow_id, position desc
    ) final_stages
)
and not exists (
    select 1
    from workflow_stages existing_final
    where existing_final.workflow_id = stage.workflow_id
      and existing_final.is_final = true
);
create unique index workflow_stages_one_final_per_workflow_idx
    on workflow_stages(workflow_id) where is_final;
alter table workflow_stages add constraint workflow_stages_final_not_review_check
    check (not is_final or attention_status <> 'AWAITING_REVIEW');
