package com.forgeboard.engagement.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "engagements")
public class Engagement {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "template_id", nullable = false) private UUID templateId;
    @Column(name = "client_id", nullable = false) private UUID clientId;
    @Column(name = "workflow_id", nullable = false) private UUID workflowId;
    @Column(name = "work_item_id") private UUID workItemId;
    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "period_end", nullable = false) private LocalDate periodEnd;
    @Column(name = "due_date", nullable = false) private LocalDate dueDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private EngagementStatus status;
    @Column(name = "status_changed_at", nullable = false) private Instant statusChangedAt;
    @Enumerated(EnumType.STRING) @Column(name = "archived_from_status", length = 16) private EngagementStatus archivedFromStatus;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version private long version;

    protected Engagement() {}
    public Engagement(UUID id, UUID firmId, UUID templateId, UUID clientId, UUID workflowId, UUID workItemId,
            LocalDate periodStart, LocalDate periodEnd, LocalDate dueDate, Instant now) {
        this.id = id; this.firmId = firmId; this.templateId = templateId; this.clientId = clientId;
        this.workflowId = workflowId; this.workItemId = workItemId; this.periodStart = periodStart; this.periodEnd = periodEnd;
        this.dueDate = dueDate; this.status = EngagementStatus.ACTIVE; this.statusChangedAt = now;
        this.createdAt = now; this.updatedAt = now;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID templateId() { return templateId; }
    public UUID clientId() { return clientId; }
    public UUID workflowId() { return workflowId; }
    public UUID workItemId() { return workItemId; }
    public LocalDate periodStart() { return periodStart; }
    public LocalDate periodEnd() { return periodEnd; }
    public LocalDate dueDate() { return dueDate; }
    public EngagementStatus status() { return status; }
    public Instant statusChangedAt() { return statusChangedAt; }
    public EngagementStatus archivedFromStatus() { return archivedFromStatus; }
    public long version() { return version; }

    public void submitForReview(Instant now) { transition(EngagementStatus.ACTIVE, EngagementStatus.AWAITING_REVIEW, now); }
    public void markBlocked(Instant now) { transition(EngagementStatus.ACTIVE, EngagementStatus.BLOCKED, now); }
    public void resumeActive(Instant now) { transition(EngagementStatus.BLOCKED, EngagementStatus.ACTIVE, now); }
    public void approve(Instant now) { transition(EngagementStatus.AWAITING_REVIEW, EngagementStatus.COMPLETE, now); }
    public void returnForPreparation(Instant now) { transition(EngagementStatus.AWAITING_REVIEW, EngagementStatus.ACTIVE, now); }

    public void cancel(Instant now) {
        if (status != EngagementStatus.ACTIVE && status != EngagementStatus.BLOCKED && status != EngagementStatus.AWAITING_REVIEW)
            throw invalid("cancel");
        changeTo(EngagementStatus.CANCELLED, now);
    }

    public void reopen(Instant now) {
        if (status != EngagementStatus.COMPLETE && status != EngagementStatus.CANCELLED) throw invalid("reopen");
        changeTo(EngagementStatus.ACTIVE, now);
    }

    public void archive(Instant now) {
        if (status != EngagementStatus.COMPLETE && status != EngagementStatus.CANCELLED) throw invalid("archive");
        archivedFromStatus = status;
        changeTo(EngagementStatus.ARCHIVED, now);
    }

    public void unarchive(Instant now) {
        if (status != EngagementStatus.ARCHIVED || archivedFromStatus == null) throw invalid("unarchive");
        EngagementStatus restore = archivedFromStatus;
        archivedFromStatus = null;
        changeTo(restore, now);
    }

    private void transition(EngagementStatus expected, EngagementStatus target, Instant now) {
        if (status != expected) throw invalid(target.name().toLowerCase());
        changeTo(target, now);
    }

    private void changeTo(EngagementStatus target, Instant now) {
        status = target;
        statusChangedAt = now;
        updatedAt = now;
    }

    private IllegalStateException invalid(String action) {
        return new IllegalStateException("Cannot " + action + " engagement from " + status);
    }
}
