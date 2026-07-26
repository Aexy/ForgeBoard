package com.forgeboard.work;

import java.util.UUID;

/** Immutable, persistence-free context for a requested work-item move. */
public record WorkItemLifecycleMove(UUID firmId, UUID workItemId, UUID actorId,
        UUID requestedTargetStageId, UUID precedingSourceStageId, boolean targetFinalStage,
        boolean targetAwaitingReview, boolean sourceBlocked, boolean targetBlocked, String reviewNote) {
}
