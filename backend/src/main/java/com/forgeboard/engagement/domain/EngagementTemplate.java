package com.forgeboard.engagement.domain;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "engagement_templates")
public class EngagementTemplate {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "workflow_id", nullable = false) private UUID workflowId;
    @Column(nullable = false, length = 160) private String name;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Recurrence recurrence;
    @Column(name = "default_work_item_title", nullable = false, length = 200) private String defaultWorkItemTitle;
    @Column(name = "due_day", nullable = false) private int dueDay;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version private long version;

    protected EngagementTemplate() {}
    public EngagementTemplate(UUID id, UUID firmId, UUID workflowId, String name, Recurrence recurrence,
            String defaultWorkItemTitle, int dueDay, Instant now) {
        this.id = id; this.firmId = firmId; this.workflowId = workflowId; this.name = name;
        this.recurrence = recurrence; this.defaultWorkItemTitle = defaultWorkItemTitle; this.dueDay = dueDay;
        this.createdAt = now; this.updatedAt = now;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID workflowId() { return workflowId; }
    public String name() { return name; }
    public Recurrence recurrence() { return recurrence; }
    public String defaultWorkItemTitle() { return defaultWorkItemTitle; }
    public int dueDay() { return dueDay; }
    public long version() { return version; }
}
