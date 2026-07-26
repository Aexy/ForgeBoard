package com.forgeboard.work;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Work-owned view of a linked engagement, deliberately free of engagement internals. */
public record WorkItemEngagementDetail(Engagement engagement, History history) {
    public record Engagement(UUID id, UUID templateId, UUID clientId, UUID workflowId, UUID workItemId,
            LocalDate periodStart, LocalDate periodEnd, LocalDate dueDate, String status, Instant statusChangedAt,
            long version) {}
    public record History(List<Decision> reviewDecisions) {}
    public record Decision(UUID id, UUID actorId, String decision, String note, Instant occurredAt) {}
}
