package com.forgeboard.engagement.domain;

import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Immutable definition checklist item belonging to one template version. */
@Entity
@Table(name = "engagement_template_version_checklist_items")
public class EngagementTemplateVersionChecklistItem {
    @Id private UUID id;
    @Column(name = "firm_id", nullable = false) private UUID firmId;
    @Column(name = "template_id", nullable = false) private UUID templateId;
    @Column(name = "definition_version", nullable = false) private int definitionVersion;
    @Column(nullable = false, length = 240) private String label;
    @Column(name = "is_required", nullable = false) private boolean required;
    @Column(nullable = false) private int position;

    protected EngagementTemplateVersionChecklistItem() {}
    public EngagementTemplateVersionChecklistItem(UUID id, UUID firmId, UUID templateId, int definitionVersion,
            String label, boolean required, int position) {
        this.id = id; this.firmId = firmId; this.templateId = templateId; this.definitionVersion = definitionVersion;
        this.label = label; this.required = required; this.position = position;
    }
    public UUID id() { return id; }
    public UUID firmId() { return firmId; }
    public UUID templateId() { return templateId; }
    public int definitionVersion() { return definitionVersion; }
    public String label() { return label; }
    public boolean required() { return required; }
    public int position() { return position; }
}
