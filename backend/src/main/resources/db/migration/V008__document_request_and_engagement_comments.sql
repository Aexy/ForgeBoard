-- The external reference identifies a client document in an external system; ForgeBoard never stores the document itself.
comment on column document_requests.external_reference is
    'External portal URL or reference only. Source documents are not stored in ForgeBoard.';

-- Started engagements create one board item so operational work can be tracked from the engagement record.
comment on column engagements.work_item_id is
    'Board work item automatically created when this engagement starts.';
