package com.forgeboard.engagement.application;

import java.time.Instant;
import java.util.UUID;

import com.forgeboard.engagement.domain.EngagementReviewDecisionType;

public record ReviewDecisionView(UUID id, UUID actorId, EngagementReviewDecisionType decision, String note,
        Instant occurredAt) {}
