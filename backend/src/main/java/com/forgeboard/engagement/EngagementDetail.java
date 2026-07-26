package com.forgeboard.engagement;

/** Public engagement detail contract embedded in a linked work-item response. */
public record EngagementDetail(EngagementSummary engagement, EngagementLifecycleHistory history) {
}
