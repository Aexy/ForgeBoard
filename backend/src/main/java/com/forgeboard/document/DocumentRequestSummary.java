package com.forgeboard.document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.forgeboard.document.application.DocumentRequestFollowUpState;

/** Safe, tenant-scoped document-request data for use by other application modules. */
public record DocumentRequestSummary(UUID id, UUID clientId, String label, LocalDate dueDate,
        String status, Instant receivedAt, DocumentRequestFollowUpState followUpState, Instant remindedAt,
        Instant escalatedAt) {

    public DocumentRequestSummary(UUID id, UUID clientId, String label, LocalDate dueDate,
            String status, Instant receivedAt) {
        this(id, clientId, label, dueDate, status, receivedAt,
                "RECEIVED".equals(status) ? DocumentRequestFollowUpState.RECEIVED : DocumentRequestFollowUpState.OPEN,
                null, null);
    }
}
