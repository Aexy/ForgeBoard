package com.forgeboard.engagement;

import java.time.Instant;
import java.util.UUID;

/** Public, immutable review-decision representation. */
public record EngagementReviewDecision(UUID id, UUID actorId, String decision, String note, Instant occurredAt) {
}
