alter table workflows add column workflow_slug varchar(180);

with recursive normalized as (
    select id, firm_id,
        coalesce(nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'workflow') as base_slug,
        row_number() over (order by firm_id asc, created_at asc, id asc) as position
    from workflows
), allocated as (
    select id, firm_id, base_slug, position, base_slug as workflow_slug,
        jsonb_build_object(firm_id::text, jsonb_build_array(base_slug)) as allocated_slugs
    from normalized
    where position = 1
    union all
    select next.id, next.firm_id, next.base_slug, next.position,
        case when allocated.allocated_slugs -> (next.firm_id::text) ? next.base_slug then
            next.base_slug || '-' || (
                select min(candidate.suffix)
                from generate_series(2, 1000000) as candidate(suffix)
                where not (allocated.allocated_slugs -> (next.firm_id::text) ? (next.base_slug || '-' || candidate.suffix))
            )
        else next.base_slug end,
        jsonb_set(
            allocated.allocated_slugs,
            array[next.firm_id::text],
            coalesce(allocated.allocated_slugs -> (next.firm_id::text), '[]'::jsonb) || to_jsonb(
                case when allocated.allocated_slugs -> (next.firm_id::text) ? next.base_slug then
                    next.base_slug || '-' || (
                        select min(candidate.suffix)
                        from generate_series(2, 1000000) as candidate(suffix)
                        where not (allocated.allocated_slugs -> (next.firm_id::text) ? (next.base_slug || '-' || candidate.suffix))
                    )
                else next.base_slug end
            )
        )
    from allocated
    join normalized next on next.position = allocated.position + 1
)
update workflows
set workflow_slug = allocated.workflow_slug
from allocated
where workflows.id = allocated.id;

alter table workflows alter column workflow_slug set not null;
alter table workflows add constraint workflows_firm_workflow_slug_unique unique (firm_id, workflow_slug);

create sequence work_item_task_reference_sequence start with 1 increment by 1;
alter table work_items add column task_reference varchar(32);

with numbered as (
    select id, row_number() over (order by created_at asc, id asc) as reference_number
    from work_items
)
update work_items
set task_reference = 'FB-' || numbered.reference_number
from numbered
where work_items.id = numbered.id;

select setval(
    'work_item_task_reference_sequence',
    coalesce((select max(substring(task_reference from 4)::bigint) from work_items), 1),
    exists(select 1 from work_items)
);

alter table work_items alter column task_reference set not null;
alter table work_items add constraint work_items_firm_task_reference_unique unique (firm_id, task_reference);
