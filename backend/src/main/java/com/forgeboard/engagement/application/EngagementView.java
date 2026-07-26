package com.forgeboard.engagement.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.forgeboard.engagement.domain.EngagementStatus;

public record EngagementView(UUID id, UUID templateId, UUID clientId, UUID workflowId, UUID workItemId, LocalDate periodStart,
        LocalDate periodEnd, LocalDate dueDate, EngagementStatus status, Instant statusChangedAt, long version) {}
