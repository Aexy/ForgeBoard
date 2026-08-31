package com.forgeboard.engagement.application;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import com.forgeboard.engagement.domain.EngagementStatus;

/** Internal joined row; user display names and attention badges are added by the service. */
public record EngagementPortfolioRow(UUID id, UUID clientId, String clientName, UUID templateId, String templateName,
        int templateVersion, UUID preparerUserId, UUID reviewerUserId, LocalDate periodStart, LocalDate periodEnd,
        LocalDate dueDate, EngagementStatus status, String workflowSlug, String taskReference, boolean blockedStage,
        boolean awaitingReviewStage) {
    EngagementPortfolioView view(String preparerName, String reviewerName, Set<EngagementAttention> attention) {
        return new EngagementPortfolioView(id, clientId, clientName, templateId, templateName, templateVersion,
                preparerUserId, preparerName, reviewerUserId, reviewerName, periodStart, periodEnd, dueDate, status,
                workflowSlug, taskReference, attention);
    }
}
