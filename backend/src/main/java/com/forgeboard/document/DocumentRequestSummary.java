package com.forgeboard.document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Safe, tenant-scoped document-request data for use by other application modules. */
public record DocumentRequestSummary(UUID id, UUID clientId, String label, LocalDate dueDate,
        String status, Instant receivedAt) {
}
