package com.forgeboard.engagement;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Persistence-free engagement summary for cross-module detail reads. */
public record EngagementSummary(UUID id, UUID templateId, UUID clientId, UUID workflowId, UUID workItemId,
        LocalDate periodStart, LocalDate periodEnd, LocalDate dueDate, String status, Instant statusChangedAt,
        long version) {
}
