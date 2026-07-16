package com.forgeboard.work.domain;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class WorkItemDocumentRequestId implements Serializable {
    private UUID workItemId;
    private UUID documentRequestId;

    protected WorkItemDocumentRequestId() {
    }

    public WorkItemDocumentRequestId(UUID workItemId, UUID documentRequestId) {
        this.workItemId = workItemId;
        this.documentRequestId = documentRequestId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof WorkItemDocumentRequestId that)) return false;
        return Objects.equals(workItemId, that.workItemId)
                && Objects.equals(documentRequestId, that.documentRequestId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(workItemId, documentRequestId);
    }
}
