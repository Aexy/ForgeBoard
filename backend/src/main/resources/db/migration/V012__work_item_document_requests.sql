alter table document_requests
    add constraint document_requests_firm_id_id_unique unique (firm_id, id);

create table work_item_document_requests (
    firm_id uuid not null,
    work_item_id uuid not null,
    document_request_id uuid not null unique,
    primary key (work_item_id, document_request_id),
    constraint work_item_document_requests_work_item_fk foreign key (firm_id, work_item_id)
        references work_items(firm_id, id) on delete cascade,
    constraint work_item_document_requests_document_request_fk foreign key (firm_id, document_request_id)
        references document_requests(firm_id, id) on delete cascade
);

create index work_item_document_requests_firm_item_idx
    on work_item_document_requests(firm_id, work_item_id);
