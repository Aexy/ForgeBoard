package com.forgeboard.engagement.application;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;

import com.forgeboard.engagement.domain.Engagement;
import com.forgeboard.engagement.domain.EngagementReviewDecision;
import com.forgeboard.engagement.domain.EngagementReviewDecisionType;
import com.forgeboard.engagement.domain.EngagementStatus;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementReviewDecisionRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.work.WorkItemAssignmentDirectory;
import com.forgeboard.work.WorkItemAssignmentRoles;
import com.forgeboard.work.WorkItemLifecycleConflictException;
import com.forgeboard.work.WorkItemLifecycleMove;
import com.forgeboard.work.WorkItemLifecyclePolicy;

@Service
public class EngagementLifecycleService implements WorkItemLifecyclePolicy {
    private final EngagementRepository engagements;
    private final EngagementReviewDecisionRepository decisions;
    private final WorkItemAssignmentDirectory assignments;
    private final ActivityRecorder activity;
    private final Clock clock;

    public EngagementLifecycleService(EngagementRepository engagements, EngagementReviewDecisionRepository decisions,
            WorkItemAssignmentDirectory assignments, ActivityRecorder activity, Clock clock) {
        this.engagements = engagements; this.decisions = decisions; this.assignments = assignments;
        this.activity = activity; this.clock = clock;
    }

    @Override
    public UUID onWorkItemMove(WorkItemLifecycleMove move) {
        Engagement engagement = engagements.findByWorkItemIdAndFirmId(move.workItemId(), move.firmId()).orElse(null);
        if (engagement == null) return move.requestedTargetStageId();
        if (engagement.status() == EngagementStatus.COMPLETE || engagement.status() == EngagementStatus.CANCELLED
                || engagement.status() == EngagementStatus.ARCHIVED)
            throw conflict("Terminal or archived engagements must be reopened before moving their work item");

        WorkItemAssignmentRoles roles = assignments.roles(move.firmId(), move.workItemId());
        var now = clock.instant();

        if (engagement.status() == EngagementStatus.AWAITING_REVIEW) {
            requireReviewer(roles, move.actorId());
            if (move.targetFinalStage()) {
                engagement.approve(now);
                decisions.save(new EngagementReviewDecision(UUID.randomUUID(), move.firmId(), engagement.id(), move.workItemId(),
                        move.actorId(), EngagementReviewDecisionType.APPROVED, null, now));
                activity.recordRestUserAction(move.firmId(), move.actorId(), "engagement.completed", "engagement",
                        engagement.id(), Map.of("workItemId", move.workItemId().toString()));
                return move.requestedTargetStageId();
            }
            if (move.precedingSourceStageId() == null || !move.requestedTargetStageId().equals(move.precedingSourceStageId()))
                throw conflict("A reviewer may return an engagement only to the immediately preceding stage");
            String note = normalizedReturnNote(move.reviewNote());
            engagement.returnForPreparation(now);
            decisions.save(new EngagementReviewDecision(UUID.randomUUID(), move.firmId(), engagement.id(), move.workItemId(),
                    move.actorId(), EngagementReviewDecisionType.RETURNED, note, now));
            activity.recordRestUserAction(move.firmId(), move.actorId(), "engagement.review-returned", "engagement",
                    engagement.id(), Map.of("workItemId", move.workItemId().toString()));
            return move.precedingSourceStageId();
        }

        if (move.targetFinalStage())
            throw conflict("Only an assigned reviewer can move an awaiting-review engagement to its final stage");
        if (move.targetAwaitingReview()) {
            requireOwnerAndReviewer(roles, move.actorId());
            if (engagement.status() != EngagementStatus.ACTIVE) throw conflict("Only active engagements can be submitted for review");
            engagement.submitForReview(now);
            activity.recordRestUserAction(move.firmId(), move.actorId(), "engagement.review-submitted", "engagement",
                    engagement.id(), Map.of("workItemId", move.workItemId().toString()));
        } else if (move.targetBlocked()) {
            if (engagement.status() != EngagementStatus.ACTIVE) throw conflict("Only active engagements can be blocked");
            engagement.markBlocked(now);
            activity.recordRestUserAction(move.firmId(), move.actorId(), "engagement.blocked", "engagement",
                    engagement.id(), Map.of("workItemId", move.workItemId().toString()));
        } else if (move.sourceBlocked()) {
            if (engagement.status() != EngagementStatus.BLOCKED) throw conflict("Only blocked engagements can resume");
            engagement.resumeActive(now);
            activity.recordRestUserAction(move.firmId(), move.actorId(), "engagement.resumed", "engagement",
                    engagement.id(), Map.of("workItemId", move.workItemId().toString()));
        }
        return move.requestedTargetStageId();
    }
    private void requireOwnerAndReviewer(WorkItemAssignmentRoles roles, UUID actorId) {
        if (roles.ownerUserId() == null || roles.reviewerUserId() == null)
            throw conflict("Submitting an engagement for review requires an assigned owner and reviewer");
        if (!actorId.equals(roles.ownerUserId()))
            throw new AccessDeniedException("Only the assigned owner may submit an engagement for review");
    }
    private void requireReviewer(WorkItemAssignmentRoles roles, UUID actorId) {
        if (roles.reviewerUserId() == null)
            throw conflict("An assigned reviewer is required to decide an engagement review");
        if (!actorId.equals(roles.reviewerUserId()))
            throw new AccessDeniedException("Only the assigned reviewer may decide an engagement review");
    }
    private String normalizedReturnNote(String note) {
        if (note == null || note.strip().isEmpty()) throw conflict("Returning an engagement for preparation requires a note");
        return note.strip();
    }
    private WorkItemLifecycleConflictException conflict(String message) { return new WorkItemLifecycleConflictException(message); }
}
