package com.forgeboard.engagement;

import java.util.List;

/** Immutable review history included with a linked engagement. */
public record EngagementLifecycleHistory(List<EngagementReviewDecision> reviewDecisions) {
}
