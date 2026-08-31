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
@Table(name = "engagement_template_versions")
public class EngagementTemplateVersion {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "template_id", nullable = false) private UUID templateId;
    @Column(name = "definition_version", nullable = false) private int definitionVersion;
    @Column(name = "workflow_id", nullable = false) private UUID workflowId;
    @Column(nullable = false, length = 160) private String name;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Recurrence recurrence;
    @Column(name = "default_work_item_title", nullable = false, length = 200) private String defaultWorkItemTitle;
    @Column(name = "due_day", nullable = false) private int dueDay;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected EngagementTemplateVersion() {}

    public EngagementTemplateVersion(UUID id, UUID firmId, UUID templateId, int definitionVersion, UUID workflowId,
            String name, Recurrence recurrence, String defaultWorkItemTitle, int dueDay, UUID createdBy, Instant createdAt) {
        this.id = id; this.firmId = firmId; this.templateId = templateId; this.definitionVersion = definitionVersion;
        this.workflowId = workflowId; this.name = name; this.recurrence = recurrence;
        this.defaultWorkItemTitle = defaultWorkItemTitle; this.dueDay = dueDay; this.createdBy = createdBy; this.createdAt = createdAt;
    }

    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID templateId() { return templateId; }
    public int definitionVersion() { return definitionVersion; }
    public UUID workflowId() { return workflowId; }
    public String name() { return name; }
    public Recurrence recurrence() { return recurrence; }
    public String defaultWorkItemTitle() { return defaultWorkItemTitle; }
    public int dueDay() { return dueDay; }
    public UUID createdBy() { return createdBy; }
    public Instant createdAt() { return createdAt; }
}
