package com.forgeboard.engagement.application;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import com.forgeboard.engagement.domain.EngagementStatus;

/** Stable portfolio row contract for the browser route. */
public record EngagementPortfolioView(UUID id, UUID clientId, String clientName, UUID templateId, String templateName,
        int templateVersion, UUID preparerUserId, String preparerName, UUID reviewerUserId, String reviewerName,
        LocalDate periodStart, LocalDate periodEnd, LocalDate dueDate, EngagementStatus status, String workflowSlug,
        String taskReference, Set<EngagementAttention> attention) {}
