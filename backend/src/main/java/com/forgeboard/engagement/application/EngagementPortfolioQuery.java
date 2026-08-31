package com.forgeboard.engagement.application;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import com.forgeboard.engagement.domain.EngagementStatus;

/** Validated, firm-agnostic request values for the manager portfolio. */
public record EngagementPortfolioQuery(String query, UUID clientId, UUID templateId, UUID preparerUserId,
        UUID reviewerUserId, LocalDate periodStart, LocalDate periodEnd, Set<EngagementAttention> attention,
        Set<EngagementStatus> status, int page, int pageSize) {
    public EngagementPortfolioQuery {
        query = normalizeQuery(query);
        attention = attention == null ? Set.of() : Set.copyOf(attention);
        status = status == null ? Set.of() : Set.copyOf(status);
        if (periodStart != null && periodEnd != null && periodStart.isAfter(periodEnd))
            throw new IllegalArgumentException("periodStart must not be after periodEnd");
        if (page < 0) throw new IllegalArgumentException("page must be zero or greater");
        if (pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("pageSize must be between 1 and 100");
    }

    private static String normalizeQuery(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.strip();
        if (normalized.length() > 120) throw new IllegalArgumentException("query must be at most 120 characters");
        return normalized;
    }
}
