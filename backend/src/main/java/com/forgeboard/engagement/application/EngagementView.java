package com.forgeboard.engagement.application;

import java.time.LocalDate;
import java.util.UUID;
import com.forgeboard.engagement.domain.EngagementStatus;

public record EngagementView(UUID id, UUID templateId, UUID clientId, UUID workflowId, LocalDate periodStart,
        LocalDate periodEnd, LocalDate dueDate, EngagementStatus status, long version) {}
