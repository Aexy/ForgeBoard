alter table engagements
    add column work_item_id uuid;

alter table work_items
    add constraint work_items_firm_id_id_unique unique (firm_id, id);

alter table engagements
    add constraint engagements_work_item_fk foreign key (firm_id, work_item_id)
        references work_items(firm_id, id);

alter table engagements
    add constraint engagements_work_item_unique unique (work_item_id);
