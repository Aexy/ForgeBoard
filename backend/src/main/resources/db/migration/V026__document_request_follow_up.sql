alter table document_requests
    add column reminded_at timestamptz,
    add column escalated_at timestamptz;
