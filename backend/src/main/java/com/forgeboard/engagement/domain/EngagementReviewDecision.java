package com.forgeboard.engagement.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "engagement_review_decisions")
public class EngagementReviewDecision {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "engagement_id", nullable = false) private UUID engagementId;
    @Column(name = "work_item_id", nullable = false) private UUID workItemId;
    @Column(name = "actor_id", nullable = false) private UUID actorId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private EngagementReviewDecisionType decision;
    @Column private String note;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt;

    protected EngagementReviewDecision() {}
    public EngagementReviewDecision(UUID id, UUID firmId, UUID engagementId, UUID workItemId, UUID actorId,
            EngagementReviewDecisionType decision, String note, Instant occurredAt) {
        if (decision == EngagementReviewDecisionType.RETURNED && (note == null || note.strip().isEmpty()))
            throw new IllegalArgumentException("A returned review requires a note");
        if (decision == EngagementReviewDecisionType.APPROVED && note != null)
            throw new IllegalArgumentException("An approved review cannot have a note");
        this.id = id; this.firmId = firmId; this.engagementId = engagementId; this.workItemId = workItemId;
        this.actorId = actorId; this.decision = decision; this.note = note == null ? null : note.strip(); this.occurredAt = occurredAt;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID engagementId() { return engagementId; }
    public UUID workItemId() { return workItemId; }
    public UUID actorId() { return actorId; }
    public EngagementReviewDecisionType decision() { return decision; }
    public String note() { return note; }
    public Instant occurredAt() { return occurredAt; }
}
