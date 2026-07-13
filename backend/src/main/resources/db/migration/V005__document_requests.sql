create table document_requests (
    id uuid primary key,
    firm_id uuid not null,
    client_id uuid not null,
    label varchar(200) not null,
    external_reference varchar(1000),
    due_date date,
    status varchar(16) not null,
    received_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint document_requests_client_fk foreign key (firm_id, client_id) references clients(firm_id, id),
    constraint document_requests_status_check check (status in ('REQUESTED', 'RECEIVED'))
);
create index document_requests_firm_status_due_idx on document_requests(firm_id, status, due_date);
