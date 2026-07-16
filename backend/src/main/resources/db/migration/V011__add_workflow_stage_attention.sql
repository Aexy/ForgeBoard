alter table workflow_stages add column attention_status varchar(20) not null default 'NONE';

alter table workflow_stages add constraint workflow_stages_attention_status_check
    check (attention_status in ('NONE', 'BLOCKED', 'AWAITING_REVIEW'));

update workflow_stages
set attention_status = case
    when lower(name) like '%block%' then 'BLOCKED'
    when lower(name) like '%review%' then 'AWAITING_REVIEW'
    else 'NONE'
end;
