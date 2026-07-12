create table clients (
    id uuid primary key,
    firm_id uuid not null references firms(id) on delete cascade,
    legal_name varchar(200) not null,
    display_name varchar(160) not null,
    primary_email varchar(320),
    status varchar(24) not null default 'ACTIVE',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint clients_status check (status in ('ACTIVE', 'ARCHIVED'))
);

create index clients_firm_display_name_idx on clients(firm_id, display_name);
create index clients_firm_status_idx on clients(firm_id, status);

