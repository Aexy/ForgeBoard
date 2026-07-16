package com.forgeboard.work.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@Table(name = "work_item_document_requests")
@IdClass(WorkItemDocumentRequestId.class)
public class WorkItemDocumentRequest {
    @Id
    @Column(name = "work_item_id", nullable = false)
    private UUID workItemId;

    @Id
    @Column(name = "document_request_id", nullable = false)
    private UUID documentRequestId;

    @Column(name = "firm_id", nullable = false)
    private UUID firmId;

    protected WorkItemDocumentRequest() {
    }

    public WorkItemDocumentRequest(UUID firmId, UUID workItemId, UUID documentRequestId) {
        this.firmId = firmId;
        this.workItemId = workItemId;
        this.documentRequestId = documentRequestId;
    }

    public UUID firmId() {
        return firmId;
    }

    public UUID workItemId() {
        return workItemId;
    }

    public UUID documentRequestId() {
        return documentRequestId;
    }
}
