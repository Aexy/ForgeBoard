package com.forgeboard.engagement.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** Mutable completion state over an immutable checklist snapshot. */
@Entity
@Table(name = "engagement_checklist_items")
public class EngagementChecklistItem {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "engagement_id", nullable = false) private UUID engagementId;
    @Column(name = "source_item_id", nullable = false) private UUID sourceItemId;
    @Column(nullable = false, length = 240) private String label;
    @Column(name = "is_required", nullable = false) private boolean required;
    @Column(nullable = false) private int position;
    @Column(name = "completed_by") private UUID completedBy;
    @Column(name = "completed_at") private Instant completedAt;
    @Version private long version;

    protected EngagementChecklistItem() {}
    public EngagementChecklistItem(UUID id, UUID firmId, UUID engagementId, UUID sourceItemId, String label,
            boolean required, int position) {
        this.id = id; this.firmId = firmId; this.engagementId = engagementId; this.sourceItemId = sourceItemId;
        this.label = label; this.required = required; this.position = position;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID engagementId() { return engagementId; }
    public String label() { return label; }
    public boolean required() { return required; }
    public int position() { return position; }
    public UUID completedBy() { return completedBy; }
    public Instant completedAt() { return completedAt; }
    public long version() { return version; }
    public boolean completed() { return completedAt != null; }
    public void setCompleted(boolean completed, UUID actorId, Instant now) {
        if (completed) { completedBy = actorId; completedAt = now; }
        else { completedBy = null; completedAt = null; }
    }
}
