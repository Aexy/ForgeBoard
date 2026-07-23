alter table firms
    add column status varchar(16) not null default 'ACTIVE',
    add constraint firms_status_check check (status in ('ACTIVE', 'SUSPENDED'));

alter table firm_memberships
    add column status varchar(16) not null default 'ACTIVE',
    add constraint firm_memberships_status_check check (status in ('ACTIVE', 'SUSPENDED'));

create index firm_memberships_firm_user_status_idx on firm_memberships(firm_id, user_id, status);
